import { getPlanLimits, effectivePlan } from "../plans/plans.constants";
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from "@nestjs/common";
import { InjectQueue }         from "@nestjs/bull";
import { Queue }               from "bull";
import dayjs                   from "dayjs";
import { PrismaService }       from "../common/prisma/prisma.service";
import { CreateScheduleDto }   from "./dto/schedules.dto";
import { UpdateScheduleDto }   from "./dto/schedules.dto";
import { PauseScheduleDto }    from "./dto/schedules.dto";
import { CancelScheduleDto }   from "./dto/schedules.dto";
import { Frequency }           from "@prisma/client";

@Injectable()
export class SchedulesService {
  constructor(
    private readonly prisma:          PrismaService,
    @InjectQueue("payments") private readonly queue: Queue,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────
  private nextRunAfter(current: Date, frequency: Frequency): Date {
    const d = dayjs(current);
    switch (frequency) {
      case "daily":     return d.add(1,  "day").toDate();
      case "weekly":    return d.add(1,  "week").toDate();
      case "monthly":   return d.add(1,  "month").toDate();
      case "quarterly": return d.add(3,  "month").toDate();
      case "yearly":    return d.add(1,  "year").toDate();
      case "once":      return d.toDate();   // won't be re-queued
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async findAll(userId: string, status?: string) {
    return this.prisma.paymentSchedule.findMany({
      where:   { userId, ...(status ? { status: status as any } : {}) },
      orderBy: { nextRunAt: "asc" },
      include: {
        beneficiary:   { select: { id: true, name: true, bank: true, accountNumber: true } },
        sourceAccount: { select: { id: true, bankName: true, accountNumber: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const sch = await this.prisma.paymentSchedule.findFirst({
      where:   { id, userId },
      include: {
        beneficiary:   true,
        sourceAccount: true,
        transactions:  { orderBy: { initiatedAt: "desc" }, take: 10 },
      },
    });
    if (!sch) throw new NotFoundException("Schedule not found");
    return sch;
  }

  async create(userId: string, dto: CreateScheduleDto) {
    // ── Plan limit check ─────────────────────────────────────────────────────────
    const user = await this.prisma.user.findUniqueOrThrow({
      where:  { id: userId },
      select: { plan: true, planExpiresAt: true },
    });

    const plan   = effectivePlan(user.plan, user.planExpiresAt);
    const limits = getPlanLimits(plan);

    if (limits.maxSchedules !== Infinity) {
      const activeCount = await this.prisma.paymentSchedule.count({
        where: { userId, status: "active" },
      });

      if (activeCount >= limits.maxSchedules) {
        throw new ForbiddenException(
          `Your ${plan} plan supports up to ${limits.maxSchedules} active schedule${limits.maxSchedules === 1 ? "" : "s"}. ` +
          `Upgrade to Personal for unlimited schedules.`
        );
      }
    }
    // ── End plan limit check ─────────────────────────────────────────────────────
    // Resolve source account
    let sourceAccountId = dto.sourceAccountId;
    if (!sourceAccountId) {
      const def = await this.prisma.linkedBankAccount.findFirst({
        where: { userId, isDefault: true, deletedAt: null },
      });
      if (!def) throw new BadRequestException("No default bank account linked. Please link a bank account first.");
      sourceAccountId = def.id;
    }

    // Verify beneficiary belongs to user
    const bene = await this.prisma.beneficiary.findFirst({ where: { id: dto.beneficiaryId, userId, deletedAt: null } });
    if (!bene) throw new NotFoundException("Recipient not found");

    const nextRunAt = new Date(dto.startDate);
    const sch = await this.prisma.paymentSchedule.create({
      data: {
        userId,
        beneficiaryId:  dto.beneficiaryId,
        sourceAccountId,
        type:           dto.type,
        amount:         dto.amount,
        frequency:      dto.frequency,
        note:           dto.note,
        nextRunAt,
        startDate:      nextRunAt,
        endDate:        dto.endDate ? new Date(dto.endDate) : undefined,
        maxOccurrences: dto.maxOccurrences,
        status:         "active",
      },
      include: { beneficiary: { select: { name: true } } },
    });

    // Enqueue the payment job in BullMQ
    await this.enqueuePaymentJob(sch.id, nextRunAt);

    // Enqueue 24h-before reminder
    await this.enqueueReminderJob(sch.id, nextRunAt);

    await this.prisma.auditLog.create({
      data: {
        userId,
        action:   "CREATE_SCHEDULE",
        entity:   "PaymentSchedule",
        entityId: sch.id,
        changes:  { after: { amount: dto.amount, frequency: dto.frequency, nextRunAt } } as any,
      },
    });

    return sch;
  }

  async update(userId: string, id: string, dto: UpdateScheduleDto) {
    const sch = await this.prisma.paymentSchedule.findFirst({ where: { id, userId } });
    if (!sch) throw new NotFoundException("Schedule not found");
    if (sch.status === "cancelled") throw new BadRequestException("Cannot update a cancelled schedule");

    const before = { amount: sch.amount, frequency: sch.frequency, nextRunAt: sch.nextRunAt };

    const updated = await this.prisma.paymentSchedule.update({
      where: { id },
      data: {
        ...(dto.amount    ? { amount:    dto.amount }    : {}),
        ...(dto.frequency ? { frequency: dto.frequency } : {}),
        ...(dto.nextRunAt ? { nextRunAt: new Date(dto.nextRunAt) } : {}),
        ...(dto.endDate   ? { endDate:   new Date(dto.endDate) }   : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });

    // Re-enqueue if nextRunAt changed
    if (dto.nextRunAt && sch.bullJobId) {
      const oldJob = await this.queue.getJob(sch.bullJobId);
      await oldJob?.remove();
      await this.enqueuePaymentJob(id, new Date(dto.nextRunAt));
    }

    await this.prisma.auditLog.create({
      data: { userId, action: "UPDATE_SCHEDULE", entity: "PaymentSchedule", entityId: id, changes: { before, after: dto } as any },
    });

    return updated;
  }

  async pause(userId: string, id: string, dto: PauseScheduleDto) {
    const sch = await this.prisma.paymentSchedule.findFirst({ where: { id, userId } });
    if (!sch) throw new NotFoundException("Schedule not found");
    if (sch.status !== "active") throw new BadRequestException("Only active schedules can be paused");

    // Remove the queued job
    if (sch.bullJobId) {
      const job = await this.queue.getJob(sch.bullJobId);
      await job?.remove();
    }

    const updated = await this.prisma.paymentSchedule.update({
      where: { id },
      data:  { status: "paused", pausedAt: new Date(), bullJobId: null },
    });

    await this.prisma.alert.create({
      data: {
        userId,
        type:       "warn",
        title:      "⏸ Schedule Paused",
        message:    `Your ${sch.type} payment of ₦${sch.amount.toLocaleString()} has been paused.`,
        scheduleId: id,
      },
    });

    return updated;
  }

  async resume(userId: string, id: string) {
    const sch = await this.prisma.paymentSchedule.findFirst({ where: { id, userId } });
    if (!sch) throw new NotFoundException("Schedule not found");
    if (sch.status !== "paused") throw new BadRequestException("Only paused schedules can be resumed");

    // Re-schedule next run (use nextRunAt if still in future, otherwise advance to next interval)
    let nextRunAt = sch.nextRunAt;
    if (nextRunAt < new Date()) {
      nextRunAt = this.nextRunAfter(new Date(), sch.frequency);
    }

    const updated = await this.prisma.paymentSchedule.update({
      where: { id },
      data:  { status: "active", pausedAt: null, nextRunAt },
    });

    await this.enqueuePaymentJob(id, nextRunAt);
    await this.enqueueReminderJob(id, nextRunAt);

    return updated;
  }

  async cancel(userId: string, id: string, dto: CancelScheduleDto) {
    const sch = await this.prisma.paymentSchedule.findFirst({ where: { id, userId } });
    if (!sch) throw new NotFoundException("Schedule not found");
    if (sch.status === "cancelled") throw new BadRequestException("Schedule is already cancelled");

    if (sch.bullJobId) {
      const job = await this.queue.getJob(sch.bullJobId);
      await job?.remove();
    }
    if (sch.reminderJobId) {
      const job = await this.queue.getJob(sch.reminderJobId);
      await job?.remove();
    }

    const updated = await this.prisma.paymentSchedule.update({
      where: { id },
      data:  {
        status:       "cancelled",
        cancelledAt:  new Date(),
        cancelReason: dto.reason,
        bullJobId:    null,
        reminderJobId: null,
      },
    });

    await this.prisma.alert.create({
      data: {
        userId,
        type:       "info",
        title:      "🚫 Schedule Cancelled",
        message:    `Your ${sch.type} payment of ₦${Number(sch.amount).toLocaleString()} has been cancelled.`,
        scheduleId: id,
      },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: "CANCEL_SCHEDULE", entity: "PaymentSchedule", entityId: id, changes: { reason: dto.reason } as any },
    });

    return updated;
  }

  // ── BullMQ job helpers ────────────────────────────────────────────────────
  async enqueuePaymentJob(scheduleId: string, runAt: Date) {
    const delay = Math.max(0, runAt.getTime() - Date.now());
    const job = await this.queue.add(
      "execute-payment",
      { scheduleId },
      {
        delay,
        jobId:   `payment:${scheduleId}:${runAt.getTime()}`,
        attempts: 3,
        backoff:  { type: "exponential", delay: 30000 },
      },
    );
    await this.prisma.paymentSchedule.update({
      where: { id: scheduleId },
      data:  { bullJobId: String(job.id) },
    });
    return job;
  }

  async enqueueReminderJob(scheduleId: string, runAt: Date) {
    const remindAt = new Date(runAt.getTime() - 24 * 60 * 60 * 1000);  // 24h before
    if (remindAt <= new Date()) return;  // too late to remind
    const delay = remindAt.getTime() - Date.now();
    const job = await this.queue.add(
      "payment-reminder",
      { scheduleId },
      { delay, jobId: `reminder:${scheduleId}:${runAt.getTime()}` },
    );
    await this.prisma.paymentSchedule.update({
      where: { id: scheduleId },
      data:  { reminderJobId: String(job.id) },
    });
    return job;
  }

  // ── Summary stats for dashboard ───────────────────────────────────────────
  async getSummary(userId: string) {
    const [active, paused, cancelled, totalSpend] = await Promise.all([
      this.prisma.paymentSchedule.count({ where: { userId, status: "active" } }),
      this.prisma.paymentSchedule.count({ where: { userId, status: "paused" } }),
      this.prisma.paymentSchedule.count({ where: { userId, status: "cancelled" } }),
      this.prisma.transaction.aggregate({
        where:  { userId, status: "success" },
        _sum:   { amount: true },
      }),
    ]);

    const upcoming = await this.prisma.paymentSchedule.findMany({
      where:   { userId, status: "active" },
      orderBy: { nextRunAt: "asc" },
      take:    5,
      include: { beneficiary: { select: { name: true } } },
    });

    return {
      counts:   { active, paused, cancelled },
      totalSpend: totalSpend._sum.amount ?? 0,
      upcoming,
    };
  }
}

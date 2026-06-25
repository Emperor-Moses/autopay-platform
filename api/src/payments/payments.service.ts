import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from "@nestjs/common";
import { ConfigService }    from "@nestjs/config";
import { InjectQueue }      from "@nestjs/bull";
import { Queue }            from "bull";
import axios                from "axios";
import { v4 as uuid }       from "uuid";
import { PrismaService }    from "../common/prisma/prisma.service";
import { SchedulesService } from "../schedules/schedules.service";
import { BulkPayDto }       from "./dto/payments.dto";

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma:     PrismaService,
    private readonly config:     ConfigService,
    private readonly schedules:  SchedulesService,
    @InjectQueue("payments") private readonly queue: Queue,
  ) {}

  private get paystackSecret() { return this.config.get<string>("PAYSTACK_SECRET_KEY")!; }

  // ── Execute a single scheduled payment (called by BullMQ worker) ──────────
  async executeScheduledPayment(scheduleId: string): Promise<void> {
    const sch = await this.prisma.paymentSchedule.findUnique({
      where:   { id: scheduleId },
      include: { beneficiary: true, sourceAccount: true, user: true },
    });
    if (!sch || sch.status !== "active") return;

    const internalRef = `AUTOPAY-TXN-${uuid().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    // Create transaction record in "processing" state
    const txn = await this.prisma.transaction.create({
      data: {
        userId:         sch.userId,
        scheduleId:     sch.id,
        beneficiaryId:  sch.beneficiaryId,
        sourceAccountId: sch.sourceAccountId,
        amount:         sch.amount,
        currency:       sch.currency,
        type:           sch.type,
        internalRef,
        status:         "processing",
        description:    sch.note ?? `AutoPay: ${sch.type}`,
      },
    });

    try {
      // Ensure Paystack recipient code exists
      let recipientCode = sch.beneficiary.paystackRecipientCode;
      if (!recipientCode) {
        recipientCode = await this.ensureRecipientCode(sch.beneficiary);
      }

      // Initiate Paystack transfer
      const { data } = await axios.post(
        "https://api.paystack.co/transfer",
        {
          source:    "balance",
          amount:    Number(sch.amount) * 100,    // Paystack expects kobo
          recipient: recipientCode,
          reason:    sch.note || `AutoPay ${sch.type}`,
          reference: internalRef,
        },
        { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
      );

      await this.prisma.transaction.update({
        where: { id: txn.id },
        data:  {
          status:             "pending",
          paystackReference:  data.data.reference,
          paystackTransferId: String(data.data.id),
          paystackStatus:     data.data.status,
          processedAt:        new Date(),
        },
      });

      this.logger.log(`Transfer initiated: ${internalRef} → ${data.data.transfer_code}`);
    } catch (err: any) {
      this.logger.error(`Payment failed for schedule ${scheduleId}: ${err.message}`);
      await this.prisma.transaction.update({
        where: { id: txn.id },
        data:  { status: "failed", failureReason: err.response?.data?.message ?? err.message },
      });

      // Alert user
      await this.prisma.alert.create({
        data: {
          userId:     sch.userId,
          type:       "danger",
          title:      "❌ Payment Failed",
          message:    `₦${Number(sch.amount).toLocaleString()} to ${sch.beneficiary.name} failed: ${err.response?.data?.message ?? "Unknown error"}`,
          scheduleId: sch.id,
          txnId:      txn.id,
        },
      });
      throw err;   // BullMQ will retry
    }

    // Advance schedule to next run date
    await this.advanceSchedule(sch);
  }

  private async advanceSchedule(sch: any) {
    const nextRunAt = this.schedules["nextRunAfter"](sch.nextRunAt, sch.frequency);
    const newCount  = sch.occurrenceCount + 1;
    const isDone    =
      sch.frequency === "once" ||
      (sch.endDate && nextRunAt > sch.endDate) ||
      (sch.maxOccurrences && newCount >= sch.maxOccurrences);

    if (isDone) {
      await this.prisma.paymentSchedule.update({
        where: { id: sch.id },
        data:  { status: "completed", lastRunAt: new Date(), occurrenceCount: newCount, bullJobId: null },
      });
    } else {
      await this.prisma.paymentSchedule.update({
        where: { id: sch.id },
        data:  { lastRunAt: new Date(), nextRunAt, occurrenceCount: newCount },
      });
      await this.schedules.enqueuePaymentJob(sch.id, nextRunAt);
      await this.schedules.enqueueReminderJob(sch.id, nextRunAt);
    }
  }

  // ── Transaction list ──────────────────────────────────────────────────────
  async getTransactions(userId: string, limit = 20, offset = 0, status?: string) {
    const [data, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where:   { userId, ...(status ? { status: status as any } : {}) },
        orderBy: { initiatedAt: "desc" },
        skip:    offset,
        take:    limit,
        include: {
          beneficiary:   { select: { name: true, bank: true } },
          sourceAccount: { select: { bankName: true, accountNumber: true } },
        },
      }),
      this.prisma.transaction.count({ where: { userId } }),
    ]);
    return { data, total, limit, offset };
  }

  async getTransaction(userId: string, id: string) {
    const txn = await this.prisma.transaction.findFirst({
      where:   { id, userId },
      include: { beneficiary: true, sourceAccount: true, schedule: true },
    });
    if (!txn) throw new NotFoundException("Transaction not found");
    return txn;
  }

  // ── Bulk payment ──────────────────────────────────────────────────────────
  async createBulkPayment(userId: string, dto: BulkPayDto) {
    const batchRef = `AUTOPAY-BULK-${uuid().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
    const total    = dto.payments.reduce((s, p) => s + p.amount, 0);

    const batch = await this.prisma.bulkBatch.create({
      data: {
        userId,
        batchRef,
        totalAmount: total,
        count:       dto.payments.length,
        status:      "pending",
      },
    });

    // Enqueue each payment as an individual BullMQ job
    for (const p of dto.payments) {
      const bene = await this.prisma.beneficiary.findFirst({ where: { id: p.beneficiaryId, userId } });
      if (!bene) continue;

      const internalRef = `AUTOPAY-TXN-${uuid().replace(/-/g, "").slice(0, 16).toUpperCase()}`;
      await this.prisma.transaction.create({
        data: {
          userId,
          beneficiaryId: p.beneficiaryId,
          amount:        p.amount,
          currency:      "NGN",
          type:          p.type,
          internalRef,
          status:        "scheduled",
          isBulk:        true,
          bulkBatchId:   batch.id,
          description:   p.note ?? `Bulk: ${p.type}`,
        },
      });

      await this.queue.add(
        "execute-bulk-item",
        { batchId: batch.id, beneficiaryId: p.beneficiaryId, amount: p.amount, internalRef, recipientCode: bene.paystackRecipientCode },
        { delay: 1000, jobId: `bulk:${batch.id}:${p.beneficiaryId}` },
      );
    }

    return { batch, message: `${dto.payments.length} payments queued` };
  }

  // ── Webhook handler (called by WebhookController) ─────────────────────────
  async handlePaystackWebhook(event: string, data: any) {
    // Idempotency check
    const eventId = data.id?.toString() ?? `${event}:${data.reference}`;
    const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId } });
    if (existing?.processedAt) return { skipped: true };

    await this.prisma.webhookEvent.upsert({
      where:  { eventId },
      update: {},
      create: { provider: "paystack", eventId, event, payload: data },
    });

    if (event === "transfer.success") {
      await this.prisma.transaction.updateMany({
        where: { paystackReference: data.reference },
        data:  {
          status:       "success",
          paystackStatus: "success",
          paystackData:  data,
          settledAt:    new Date(),
        },
      });
      // Alert the user
      const txn = await this.prisma.transaction.findFirst({ where: { paystackReference: data.reference } });
      if (txn) {
        const bene = await this.prisma.beneficiary.findUnique({ where: { id: txn.beneficiaryId! } });
        await this.prisma.alert.create({
          data: {
            userId:  txn.userId,
            type:    "info",
            title:   "✅ Payment Successful",
            message: `₦${Number(txn.amount).toLocaleString()} to ${bene?.name} completed. Ref: ${txn.internalRef}`,
            txnId:   txn.id,
          },
        });
      }
    }

    if (event === "transfer.failed" || event === "transfer.reversed") {
      await this.prisma.transaction.updateMany({
        where: { paystackReference: data.reference },
        data:  { status: "failed", paystackStatus: event.split(".")[1], paystackData: data },
      });
    }

    await this.prisma.webhookEvent.update({
      where: { eventId },
      data:  { processedAt: new Date() },
    });
  }

  // ── Internal helpers ──────────────────────────────────────────────────────
  private async ensureRecipientCode(bene: any): Promise<string> {
    const { data } = await axios.post(
      "https://api.paystack.co/transferrecipient",
      {
        type:           "nuban",
        name:           bene.accountName,
        account_number: bene.accountNumber,
        bank_code:      bene.bankCode,
        currency:       "NGN",
      },
      { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
    );
    const code = data.data.recipient_code;
    await this.prisma.beneficiary.update({ where: { id: bene.id }, data: { paystackRecipientCode: code } });
    return code;
  }
}

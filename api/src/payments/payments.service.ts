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

    // Direct debit must be an active mandate before we can charge the user.
    // Without this check we'd otherwise silently pay beneficiaries out of the
    // platform's own balance instead of the customer's account.
    if (!sch.sourceAccount?.paystackAuthCode || sch.sourceAccount.mandateStatus !== "active") {
      this.logger.error(`Schedule ${scheduleId} has no active direct debit mandate — cannot charge user`);
      await this.prisma.alert.create({
        data: {
          userId:     sch.userId,
          type:       "danger",
          title:      "⚠️ Action Needed: Authorise Direct Debit",
          message:    `We couldn't process your ₦${Number(sch.amount).toLocaleString()} payment to ${sch.beneficiary.name} because your linked account isn't authorised for direct debit yet. Please complete bank authorisation.`,
          scheduleId: sch.id,
        },
      });
      throw new Error("Source account has no active direct debit mandate");
    }

    const internalRef = `AUTOPAY-TXN-${uuid().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    // Create transaction record in "processing" state — this represents the
    // debit-the-user leg. The pay-the-beneficiary leg (transfer) is only
    // initiated once we receive a charge.success webhook for this reference.
    const txn = await this.prisma.transaction.create({
      data: {
        userId:          sch.userId,
        scheduleId:      sch.id,
        beneficiaryId:   sch.beneficiaryId,
        sourceAccountId: sch.sourceAccountId,
        amount:          sch.amount,
        currency:        sch.currency,
        type:            sch.type,
        internalRef,
        chargeReference: internalRef,
        status:          "processing",
        description:     sch.note ?? `AutoPay: ${sch.type}`,
      },
    });

    try {
      const { data } = await axios.post(
        "https://api.paystack.co/transaction/charge_authorization",
        {
          authorization_code: sch.sourceAccount.paystackAuthCode,
          email:               sch.user.email,
          amount:              Number(sch.amount) * 100, // Paystack expects kobo
          currency:            sch.currency,
          reference:           internalRef,
        },
        { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
      );

      await this.prisma.transaction.update({
        where: { id: txn.id },
        data:  {
          paystackStatus: data.data.status, // typically "processing" or "success"
          processedAt:    new Date(),
        },
      });

      this.logger.log(`Charge initiated: ${internalRef} (status: ${data.data.status})`);
    } catch (err: any) {
      const message = err.response?.data?.message ?? err.message;
      this.logger.error(`Charge failed for schedule ${scheduleId}: ${message}`);
      await this.prisma.transaction.update({
        where: { id: txn.id },
        data:  { status: "failed", failureReason: message },
      });

      await this.prisma.alert.create({
        data: {
          userId:     sch.userId,
          type:       "danger",
          title:      "❌ Payment Failed",
          message:    `₦${Number(sch.amount).toLocaleString()} to ${sch.beneficiary.name} failed: ${message}`,
          scheduleId: sch.id,
          txnId:      txn.id,
        },
      });
      throw err;   // BullMQ will retry
    }

    // Advance schedule to next run date — note this reflects the charge being
    // *initiated*, not yet settled. Settlement happens asynchronously via webhook.
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

    // ── Direct debit mandate lifecycle ───────────────────────────────────────
    if (event === "direct_debit.authorization.created" || event === "direct_debit.authorization.active") {
      await this.handleDirectDebitAuthorizationEvent(event, data);
    }

    // ── Leg 1: charging the user's linked account ────────────────────────────
    if (event === "charge.success") {
      await this.handleChargeSuccess(data);
    }
    if (event === "charge.failed") {
      await this.handleChargeFailed(data);
    }

    // ── Leg 2: paying the beneficiary out (after a successful charge) ───────
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
      const txn = await this.prisma.transaction.findFirst({ where: { paystackReference: data.reference } });
      await this.prisma.transaction.updateMany({
        where: { paystackReference: data.reference },
        data:  { status: "failed", paystackStatus: event.split(".")[1], paystackData: data },
      });
      if (txn) {
        // We already collected the money from the user (charge.success fired
        // earlier) but couldn't pay the beneficiary — this needs manual
        // follow-up (refund or retry), not just a silent status flip.
        const bene = await this.prisma.beneficiary.findUnique({ where: { id: txn.beneficiaryId! } });
        await this.prisma.alert.create({
          data: {
            userId:  txn.userId,
            type:    "danger",
            title:   "⚠️ Payout Failed After Charge",
            message: `We collected ₦${Number(txn.amount).toLocaleString()} from your account but the payout to ${bene?.name} failed. Our team has been notified — Ref: ${txn.internalRef}`,
            txnId:   txn.id,
          },
        });
        this.logger.error(`Transfer failed AFTER successful charge for txn ${txn.id} (ref: ${txn.internalRef}) — needs manual refund/retry review`);
      }
    }

    await this.prisma.webhookEvent.update({
      where: { eventId },
      data:  { processedAt: new Date() },
    });
  }

  // Direct debit mandate created/activated — find the matching pending/created
  // LinkedBankAccount for this customer and update its status.
  private async handleDirectDebitAuthorizationEvent(event: string, data: any) {
    const customerCode = data.customer?.code;
    const customerEmail = data.customer?.email;
    if (!customerCode && !customerEmail) return;

    const user = await this.prisma.user.findFirst({
      where: customerCode ? { paystackCustomerCode: customerCode } : { email: customerEmail },
    });
    if (!user) {
      this.logger.warn(`Direct debit webhook (${event}) — no matching user for customer ${customerCode ?? customerEmail}`);
      return;
    }

    // Best-effort match: the webhook payload doesn't echo back our original
    // reference, so we match on the most recently initiated pending/created
    // mandate for this user. If a user has multiple mandates in flight at the
    // same time this could match the wrong one — acceptable for now since the
    // UI only allows one in-progress authorization at a time.
    const account = await this.prisma.linkedBankAccount.findFirst({
      where: { userId: user.id, mandateStatus: { in: ["pending", "created"] }, deletedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    if (!account) {
      this.logger.warn(`Direct debit webhook (${event}) — no pending mandate found for user ${user.id}`);
      return;
    }

    const isActive = event === "direct_debit.authorization.active";
    await this.prisma.linkedBankAccount.update({
      where: { id: account.id },
      data: {
        mandateStatus:    isActive ? "active" : "created",
        paystackAuthCode: data.authorization_code ?? account.paystackAuthCode,
      },
    });

    await this.prisma.alert.create({
      data: {
        userId:  user.id,
        type:    isActive ? "info" : "warn",
        title:   isActive ? "✅ Direct Debit Authorised" : "🔄 Bank Authorisation Received",
        message: isActive
          ? `Your ${account.bankName} account is now authorised for AutoPay. Scheduled payments can debit this account.`
          : `We received your bank's confirmation. Activation can take up to 24 hours — we'll notify you once it's ready.`,
      },
    });
  }

  // The user's account was successfully charged for a scheduled payment.
  // Now (and only now) initiate the actual payout to the beneficiary.
  private async handleChargeSuccess(data: any) {
    const txn = await this.prisma.transaction.findFirst({ where: { chargeReference: data.reference } });
    if (!txn || txn.status !== "processing") return; // not one of ours, or already handled

    const beneficiary = await this.prisma.beneficiary.findUnique({ where: { id: txn.beneficiaryId! } });
    if (!beneficiary) {
      this.logger.error(`charge.success for txn ${txn.id} but beneficiary ${txn.beneficiaryId} not found`);
      return;
    }

    try {
      let recipientCode = beneficiary.paystackRecipientCode;
      if (!recipientCode) {
        recipientCode = await this.ensureRecipientCode(beneficiary);
      }

      const transferRef = `${txn.internalRef}-OUT`;
      const { data: transfer } = await axios.post(
        "https://api.paystack.co/transfer",
        {
          source:    "balance",
          amount:    Number(txn.amount) * 100,
          recipient: recipientCode,
          reason:    txn.description || "AutoPay payout",
          reference: transferRef,
        },
        { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
      );

      await this.prisma.transaction.update({
        where: { id: txn.id },
        data: {
          status:             "pending", // charged ✅, payout in flight — settles on transfer.success
          paystackReference:  transfer.data.reference,
          paystackTransferId: String(transfer.data.id),
          paystackStatus:     transfer.data.status,
        },
      });
    } catch (err: any) {
      const message = err.response?.data?.message ?? err.message;
      this.logger.error(`Payout-after-charge failed for txn ${txn.id}: ${message}`);
      await this.prisma.transaction.update({
        where: { id: txn.id },
        data:  { status: "failed", failureReason: `Charged but payout failed: ${message}` },
      });
      await this.prisma.alert.create({
        data: {
          userId:  txn.userId,
          type:    "danger",
          title:   "⚠️ Payout Failed After Charge",
          message: `We collected ₦${Number(txn.amount).toLocaleString()} from your account but couldn't pay ${beneficiary.name}: ${message}. Our team has been notified.`,
          txnId:   txn.id,
        },
      });
    }
  }

  private async handleChargeFailed(data: any) {
    const txn = await this.prisma.transaction.findFirst({ where: { chargeReference: data.reference } });
    if (!txn || txn.status !== "processing") return;

    const message = data.gateway_response ?? "Charge failed";
    await this.prisma.transaction.update({
      where: { id: txn.id },
      data:  { status: "failed", failureReason: message, paystackStatus: "failed", paystackData: data },
    });

    const bene = txn.beneficiaryId ? await this.prisma.beneficiary.findUnique({ where: { id: txn.beneficiaryId } }) : null;
    await this.prisma.alert.create({
      data: {
        userId:  txn.userId,
        type:    "danger",
        title:   "❌ Payment Failed",
        message: `₦${Number(txn.amount).toLocaleString()}${bene ? ` to ${bene.name}` : ""} failed: ${message}`,
        txnId:   txn.id,
      },
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

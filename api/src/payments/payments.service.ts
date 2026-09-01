import { PlansService } from "../plans/plans.service";
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
import { UsersService }     from "../users/users.service";
import { BulkPayDto }       from "./dto/payments.dto";

// ── Platform fee ──────────────────────────────────────────────────────────────
const PLATFORM_FEE_RATE = 0.001;           // 0.1%
const MIN_FEE_KOBO      = 100;             // ₦1 minimum fee in kobo (avoid charging tiny amounts)

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma:    PrismaService,
    private readonly config:    ConfigService,
    private readonly schedules: SchedulesService,
    private readonly users:     UsersService,
    private readonly plansService: PlansService,
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

    // ── Calculate 0.1% platform fee ────────────────────────────────────────
    const paymentAmount = Number(sch.amount);                          // in naira
    const feeNaira      = Math.max(paymentAmount * PLATFORM_FEE_RATE, 1); // min ₦1
    const feeKobo       = Math.round(feeNaira * 100);

    // ── Create transaction record in "processing" state ────────────────────
    const txn = await this.prisma.transaction.create({
      data: {
        userId:          sch.userId,
        scheduleId:      sch.id,
        beneficiaryId:   sch.beneficiaryId,
        sourceAccountId: sch.sourceAccountId,
        amount:          sch.amount,
        feeAmount:       feeNaira,           // recorded on the txn
        currency:        sch.currency,
        type:            sch.type,
        internalRef,
        status:          "processing",
        description:     sch.note ?? `AutoPay: ${sch.type}`,
      },
    });

    // ── Step 1: Charge the 0.1% platform fee via stored card ──────────────
    if (feeKobo >= MIN_FEE_KOBO && sch.user.cardAuthCode && sch.user.cardEmail) {
      await this.chargePlatformFee({
        txnId:       txn.id,
        userId:      sch.userId,
        authCode:    sch.user.cardAuthCode,
        email:       sch.user.cardEmail,
        feeKobo,
        feeNaira,
        internalRef,
      });
    } else if (!sch.user.cardAuthCode) {
      this.logger.warn(
        `No card auth for user ${sch.userId} — fee skipped for txn ${internalRef}. ` +
        `User should re-link bank account to store card.`
      );
      await this.prisma.transaction.update({
        where: { id: txn.id },
        data:  { feeStatus: "skipped" },
      });
    }

    // ── Step 2: Execute the main payment transfer ──────────────────────────
    try {
      let recipientCode = sch.beneficiary.paystackRecipientCode;
      if (!recipientCode) {
        recipientCode = await this.ensureRecipientCode(sch.beneficiary);
      }

      const { data } = await axios.post(
        "https://api.paystack.co/transfer",
        {
          source:    "balance",
          amount:    paymentAmount * 100,              // kobo
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

      this.logger.log(`Transfer initiated: ${internalRef} → ${data.data.transfer_code} | fee: ₦${feeNaira.toFixed(2)}`);

    } catch (err: any) {
      this.logger.error(`Payment failed for schedule ${scheduleId}: ${err.message}`);
      await this.prisma.transaction.update({
        where: { id: txn.id },
        data:  { status: "failed", failureReason: err.response?.data?.message ?? err.message },
      });
      await this.prisma.alert.create({
        data: {
          userId:     sch.userId,
          type:       "danger",
          title:      "❌ Payment Failed",
          message:    `₦${paymentAmount.toLocaleString()} to ${sch.beneficiary.name} failed: ${err.response?.data?.message ?? "Unknown error"}`,
          scheduleId: sch.id,
          txnId:      txn.id,
        },
      });
      throw err;   // BullMQ will retry
    }

    await this.advanceSchedule(sch);
  }

  // ── Charge the 0.1% platform fee against the user's stored card ───────────
  private async chargePlatformFee(params: {
    txnId:      string;
    userId:     string;
    authCode:   string;
    email:      string;
    feeKobo:    number;
    feeNaira:   number;
    internalRef: string;
  }) {
    const { txnId, userId, authCode, email, feeKobo, feeNaira, internalRef } = params;
    const feeRef = `AUTOPAY-FEE-${internalRef.slice(-12)}`;

    try {
      const { data } = await axios.post(
        "https://api.paystack.co/charge/authorize",
        {
          authorization_code: authCode,
          email,
          amount:             feeKobo,
          reference:          feeRef,
          metadata: {
            autopay_action:   "PLATFORM_FEE",
            autopay_user_id:  userId,
            autopay_txn_ref:  internalRef,
          },
        },
        { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
      );

      const status = data.data.status;

      await this.prisma.transaction.update({
        where: { id: txnId },
        data:  {
          feeRef,
          feeStatus: status === "success" ? "success" : "pending",
        },
      });

      this.logger.log(`Platform fee charged: ₦${feeNaira.toFixed(2)} | ref: ${feeRef} | status: ${status}`);

    } catch (err: any) {
      // Fee charge failure is non-fatal — we log it and continue with the
      // main payment. A retry or manual review can handle failed fees.
      this.logger.warn(`Platform fee charge failed for ${internalRef}: ${err.message}`);
      await this.prisma.transaction.update({
        where: { id: txnId },
        data:  { feeRef, feeStatus: "failed" },
      });
    }
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
      data: { userId, batchRef, totalAmount: total, count: dto.payments.length, status: "pending" },
    });

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

  // ── Webhook handler ───────────────────────────────────────────────────────
  async handlePaystackWebhook(event: string, data: any) {
    const eventId = data.id?.toString() ?? `${event}:${data.reference}`;
    const existing = await this.prisma.webhookEvent.findUnique({ where: { eventId } });
    if (existing?.processedAt) return { skipped: true };

    await this.prisma.webhookEvent.upsert({
      where:  { eventId },
      update: {},
      create: { provider: "paystack", eventId, event, payload: data },
    });

    // ── Handle ₦50 linking fee card charge ────────────────────────────────

if (event === "charge.success") {
  const meta = data.metadata ?? {};
  const auth = data.authorization ?? {};

  if (meta.autopay_action === "LINK_BANK") {
    // ── Card paid ₦50 — complete linking using card data from Paystack ──
    await this.users.completeLinkAfterFee({
      reference:    data.reference,
      authCode:     auth.authorization_code,
      cardEmail:    data.customer?.email,
      cardLast4:    auth.last4,
      cardBin:      auth.bin,
      // Paystack returns the issuing bank name on the authorization object
      cardBank:     auth.bank ?? "Card",
      cardType:     auth.card_type ?? auth.channel ?? "card",
      cardExpMonth: auth.exp_month,
      cardExpYear:  auth.exp_year,
      userId:       meta.autopay_user_id,
      // account_name comes from the customer name on the Paystack transaction
      accountName:  data.customer?.metadata?.full_name ||
                    [data.customer?.first_name, data.customer?.last_name]
                      .filter(Boolean)
                      .join(" ") ||
                    "AutoPay User",
    });
    this.logger.log(`Card linked for user ${meta.autopay_user_id} | bank: ${auth.bank} | last4: ${auth.last4}`);
  }

  if (meta.autopay_action === "PLAN_UPGRADE") {
    // Card payment for a plan upgrade succeeded — activate the plan
    await this.plansService.activatePlan(
      meta.autopay_user_id,
      meta.autopay_plan,
      data.reference,
    );
    this.logger.log(`Plan upgraded via webhook: user=${meta.autopay_user_id} plan=${meta.autopay_plan}`);
  } 

  if (meta.autopay_action === "PLATFORM_FEE") {
    await this.prisma.transaction.updateMany({
      where: { feeRef: data.reference },
      data:  { feeStatus: "success" },
    });
    this.logger.log(`Platform fee confirmed: ${data.reference}`);
  }
}

    // ── Handle transfer outcomes ──────────────────────────────────────────
    if (event === "transfer.success") {
      await this.prisma.transaction.updateMany({
        where: { paystackReference: data.reference },
        data:  { status: "success", paystackStatus: "success", paystackData: data, settledAt: new Date() },
      });
      const txn = await this.prisma.transaction.findFirst({ where: { paystackReference: data.reference } });
      if (txn) {
        const bene = await this.prisma.beneficiary.findUnique({ where: { id: txn.beneficiaryId! } });
        const fee  = txn.feeAmount ? ` (incl. ₦${Number(txn.feeAmount).toFixed(2)} service fee)` : "";
        await this.prisma.alert.create({
          data: {
            userId:  txn.userId,
            type:    "info",
            title:   "✅ Payment Successful",
            message: `₦${Number(txn.amount).toLocaleString()} to ${bene?.name} completed${fee}. Ref: ${txn.internalRef}`,
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

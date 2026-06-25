import { Process, Processor, OnQueueFailed, OnQueueCompleted } from "@nestjs/bull";
import { Logger }         from "@nestjs/common";
import { Job }            from "bull";
import { PaymentsService } from "../payments/payments.service";
import { PrismaService }  from "../common/prisma/prisma.service";
import axios              from "axios";
import { ConfigService }  from "@nestjs/config";

@Processor("payments")
export class PaymentProcessor {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    private readonly payments: PaymentsService,
    private readonly prisma:   PrismaService,
    private readonly config:   ConfigService,
  ) {}

  // ── Execute a scheduled payment ───────────────────────────────────────────
  @Process("execute-payment")
  async handleExecutePayment(job: Job<{ scheduleId: string }>) {
    this.logger.log(`Processing payment job ${job.id} — schedule: ${job.data.scheduleId}`);
    await this.payments.executeScheduledPayment(job.data.scheduleId);
    this.logger.log(`Payment job ${job.id} completed`);
  }

  // ── Execute a bulk payment item ───────────────────────────────────────────
  @Process("execute-bulk-item")
  async handleBulkItem(job: Job<{
    batchId:       string;
    beneficiaryId: string;
    amount:        number;
    internalRef:   string;
    recipientCode: string | null;
  }>) {
    const { batchId, beneficiaryId, amount, internalRef } = job.data;
    const paystackSecret = this.config.get<string>("PAYSTACK_SECRET_KEY")!;

    this.logger.log(`Bulk item job ${job.id}: ₦${amount} to ${beneficiaryId}`);

    try {
      let recipientCode = job.data.recipientCode;
      if (!recipientCode) {
        const bene = await this.prisma.beneficiary.findUnique({ where: { id: beneficiaryId } });
        if (!bene) throw new Error("Beneficiary not found");
        const { data } = await axios.post(
          "https://api.paystack.co/transferrecipient",
          { type: "nuban", name: bene.accountName, account_number: bene.accountNumber, bank_code: bene.bankCode, currency: "NGN" },
          { headers: { Authorization: `Bearer ${paystackSecret}` } },
        );
        recipientCode = data.data.recipient_code;
        await this.prisma.beneficiary.update({ where: { id: beneficiaryId }, data: { paystackRecipientCode: recipientCode } });
      }

      const { data } = await axios.post(
        "https://api.paystack.co/transfer",
        { source: "balance", amount: amount * 100, recipient: recipientCode, reference: internalRef },
        { headers: { Authorization: `Bearer ${paystackSecret}` } },
      );

      await this.prisma.transaction.updateMany({
        where: { internalRef },
        data:  { status: "pending", paystackReference: data.data.reference, paystackTransferId: String(data.data.id), processedAt: new Date() },
      });

      await this.prisma.bulkBatch.update({
        where: { id: batchId },
        data:  { successCount: { increment: 1 } },
      });
    } catch (err: any) {
      await this.prisma.transaction.updateMany({
        where: { internalRef },
        data:  { status: "failed", failureReason: err.message },
      });
      await this.prisma.bulkBatch.update({
        where: { id: batchId },
        data:  { failedCount: { increment: 1 } },
      });
      throw err;
    }
  }

  // ── 24h reminder before a payment ────────────────────────────────────────
  @Process("payment-reminder")
  async handleReminder(job: Job<{ scheduleId: string }>) {
    const sch = await this.prisma.paymentSchedule.findUnique({
      where:   { id: job.data.scheduleId },
      include: { beneficiary: { select: { name: true } } },
    });
    if (!sch || sch.status !== "active") return;

    await this.prisma.alert.create({
      data: {
        userId:     sch.userId,
        type:       "warn",
        title:      "🔔 Payment Tomorrow",
        message:    `₦${Number(sch.amount).toLocaleString()} to ${sch.beneficiary.name} is due tomorrow. Ensure sufficient balance.`,
        scheduleId: sch.id,
      },
    });

    this.logger.log(`Reminder sent for schedule ${job.data.scheduleId}`);
  }

  // ── Queue lifecycle hooks ─────────────────────────────────────────────────
  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts: ${err.message}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.debug(`Job ${job.id} (${job.name}) completed`);
  }
}

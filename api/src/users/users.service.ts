import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from "@nestjs/common";
import * as bcrypt          from "bcrypt";
import { PrismaService }   from "../common/prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { LinkBankDto }      from "./dto/link-bank.dto";
import axios                from "axios";
import { v4 as uuid }       from "uuid";
import { ConfigService }    from "@nestjs/config";

// ── Constants ─────────────────────────────────────────────────────────────────
const LINKING_FEE_KOBO = 5_000;   // ₦50 in kobo
const LINKING_FEE_NAIRA = 50;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  private get paystackSecret() {
    return this.config.get<string>("PAYSTACK_SECRET_KEY")!;
  }

  // ── Profile ───────────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where:  { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        plan: true, planExpiresAt: true, betaAccess: true,
        linkingFeePaid: true,
        settings: true, createdAt: true, lastLoginAt: true,
        _count: {
          select: { beneficiaries: true, schedules: true, transactions: true },
        },
      },
    });
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where:  { id: userId },
      data:   { name: dto.name, phone: dto.phone },
      select: { id: true, name: true, email: true, phone: true, updatedAt: true },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: "UPDATE_PROFILE", entity: "User", entityId: userId },
    });
    return user;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data:  { settings: dto as any },
      select: { id: true, settings: true },
    });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    if (newPassword.length < 8) throw new BadRequestException("Password must be at least 8 characters");
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException("Current password is incorrect");
    }
    const hash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { userId, action: "CHANGE_PASSWORD" } });
    return { message: "Password updated. Please log in again." };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
    await this.prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { userId, action: "DELETE_ACCOUNT" } });
    return { message: "Account deactivated" };
  }

  // ── Linked Bank Accounts ──────────────────────────────────────────────────
  async getLinkedAccounts(userId: string) {
    return this.prisma.linkedBankAccount.findMany({
      where:   { userId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  /**
   * STEP 1 — Initiate the ₦50 card linking fee.
   *
   * Creates a Paystack transaction, returns a checkout URL the mobile app
   * opens in a browser/WebView. The user pays with their card.
   * On success, Paystack hits the webhook → completeLinkAfterFee() is called.
   *
   * The bank account details (accountNumber, bankCode, bankName) are stored
   * in Paystack's metadata so the webhook can complete the linking.
   */
  async initiateLinkFee(userId: string, dto: LinkBankDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });

    // Check for duplicate before charging
    const existing = await this.prisma.linkedBankAccount.findFirst({
      where: { userId, accountNumber: dto.accountNumber, bankCode: dto.bankCode, deletedAt: null },
    });
    if (existing) throw new ConflictException("This account is already linked.");

    // Verify the account name via Paystack before charging the fee
    let accountName: string;
    try {
      const { data } = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${dto.accountNumber}&bank_code=${dto.bankCode}`,
        { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
      );
      accountName = data.data.account_name;
    } catch {
      throw new BadRequestException("Could not verify account. Please check the details.");
    }

    const callbackUrl = this.config.get<string>("PAYSTACK_CALLBACK_URL") ??
      "https://autopay-platform.netlify.app/account-linked";

    const reference = `AUTOPAY-LINK-${uuid().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    // Initialize Paystack transaction
    const { data } = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email:        user.email,
        amount:       LINKING_FEE_KOBO,          // ₦50 in kobo
        currency:     "NGN",
        reference,
        callback_url: callbackUrl,
        metadata: {
          autopay_action:   "LINK_BANK",
          autopay_user_id:  userId,
          account_number:   dto.accountNumber,
          bank_code:        dto.bankCode,
          bank_name:        dto.bankName,
          account_name:     accountName,
          cancel_action:    "discard",
        },
        channels: ["card"],   // card only — no bank transfer for this charge
      },
      { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
    );

    await this.prisma.auditLog.create({
      data: { userId, action: "INITIATE_LINK_FEE", entity: "User", entityId: userId },
    });

    return {
      reference,
      checkoutUrl:  data.data.authorization_url,
      accountName,
      fee:          LINKING_FEE_NAIRA,
      message:      `Pay ₦${LINKING_FEE_NAIRA} to link your account. Your card will also be saved to collect future service fees.`,
    };
  }

  /**
   * STEP 2 — Called by the Paystack webhook after the ₦50 charge succeeds.
   *
   * - Stores the card authorization_code on the user (used for future 0.1% fees)
   * - Creates the LinkedBankAccount record
   * - Marks linkingFeePaid = true on the user
   */
  async completeLinkAfterFee(payload: {
    reference:      string;
    authCode:       string;
    cardEmail:      string;
    cardLast4:      string;
    cardBin:        string;
    cardExpMonth:   string;
    cardExpYear:    string;
    userId:         string;
    accountNumber:  string;
    bankCode:       string;
    bankName:       string;
    accountName:    string;
  }) {
    const {
      reference, authCode, cardEmail, cardLast4, cardBin,
      cardExpMonth, cardExpYear, userId,
      accountNumber, bankCode, bankName, accountName,
    } = payload;

    // Guard: don't double-link if webhook fires twice
    const duplicate = await this.prisma.linkedBankAccount.findFirst({
      where: { userId, accountNumber, bankCode, deletedAt: null },
    });
    if (duplicate) return duplicate;

    const count = await this.prisma.linkedBankAccount.count({
      where: { userId, deletedAt: null },
    });

    // Save card auth on user for future fee collection
    await this.prisma.user.update({
      where: { id: userId },
      data:  {
        cardAuthCode:   authCode,
        cardEmail,
        linkingFeePaid: true,
      },
    });

    // Create the linked bank account
    const account = await this.prisma.linkedBankAccount.create({
      data: {
        userId,
        bankName,
        bankCode,
        accountNumber,
        accountName,
        paystackAuthCode:    authCode,
        paystackCardBin:     cardBin,
        paystackLast4:       cardLast4,
        paystackExpMonth:    cardExpMonth,
        paystackExpYear:     cardExpYear,
        paystackChannelType: "card",
        linkingFeeRef:       reference,
        linkingFeePaid:      true,
        isDefault:           count === 0,
        isVerified:          true,
        verifiedAt:          new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        userId,
        action:   "LINK_BANK_COMPLETE",
        entity:   "LinkedBankAccount",
        entityId: account.id,
      },
    });

    // Notify user
    await this.prisma.alert.create({
      data: {
        userId,
        type:    "success",
        title:   "✅ Account Linked",
        message: `Your ${bankName} account ending in ${accountNumber.slice(-4)} has been linked successfully.`,
      },
    });

    return account;
  }

  async setDefaultAccount(userId: string, accountId: string) {
    await this.prisma.linkedBankAccount.updateMany({
      where: { userId },
      data:  { isDefault: false },
    });
    return this.prisma.linkedBankAccount.update({
      where: { id: accountId, userId } as any,
      data:  { isDefault: true },
    });
  }

  async unlinkBankAccount(userId: string, accountId: string) {
    const has = await this.prisma.paymentSchedule.count({
      where: { sourceAccountId: accountId, status: "active" },
    });
    if (has) throw new BadRequestException("This account has active schedules. Cancel them first.");
    await this.prisma.linkedBankAccount.update({
      where: { id: accountId },
      data:  { deletedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: "UNLINK_BANK", entity: "LinkedBankAccount", entityId: accountId },
    });
    return { message: "Account unlinked" };
  }

  // ── Paystack customer creation (idempotent) ───────────────────────────────
  async ensurePaystackCustomer(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.paystackCustomerCode) return { customerCode: user.paystackCustomerCode };

    const { data } = await axios.post(
      "https://api.paystack.co/customer",
      {
        email:      user.email,
        first_name: user.name.split(" ")[0],
        last_name:  user.name.split(" ").slice(1).join(" ") || "—",
        phone:      user.phone,
      },
      { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
    );
    await this.prisma.user.update({
      where: { id: userId },
      data:  {
        paystackCustomerCode: data.data.customer_code,
        paystackCustomerId:   String(data.data.id),
      },
    });
    return { customerCode: data.data.customer_code };
  }
}

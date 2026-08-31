import { getPlanLimits, effectivePlan } from "../plans/plans.constants";
import {
  Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException
} from "@nestjs/common";
import * as bcrypt          from "bcrypt";
import { PrismaService }   from "../common/prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import axios                from "axios";
import { v4 as uuid }       from "uuid";
import { ConfigService }    from "@nestjs/config";

const LINKING_FEE_KOBO  = 5_000;   // ₦50 in kobo
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
    return this.prisma.user.findUniqueOrThrow({
      where:  { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        plan: true, planExpiresAt: true, betaAccess: true,
        linkingFeePaid: true,
        settings: true, createdAt: true, lastLoginAt: true,
        _count: { select: { beneficiaries: true, schedules: true, transactions: true } },
      },
    });
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
      where:  { id: userId },
      data:   { settings: dto as any },
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
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    });
    await this.prisma.auditLog.create({ data: { userId, action: "CHANGE_PASSWORD" } });
    return { message: "Password updated. Please log in again." };
  }

  async deleteAccount(userId: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
    await this.prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await this.prisma.auditLog.create({ data: { userId, action: "DELETE_ACCOUNT" } });
    return { message: "Account deactivated" };
  }

  // ── Linked Accounts ───────────────────────────────────────────────────────
  async getLinkedAccounts(userId: string) {
    return this.prisma.linkedBankAccount.findMany({
      where:   { userId, deletedAt: null },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });
  }

  /**
   * Initiate card linking.
   *
   * Creates a ₦50 Paystack card-only transaction and returns the
   * checkout URL. The mobile app opens this in a browser.
   * No bank details are needed — Paystack returns the card's
   * bank information in the charge.success webhook.
   */
  async initiateLinkFee(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // ── Plan limit check ─────────────────────────────────────────────────────────
    const plan   = effectivePlan(user.plan, user.planExpiresAt);
    const limits = getPlanLimits(plan);

    const linkedCount = await this.prisma.linkedBankAccount.count({
      where: { userId, deletedAt: null },
    });

    if (limits.maxLinkedAccounts !== Infinity && linkedCount >= limits.maxLinkedAccounts) {
      throw new ForbiddenException(
        `Your ${plan} plan supports up to ${limits.maxLinkedAccounts} linked card${limits.maxLinkedAccounts === 1 ? "" : "s"}. ` +
        `Upgrade to Personal for up to 3 cards, or Business for unlimited.`
      );
    }
    // ── End plan limit check ─────────────────────────────────────────────────────
    const callbackUrl = this.config.get<string>("PAYSTACK_CALLBACK_URL") ??
      "https://autopay-platform.netlify.app/account-linked";

    const reference = `AUTOPAY-LINK-${uuid().replace(/-/g, "").slice(0, 16).toUpperCase()}`;

    const { data } = await axios.post(
      "https://api.paystack.co/transaction/initialize",
      {
        email:        user.email,
        amount:       LINKING_FEE_KOBO,
        currency:     "NGN",
        reference,
        callback_url: callbackUrl,
        metadata: {
          autopay_action:  "LINK_BANK",
          autopay_user_id: userId,
        },
        // Card only — user pays with their debit card.
        // Paystack returns the card's bank and account info in the webhook.
        channels: ["card"],
      },
      { headers: { Authorization: `Bearer ${this.paystackSecret}` } },
    );

    await this.prisma.auditLog.create({
      data: { userId, action: "INITIATE_LINK_FEE", entity: "User", entityId: userId },
    });

    return {
      reference,
      checkoutUrl: data.data.authorization_url,
      fee:         LINKING_FEE_NAIRA,
      message:     `Pay ₦${LINKING_FEE_NAIRA} with your debit card to link it to AutoPay.`,
    };
  }

  /**
   * Called by the Paystack webhook after the ₦50 card charge succeeds.
   *
   * Paystack returns the card's authorization object which contains
   * the bank name, card bin, last4, and — for Verve cards — the
   * linked account details. We store the authorization_code for
   * future scheduled payment debits.
   */
  async completeLinkAfterFee(payload: {
    reference:    string;
    authCode:     string;
    cardEmail:    string;
    cardLast4:    string;
    cardBin:      string;
    cardBank:     string;        // bank name as returned by Paystack
    cardType:     string;        // visa | mastercard | verve
    cardExpMonth: string;
    cardExpYear:  string;
    userId:       string;
    accountName:  string;        // cardholder name from Paystack
  }) {
    const {
      reference, authCode, cardEmail, cardLast4, cardBin,
      cardBank, cardType, cardExpMonth, cardExpYear,
      userId, accountName,
    } = payload;

    // Guard against duplicate webhook delivery
    const duplicate = await this.prisma.linkedBankAccount.findFirst({
      where: { userId, paystackAuthCode: authCode, deletedAt: null },
    });
    if (duplicate) return duplicate;

    const count = await this.prisma.linkedBankAccount.count({
      where: { userId, deletedAt: null },
    });

    // Store card auth on the user — used for every scheduled payment debit
    await this.prisma.user.update({
      where: { id: userId },
      data:  {
        cardAuthCode:   authCode,
        cardEmail,
        linkingFeePaid: true,
      },
    });

    // Create a LinkedBankAccount record using the card's bank information.
    // accountNumber is the masked card number (bin + **** + last4) since
    // we are linking a card, not a NUBAN bank account.
    const maskedCard = `${cardBin}****${cardLast4}`;

    const account = await this.prisma.linkedBankAccount.create({
      data: {
        userId,
        bankName:            cardBank,
        bankCode:            cardBin,           // bin used as proxy for bank code
        accountNumber:       maskedCard,
        accountName,
        paystackAuthCode:    authCode,
        paystackCardBin:     cardBin,
        paystackLast4:       cardLast4,
        paystackExpMonth:    cardExpMonth,
        paystackExpYear:     cardExpYear,
        paystackChannelType: cardType,          // visa | mastercard | verve
        linkingFeeRef:       reference,
        linkingFeePaid:      true,
        isDefault:           count === 0,
        isVerified:          true,
        verifiedAt:          new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: "LINK_CARD_COMPLETE", entity: "LinkedBankAccount", entityId: account.id },
    });

    await this.prisma.alert.create({
      data: {
        userId,
        type:    "success",
        title:   "✅ Card Linked",
        message: `Your ${cardBank} card ending in ${cardLast4} has been linked. AutoPay will use this card for scheduled payments.`,
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
      where: { id: accountId } as any,
      data:  { isDefault: true },
    });
  }

  async unlinkBankAccount(userId: string, accountId: string) {
    const hasActive = await this.prisma.paymentSchedule.count({
      where: { sourceAccountId: accountId, status: "active" },
    });
    if (hasActive) throw new BadRequestException("This card has active schedules. Cancel them first.");
    await this.prisma.linkedBankAccount.update({
      where: { id: accountId },
      data:  { deletedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: "UNLINK_CARD", entity: "LinkedBankAccount", entityId: accountId },
    });
    return { message: "Card unlinked" };
  }

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

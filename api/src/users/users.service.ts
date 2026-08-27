import {
  Injectable, NotFoundException, ConflictException, BadRequestException, Logger,
} from "@nestjs/common";
import * as bcrypt          from "bcrypt";
import { PrismaService }   from "../common/prisma/prisma.service";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UpdateSettingsDto } from "./dto/update-settings.dto";
import { LinkBankDto }      from "./dto/link-bank.dto";
import axios                from "axios";
import { ConfigService }    from "@nestjs/config";

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  // ── Profile ───────────────────────────────────────────────────────────────
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where:  { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true,
        plan: true, planExpiresAt: true, betaAccess: true,
        settings: true, createdAt: true, lastLoginAt: true,
        pin: true,
        _count: {
          select: { beneficiaries: true, schedules: true, transactions: true },
        },
      },
    });
    const { pin, ...safeUser } = user;
    return { ...safeUser, hasPin: !!pin };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.update({
      where:  { id: userId },
      data:   {
        name:  dto.name,
        phone: dto.phone,
      },
      select: { id: true, name: true, email: true, phone: true, updatedAt: true },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: "UPDATE_PROFILE", entity: "User", entityId: userId },
    });
    return user;
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data:  { settings: dto as any },
      select: { id: true, settings: true },
    });
    return user;
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
    await this.prisma.user.update({
      where: { id: userId },
      data:  { deletedAt: new Date() },
    });
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

  async linkBankAccount(userId: string, dto: LinkBankDto) {
    const paystackSecret = this.config.get("PAYSTACK_SECRET_KEY");

    // Verify account via Paystack name-enquiry
    let accountName: string;
    try {
      const { data } = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${dto.accountNumber}&bank_code=${dto.bankCode}`,
        { headers: { Authorization: `Bearer ${paystackSecret}` } },
      );
      accountName = data.data.account_name;
    } catch {
      throw new BadRequestException("Could not verify account. Please check the details.");
    }

    // Check for duplicate
    const existing = await this.prisma.linkedBankAccount.findFirst({
      where: { userId, accountNumber: dto.accountNumber, bankCode: dto.bankCode, deletedAt: null },
    });
    if (existing) throw new ConflictException("This account is already linked");

    // If first account, make default
    const count = await this.prisma.linkedBankAccount.count({ where: { userId, deletedAt: null } });

    const account = await this.prisma.linkedBankAccount.create({
      data: {
        userId,
        bankName:      dto.bankName,
        bankCode:      dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName,
        isDefault:   count === 0,
        // isVerified here means "Paystack confirmed this account number+bank code
        // resolves to a real account name" — NOT that direct debit is authorised.
        // That only happens once mandateStatus reaches "active" below.
        isVerified:  true,
        verifiedAt:  new Date(),
        paystackChannelType: "bank_account",
        mandateStatus: "none",
      },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: "LINK_BANK", entity: "LinkedBankAccount", entityId: account.id },
    });

    return account;
  }

  async setDefaultAccount(userId: string, accountId: string) {
    await this.prisma.linkedBankAccount.updateMany({
      where: { userId },
      data:  { isDefault: false },
    });
    const account = await this.prisma.linkedBankAccount.update({
      where: { id: accountId, userId } as any,
      data:  { isDefault: true },
    });
    return account;
  }

  async unlinkBankAccount(userId: string, accountId: string) {
    const has = await this.prisma.paymentSchedule.count({
      where: { sourceAccountId: accountId, status: "active" },
    });
    if (has) throw new BadRequestException("This account has active schedules. Cancel them first.");

    const account = await this.prisma.linkedBankAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) throw new NotFoundException("Account not found");

    // If a direct debit mandate is active, deactivate it on Paystack's side too
    if (account.paystackAuthCode) {
      try {
        await axios.post(
          "https://api.paystack.co/customer/authorization/deactivate",
          { authorization_code: account.paystackAuthCode },
          { headers: { Authorization: `Bearer ${this.config.get("PAYSTACK_SECRET_KEY")}` } },
        );
      } catch {
        // Non-fatal — log and continue unlinking locally even if Paystack call fails
        this.logger.warn(`Could not deactivate Paystack authorization for account ${accountId}`);
      }
    }

    await this.prisma.linkedBankAccount.update({
      where: { id: accountId },
      data:  { deletedAt: new Date() },
    });
    await this.prisma.auditLog.create({
      data: { userId, action: "UNLINK_BANK", entity: "LinkedBankAccount", entityId: accountId },
    });
    return { message: "Account unlinked" };
  }

  // ── Direct Debit mandate ──────────────────────────────────────────────────
  // Step 1: kick off the mandate authorization request. Returns a redirect_url
  // that the mobile app must open (in-app browser / WebView) so the customer
  // can give consent on their bank's flow.
  async initializeDirectDebit(userId: string, accountId: string) {
    const account = await this.prisma.linkedBankAccount.findFirst({ where: { id: accountId, userId, deletedAt: null } });
    if (!account) throw new NotFoundException("Linked account not found");
    if (account.mandateStatus === "active") {
      throw new BadRequestException("This account is already authorised for direct debit");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const paystackSecret = this.config.get("PAYSTACK_SECRET_KEY");
    const appCallbackUrl = this.config.get("DIRECT_DEBIT_CALLBACK_URL", "https://frangipanigroup.com.ng/autopay/direct-debit-callback");

    let data: any;
    try {
      const res = await axios.post(
        "https://api.paystack.co/customer/authorization/initialize",
        {
          email:        user.email,
          channel:      "direct_debit",
          callback_url: appCallbackUrl,
          account: {
            number:    account.accountNumber,
            bank_code: account.bankCode,
          },
        },
        { headers: { Authorization: `Bearer ${paystackSecret}` } },
      );
      data = res.data.data;
    } catch (err: any) {
      const message = err.response?.data?.message ?? "Could not start direct debit authorization";
      throw new BadRequestException(message);
    }

    await this.prisma.linkedBankAccount.update({
      where: { id: accountId },
      data:  { mandateReference: data.reference, mandateStatus: "pending" },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: "DIRECT_DEBIT_INITIALIZE", entity: "LinkedBankAccount", entityId: accountId },
    });

    return { redirectUrl: data.redirect_url, reference: data.reference };
  }

  // Step 2: poll this after the customer returns from the bank consent flow
  // (or rely on the direct_debit.authorization.* webhooks — see webhook.controller.ts).
  async checkDirectDebitStatus(userId: string, accountId: string) {
    const account = await this.prisma.linkedBankAccount.findFirst({ where: { id: accountId, userId, deletedAt: null } });
    if (!account) throw new NotFoundException("Linked account not found");
    if (!account.mandateReference) {
      return { mandateStatus: account.mandateStatus, active: false };
    }
    // If a webhook already marked this active, no need to call Paystack again
    if (account.mandateStatus === "active") {
      return { mandateStatus: "active", active: true };
    }

    const paystackSecret = this.config.get("PAYSTACK_SECRET_KEY");
    try {
      const { data } = await axios.get(
        `https://api.paystack.co/customer/authorization/verify/${account.mandateReference}`,
        { headers: { Authorization: `Bearer ${paystackSecret}` } },
      );
      const isActive = data.data.active === true;
      await this.prisma.linkedBankAccount.update({
        where: { id: accountId },
        data: {
          mandateStatus:    isActive ? "active" : "created",
          paystackAuthCode: data.data.authorization_code ?? account.paystackAuthCode,
        },
      });
      return { mandateStatus: isActive ? "active" : "created", active: isActive };
    } catch (err: any) {
      if (err.response?.status === 404) {
        // Not yet approved by the customer
        return { mandateStatus: "pending", active: false };
      }
      throw new BadRequestException("Could not check authorization status. Please try again.");
    }
  }

  // ── Paystack customer creation (idempotent) ───────────────────────────────
  async ensurePaystackCustomer(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.paystackCustomerCode) return { customerCode: user.paystackCustomerCode };

    const paystackSecret = this.config.get("PAYSTACK_SECRET_KEY");
    const { data } = await axios.post(
      "https://api.paystack.co/customer",
      { email: user.email, first_name: user.name.split(" ")[0], last_name: user.name.split(" ").slice(1).join(" ") || "—", phone: user.phone },
      { headers: { Authorization: `Bearer ${paystackSecret}` } },
    );
    await this.prisma.user.update({
      where: { id: userId },
      data:  { paystackCustomerCode: data.data.customer_code, paystackCustomerId: String(data.data.id) },
    });
    return { customerCode: data.data.customer_code };
  }
}

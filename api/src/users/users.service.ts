import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
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
        isVerified:  true,
        verifiedAt:  new Date(),
        paystackChannelType: "bank_account",
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

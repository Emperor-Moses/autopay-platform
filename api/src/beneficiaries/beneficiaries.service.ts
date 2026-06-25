import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from "@nestjs/common";
import { ConfigService }          from "@nestjs/config";
import axios                      from "axios";
import { PrismaService }          from "../common/prisma/prisma.service";
import { CreateBeneficiaryDto }   from "./dto/beneficiaries.dto";
import { UpdateBeneficiaryDto }   from "./dto/beneficiaries.dto";

@Injectable()
export class BeneficiariesService {
  constructor(
    private readonly prisma:  PrismaService,
    private readonly config:  ConfigService,
  ) {}

  async findAll(userId: string) {
    return this.prisma.beneficiary.findMany({
      where:   { userId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { schedules: true, transactions: true } },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const bene = await this.prisma.beneficiary.findFirst({
      where:   { id, userId, deletedAt: null },
      include: {
        schedules: {
          where:   { status: "active" },
          select:  { id: true, type: true, amount: true, frequency: true, nextRunAt: true },
        },
        transactions: {
          orderBy: { initiatedAt: "desc" },
          take:    5,
          select:  { id: true, amount: true, status: true, initiatedAt: true, type: true },
        },
      },
    });
    if (!bene) throw new NotFoundException("Recipient not found");
    return bene;
  }

  async create(userId: string, dto: CreateBeneficiaryDto) {
    const paystackSecret = this.config.get("PAYSTACK_SECRET_KEY");

    // Check duplicate
    const existing = await this.prisma.beneficiary.findFirst({
      where: { userId, accountNumber: dto.accountNumber, bankCode: dto.bankCode, deletedAt: null },
    });
    if (existing) throw new ConflictException("This recipient already exists");

    // Verify via Paystack name-enquiry
    let accountName: string;
    try {
      const { data } = await axios.get(
        `https://api.paystack.co/bank/resolve?account_number=${dto.accountNumber}&bank_code=${dto.bankCode}`,
        { headers: { Authorization: `Bearer ${paystackSecret}` } },
      );
      accountName = data.data.account_name;
    } catch {
      throw new BadRequestException("Could not verify account. Please check account number and bank.");
    }

    // Create Paystack transfer recipient
    let paystackRecipientCode: string | undefined;
    let paystackRecipientId: number | undefined;
    try {
      const { data } = await axios.post(
        "https://api.paystack.co/transferrecipient",
        {
          type:           "nuban",
          name:           accountName,
          account_number: dto.accountNumber,
          bank_code:      dto.bankCode,
          currency:       "NGN",
        },
        { headers: { Authorization: `Bearer ${paystackSecret}` } },
      );
      paystackRecipientCode = data.data.recipient_code;
      paystackRecipientId   = data.data.id;
    } catch {
      // Non-fatal — recipient can be created later during payment
    }

    const bene = await this.prisma.beneficiary.create({
      data: {
        userId,
        name:         dto.name,
        bank:         dto.bank,
        bankCode:     dto.bankCode,
        accountNumber: dto.accountNumber,
        accountName,
        nickname:     dto.nickname,
        email:        dto.email,
        phone:        dto.phone,
        note:         dto.note,
        isVerified:   true,
        verifiedAt:   new Date(),
        paystackRecipientCode,
        paystackRecipientId: paystackRecipientId ? String(paystackRecipientId) : undefined,
      },
    });

    await this.prisma.auditLog.create({
      data: { userId, action: "ADD_BENEFICIARY", entity: "Beneficiary", entityId: bene.id },
    });

    return bene;
  }

  async update(userId: string, id: string, dto: UpdateBeneficiaryDto) {
    const bene = await this.prisma.beneficiary.findFirst({ where: { id, userId, deletedAt: null } });
    if (!bene) throw new NotFoundException("Recipient not found");

    return this.prisma.beneficiary.update({
      where: { id },
      data:  { name: dto.name, nickname: dto.nickname, email: dto.email, phone: dto.phone, note: dto.note },
    });
  }

  async remove(userId: string, id: string) {
    const bene = await this.prisma.beneficiary.findFirst({ where: { id, userId, deletedAt: null } });
    if (!bene) throw new NotFoundException("Recipient not found");

    const activeSchedules = await this.prisma.paymentSchedule.count({
      where: { beneficiaryId: id, status: "active" },
    });
    if (activeSchedules > 0) {
      throw new BadRequestException("This recipient has active payment schedules. Cancel them first.");
    }

    await this.prisma.beneficiary.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.prisma.auditLog.create({
      data: { userId, action: "REMOVE_BENEFICIARY", entity: "Beneficiary", entityId: id },
    });
    return { message: "Recipient removed" };
  }
}

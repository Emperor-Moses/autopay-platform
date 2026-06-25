/**
 * AutoPay — Database Seed
 * Run: npx prisma db seed
 */
import { PrismaClient, PaymentType, Frequency } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱  Seeding AutoPay database…");

  // ── Demo user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);
  const pinHash      = await bcrypt.hash("0000", 12);   // default demo PIN

  const user = await prisma.user.upsert({
    where: { email: "demo@autopay.ng" },
    update: {},
    create: {
      name:         "Amaka Okonkwo",
      email:        "demo@autopay.ng",
      passwordHash,
      pin:          pinHash,
      phone:        "+2348012345678",
      plan:         "personal",
      betaAccess:   true,
      settings:     { reminders: true, balance: true, confirmations: true },
    },
  });
  console.log(`  ✅  User: ${user.email}`);

  // ── Linked bank account ───────────────────────────────────────────────────
  const bank = await prisma.linkedBankAccount.upsert({
    where: { id: "seed-bank-01" },
    update: {},
    create: {
      id:            "seed-bank-01",
      userId:        user.id,
      bankName:      "GTBank",
      bankCode:      "058",
      accountNumber: "0123456789",
      accountName:   "AMAKA OKONKWO",
      isDefault:     true,
      isVerified:    true,
      verifiedAt:    new Date(),
    },
  });
  console.log(`  ✅  Bank: ${bank.bankName} ····${bank.accountNumber.slice(-4)}`);

  // ── Beneficiaries ─────────────────────────────────────────────────────────
  const beneficiariesData = [
    { name: "Chidi Landlord",     bank: "Access Bank",   bankCode: "044", accountNumber: "0987654321", accountName: "CHIDI EZE" },
    { name: "EEDC",               bank: "Zenith Bank",   bankCode: "057", accountNumber: "1122334455", accountName: "ENUGU ELECTRICITY DIST COMPANY" },
    { name: "Mrs Ngozi (Nanny)",  bank: "First Bank",    bankCode: "011", accountNumber: "2233445566", accountName: "NGOZI ADAEZE OKAFOR" },
    { name: "Covenant School",    bank: "UBA",           bankCode: "033", accountNumber: "3344556677", accountName: "COVENANT ACADEMY LTD" },
  ];

  const beneficiaries = [];
  for (const b of beneficiariesData) {
    const bene = await prisma.beneficiary.upsert({
      where: { userId_accountNumber_bankCode: { userId: user.id, accountNumber: b.accountNumber, bankCode: b.bankCode } },
      update: {},
      create: { userId: user.id, isVerified: true, verifiedAt: new Date(), ...b },
    });
    beneficiaries.push(bene);
  }
  console.log(`  ✅  ${beneficiaries.length} beneficiaries seeded`);

  // ── Payment schedules ─────────────────────────────────────────────────────
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  nextMonth.setDate(1);

  const schedulesData = [
    { beneficiaryId: beneficiaries[0].id, type: PaymentType.Rent,         amount: 150000, frequency: Frequency.monthly,  note: "Monthly apartment rent" },
    { beneficiaryId: beneficiaries[1].id, type: PaymentType.Utilities,    amount: 25000,  frequency: Frequency.monthly,  note: "EEDC prepaid top-up" },
    { beneficiaryId: beneficiaries[2].id, type: PaymentType.Staff,        amount: 40000,  frequency: Frequency.monthly,  note: "Nanny salary" },
    { beneficiaryId: beneficiaries[3].id, type: PaymentType.School,       amount: 80000,  frequency: Frequency.quarterly, note: "School fees — Term 2" },
  ];

  for (const s of schedulesData) {
    await prisma.paymentSchedule.create({
      data: {
        userId:           user.id,
        sourceAccountId:  bank.id,
        currency:         "NGN",
        status:           "active",
        nextRunAt:        nextMonth,
        startDate:        new Date(),
        ...s,
      },
    });
  }
  console.log(`  ✅  ${schedulesData.length} schedules seeded`);

  // ── Welcome alert ─────────────────────────────────────────────────────────
  await prisma.alert.create({
    data: {
      userId:  user.id,
      type:    "info",
      title:   "🎉 Welcome to AutoPay Beta",
      message: "Your account is set up. You have 3 months of Personal plan free. Start by linking your bank and adding your first payment schedule.",
      isRead:  false,
    },
  });
  console.log("  ✅  Welcome alert created");
  console.log("\n✨  Seed complete! Demo credentials: demo@autopay.ng / password123 · PIN: 0000");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

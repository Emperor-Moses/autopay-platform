-- AlterTable
ALTER TABLE "linked_bank_accounts" ADD COLUMN     "linkingFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkingFeeRef" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "feeAmount" DECIMAL(18,2),
ADD COLUMN     "feeRef" TEXT,
ADD COLUMN     "feeStatus" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "cardAuthCode" TEXT,
ADD COLUMN     "cardEmail" TEXT,
ADD COLUMN     "linkingFeePaid" BOOLEAN NOT NULL DEFAULT false;

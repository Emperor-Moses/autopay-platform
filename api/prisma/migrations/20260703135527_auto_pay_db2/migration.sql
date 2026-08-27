/*
  Warnings:

  - A unique constraint covering the columns `[mandateReference]` on the table `linked_bank_accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[chargeReference]` on the table `transactions` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "linked_bank_accounts" ADD COLUMN     "mandateReference" TEXT,
ADD COLUMN     "mandateStatus" TEXT NOT NULL DEFAULT 'none';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "chargeReference" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "linked_bank_accounts_mandateReference_key" ON "linked_bank_accounts"("mandateReference");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_chargeReference_key" ON "transactions"("chargeReference");

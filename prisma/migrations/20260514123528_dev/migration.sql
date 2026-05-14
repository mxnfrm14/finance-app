/*
  Warnings:

  - A unique constraint covering the columns `[userId,slug]` on the table `Broker` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,isin,accountType,brokerId]` on the table `Position` will be added. If there are existing duplicate values, this will fail.
  - Made the column `userId` on table `Broker` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Broker" DROP CONSTRAINT "Broker_userId_fkey";

-- DropIndex
DROP INDEX "Broker_slug_key";

-- AlterTable
ALTER TABLE "Broker" ALTER COLUMN "userId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Broker_userId_idx" ON "Broker"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Broker_userId_slug_key" ON "Broker"("userId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_isin_accountType_brokerId_key" ON "Position"("userId", "isin", "accountType", "brokerId");

-- AddForeignKey
ALTER TABLE "Broker" ADD CONSTRAINT "Broker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

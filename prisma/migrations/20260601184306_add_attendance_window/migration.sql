-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "acceptingUntil" TIMESTAMP(3),
ADD COLUMN     "windowMinutes" INTEGER NOT NULL DEFAULT 15;

-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('HARMATTAN', 'RAIN');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "semester" "Semester" NOT NULL DEFAULT 'HARMATTAN';

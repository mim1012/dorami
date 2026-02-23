-- CreateEnum
CREATE TYPE "notice_category" AS ENUM ('IMPORTANT', 'GENERAL');

-- AlterTable
ALTER TABLE "notices" ADD COLUMN "category" "notice_category" NOT NULL DEFAULT 'GENERAL';

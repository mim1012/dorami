-- AlterTable: Add phone field to User model
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;

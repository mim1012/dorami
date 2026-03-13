-- AlterTable
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "venmo_email" TEXT,
ADD COLUMN IF NOT EXISTS "venmo_recipient_name" TEXT;

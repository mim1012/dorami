-- AlterTable
ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "live_start_notification_enabled" BOOLEAN NOT NULL DEFAULT false;

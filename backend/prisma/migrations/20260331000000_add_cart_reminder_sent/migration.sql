-- AlterTable: Add reminder_sent column to carts
ALTER TABLE "carts" ADD COLUMN "reminder_sent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: For cron job sendCartReminders
CREATE INDEX "carts_status_timer_enabled_reminder_sent_expires_at_idx" ON "carts"("status", "timer_enabled", "reminder_sent", "expires_at");

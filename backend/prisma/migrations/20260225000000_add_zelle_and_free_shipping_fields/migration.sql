-- AlterTable
ALTER TABLE "system_config" ADD COLUMN "zelle_email" TEXT NOT NULL DEFAULT '',
ADD COLUMN "zelle_recipient_name" TEXT NOT NULL DEFAULT '',
ADD COLUMN "free_shipping_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add Zelle payment and free shipping toggle to system_config
-- Using IF NOT EXISTS to be safe (upstream may have already added zelle_* columns)
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "zelle_email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "zelle_recipient_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "free_shipping_enabled" BOOLEAN NOT NULL DEFAULT false;

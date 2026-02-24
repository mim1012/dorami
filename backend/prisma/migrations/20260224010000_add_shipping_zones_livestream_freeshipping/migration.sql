-- system_config: fix free_shipping_threshold (nullable → NOT NULL with default)
UPDATE "system_config" SET "free_shipping_threshold" = 150 WHERE "free_shipping_threshold" IS NULL;
ALTER TABLE "system_config" ALTER COLUMN "free_shipping_threshold" SET NOT NULL;
ALTER TABLE "system_config" ALTER COLUMN "free_shipping_threshold" SET DEFAULT 150;

-- system_config: add new columns
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "free_shipping_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "ca_shipping_fee" DECIMAL(10,2) NOT NULL DEFAULT 8;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "zelle_email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "zelle_recipient_name" TEXT NOT NULL DEFAULT '';

-- live_streams: add per-stream free shipping toggle
ALTER TABLE "live_streams" ADD COLUMN IF NOT EXISTS "free_shipping_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: Add global shipping settings to system_config
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "ca_shipping_fee" DECIMAL(10,2) NOT NULL DEFAULT 8;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "free_shipping_threshold" DECIMAL(10,2) NOT NULL DEFAULT 150;

-- Update existing default_shipping_fee from 3000 to 10 (USD)
UPDATE "system_config" SET "default_shipping_fee" = 10 WHERE "default_shipping_fee" = 3000;

-- AlterTable: Add free shipping toggle to live_streams
ALTER TABLE "live_streams" ADD COLUMN IF NOT EXISTS "free_shipping_enabled" BOOLEAN NOT NULL DEFAULT false;

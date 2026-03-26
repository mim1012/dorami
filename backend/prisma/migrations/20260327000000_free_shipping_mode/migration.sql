-- CreateEnum
CREATE TYPE "FreeShippingMode" AS ENUM ('DISABLED', 'UNCONDITIONAL', 'THRESHOLD');

-- Add new columns
ALTER TABLE "live_streams" ADD COLUMN "free_shipping_mode" "FreeShippingMode" NOT NULL DEFAULT 'DISABLED';
ALTER TABLE "live_streams" ADD COLUMN "free_shipping_threshold" DECIMAL(10,2);

-- Migrate existing data: freeShippingEnabled=true → THRESHOLD mode
UPDATE "live_streams" SET "free_shipping_mode" = 'THRESHOLD' WHERE "free_shipping_enabled" = true;

-- Drop old column
ALTER TABLE "live_streams" DROP COLUMN "free_shipping_enabled";

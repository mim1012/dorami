-- AlterTable (IF NOT EXISTS: staging DB에 이미 존재하는 경우 안전하게 처리)
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "free_shipping_threshold" DECIMAL(10,2) NOT NULL DEFAULT 150000;
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "free_shipping_enabled" BOOLEAN NOT NULL DEFAULT false;

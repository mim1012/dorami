-- AlterTable
ALTER TABLE "system_config" ADD COLUMN "free_shipping_threshold" DECIMAL(10,2) NOT NULL DEFAULT 150000;
ALTER TABLE "system_config" ADD COLUMN "free_shipping_enabled" BOOLEAN NOT NULL DEFAULT false;

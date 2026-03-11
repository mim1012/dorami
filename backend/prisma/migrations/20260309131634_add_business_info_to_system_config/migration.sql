-- AlterTable
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "business_address" TEXT,
ADD COLUMN IF NOT EXISTS "business_registration_number" TEXT,
ADD COLUMN IF NOT EXISTS "online_sales_registration_number" TEXT;

ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "venmo_email" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "venmo_recipient_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "business_registration_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "business_address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "system_config" ADD COLUMN IF NOT EXISTS "online_sales_registration_number" TEXT NOT NULL DEFAULT '';

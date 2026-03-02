-- Add CMS-like admin config sections to system_config table
ALTER TABLE "system_config"
  ADD COLUMN IF NOT EXISTS "home_featured_products" JSONB,
  ADD COLUMN IF NOT EXISTS "marketing_campaigns" JSONB,
  ADD COLUMN IF NOT EXISTS "payment_providers" JSONB;

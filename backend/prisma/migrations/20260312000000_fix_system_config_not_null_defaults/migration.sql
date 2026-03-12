-- Fix system_config columns that were added as nullable TEXT but must be NOT NULL
-- Update existing nulls to empty string before enforcing NOT NULL

UPDATE "system_config"
SET
  "venmo_email"                    = COALESCE("venmo_email", ''),
  "venmo_recipient_name"           = COALESCE("venmo_recipient_name", ''),
  "business_address"               = COALESCE("business_address", ''),
  "business_registration_number"   = COALESCE("business_registration_number", ''),
  "online_sales_registration_number" = COALESCE("online_sales_registration_number", '');

-- Enforce NOT NULL with default ''
ALTER TABLE "system_config"
  ALTER COLUMN "venmo_email"                      SET NOT NULL,
  ALTER COLUMN "venmo_email"                      SET DEFAULT '',
  ALTER COLUMN "venmo_recipient_name"             SET NOT NULL,
  ALTER COLUMN "venmo_recipient_name"             SET DEFAULT '',
  ALTER COLUMN "business_address"                 SET NOT NULL,
  ALTER COLUMN "business_address"                 SET DEFAULT '',
  ALTER COLUMN "business_registration_number"     SET NOT NULL,
  ALTER COLUMN "business_registration_number"     SET DEFAULT '',
  ALTER COLUMN "online_sales_registration_number" SET NOT NULL,
  ALTER COLUMN "online_sales_registration_number" SET DEFAULT '';

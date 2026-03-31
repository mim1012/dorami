-- AlterTable: Remove Solapi fields from system_config (migrated to Bizgo env vars)
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "solapi_api_key";
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "solapi_api_secret";
ALTER TABLE "system_config" DROP COLUMN IF EXISTS "kakao_channel_id";

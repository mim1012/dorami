-- AlterTable
ALTER TABLE "notification_templates" ADD COLUMN     "kakao_template_code" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "system_config" ADD COLUMN     "alimtalk_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kakao_channel_id" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "solapi_api_key" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "solapi_api_secret" TEXT NOT NULL DEFAULT '';

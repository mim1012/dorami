-- AlterTable: Drop phone column from users (replaced by kakao_phone for Alimtalk)
ALTER TABLE "users" DROP COLUMN IF EXISTS "phone";

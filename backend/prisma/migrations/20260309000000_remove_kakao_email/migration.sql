-- Remove kakao_email column from users table
-- Kakao email is no longer collected or used; service email is user-provided via profile registration.
ALTER TABLE "users" DROP COLUMN IF EXISTS "kakao_email";

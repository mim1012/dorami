-- AlterTable
ALTER TABLE "live_streams" ADD COLUMN "scheduled_at" TIMESTAMP(3),
                           ADD COLUMN "thumbnail_url" TEXT;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "orders_deleted_at_idx" ON "orders"("deleted_at");

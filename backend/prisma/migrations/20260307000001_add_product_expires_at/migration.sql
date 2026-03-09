-- AlterTable
ALTER TABLE "products" ADD COLUMN "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "products_expires_at_idx" ON "products"("expires_at");

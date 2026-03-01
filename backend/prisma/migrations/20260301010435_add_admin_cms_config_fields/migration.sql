-- AlterTable
ALTER TABLE "system_config" ALTER COLUMN "default_shipping_fee" SET DEFAULT 10;

-- CreateIndex
CREATE INDEX "chat_messages_is_deleted_timestamp_idx" ON "chat_messages"("is_deleted", "timestamp");

-- CreateIndex
CREATE INDEX "order_items_product_id_order_id_idx" ON "order_items"("product_id", "order_id");

-- CreateIndex
CREATE INDEX "orders_user_id_payment_status_idx" ON "orders"("user_id", "payment_status");

-- CreateIndex
CREATE INDEX "orders_status_payment_status_created_at_idx" ON "orders"("status", "payment_status", "created_at");

-- CreateIndex
CREATE INDEX "orders_payment_status_created_at_idx" ON "orders"("payment_status", "created_at");

-- CreateIndex
CREATE INDEX "orders_shipping_status_created_at_idx" ON "orders"("shipping_status", "created_at");

-- CreateIndex
CREATE INDEX "users_status_created_at_idx" ON "users"("status", "created_at");

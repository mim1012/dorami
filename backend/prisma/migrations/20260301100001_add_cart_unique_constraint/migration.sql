-- Add unique constraint to prevent duplicate active cart items for same product/variant
CREATE UNIQUE INDEX "carts_unique_active_item_idx" ON "carts"("user_id", "product_id", "color", "size") WHERE "status" = 'ACTIVE';

-- Add CHECK constraints to ensure quantities are positive
ALTER TABLE "products" ADD CONSTRAINT "products_quantity_positive_check" CHECK ("quantity" >= 0);
ALTER TABLE "carts" ADD CONSTRAINT "carts_quantity_positive_check" CHECK ("quantity" > 0);
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_quantity_positive_check" CHECK ("quantity" > 0);

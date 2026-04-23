-- Add delayed grouped ORDER_CONFIRMATION batching
ALTER TABLE "system_config"
ADD COLUMN "order_confirmation_delay_hours" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "OrderConfirmationBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

CREATE TABLE "order_confirmation_batches" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "stream_key" TEXT NOT NULL,
  "stream_id" TEXT,
  "status" "OrderConfirmationBatchStatus" NOT NULL DEFAULT 'PENDING',
  "scheduled_at" TIMESTAMP(3) NOT NULL,
  "sent_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "order_confirmation_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_confirmation_batch_orders" (
  "id" TEXT NOT NULL,
  "batch_id" TEXT NOT NULL,
  "order_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_confirmation_batch_orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_confirmation_batches_user_id_stream_key_key"
  ON "order_confirmation_batches"("user_id", "stream_key");

CREATE INDEX "order_confirmation_batches_status_scheduled_at_idx"
  ON "order_confirmation_batches"("status", "scheduled_at");

CREATE INDEX "order_confirmation_batches_stream_key_idx"
  ON "order_confirmation_batches"("stream_key");

CREATE UNIQUE INDEX "order_confirmation_batch_orders_batch_id_order_id_key"
  ON "order_confirmation_batch_orders"("batch_id", "order_id");

CREATE INDEX "order_confirmation_batch_orders_order_id_idx"
  ON "order_confirmation_batch_orders"("order_id");

ALTER TABLE "order_confirmation_batches"
ADD CONSTRAINT "order_confirmation_batches_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_confirmation_batches"
ADD CONSTRAINT "order_confirmation_batches_stream_id_fkey"
FOREIGN KEY ("stream_id") REFERENCES "live_streams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_confirmation_batch_orders"
ADD CONSTRAINT "order_confirmation_batch_orders_batch_id_fkey"
FOREIGN KEY ("batch_id") REFERENCES "order_confirmation_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_confirmation_batch_orders"
ADD CONSTRAINT "order_confirmation_batch_orders_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

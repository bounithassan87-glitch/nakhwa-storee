-- Space Seller fulfilment sync, recorded on the order.
--
-- Additive only: eight nullable columns and one index. No column is altered,
-- renamed or dropped, and no existing row is rewritten — every order simply
-- starts with NULL, which reads correctly as "never synced".
--
-- spaceseller_sync_status doubles as the once-only claim. It is flipped to
-- PENDING by a conditional UPDATE before any request is sent, so two concurrent
-- callers cannot both create an order upstream.
ALTER TABLE "Order" ADD COLUMN "spaceseller_sync_status"      TEXT;
ALTER TABLE "Order" ADD COLUMN "spaceseller_order_id"         TEXT;
ALTER TABLE "Order" ADD COLUMN "spaceseller_uuid"             TEXT;
ALTER TABLE "Order" ADD COLUMN "spaceseller_status"           TEXT;
ALTER TABLE "Order" ADD COLUMN "spaceseller_delivery_status"  TEXT;
ALTER TABLE "Order" ADD COLUMN "spaceseller_tracking_number"  TEXT;
ALTER TABLE "Order" ADD COLUMN "spaceseller_synced_at"        TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "spaceseller_last_error"       TEXT;

-- The dashboard lists orders that still need attention.
CREATE INDEX "Order_spaceseller_sync_status_idx" ON "Order"("spaceseller_sync_status");

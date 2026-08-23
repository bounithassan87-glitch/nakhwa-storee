-- Outcome of the confirmation WhatsApp, per order.
--
-- Purely additive: four NULLable columns, no default to backfill, no existing
-- column altered or dropped, no data rewritten. Every order already in the table
-- keeps every value it has and simply reads NULL for these — which is correct,
-- because nothing is known about a message that was sent before the columns
-- existed.
--
-- The existing `whatsapp_confirmation_sent` boolean is untouched. It remains the
-- atomic claim that guarantees one message per order; these columns only record
-- what happened afterwards, and are never read to decide whether to send.
--
-- Safe to apply while the old code is running: it writes none of these columns
-- and is unaffected by their presence. Apply BEFORE deploying the new Functions,
-- which do write them.
ALTER TABLE "Order" ADD COLUMN "whatsapp_confirmation_sent_at" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "whatsapp_confirmation_message_id" TEXT;
ALTER TABLE "Order" ADD COLUMN "whatsapp_confirmation_status" TEXT;
ALTER TABLE "Order" ADD COLUMN "whatsapp_confirmation_error" TEXT;

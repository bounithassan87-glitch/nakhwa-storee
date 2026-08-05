-- Tracks whether the confirmation WhatsApp has been delivered for an order.
--
-- Additive and backfilled by the default: every existing order starts at false,
-- which is correct — none of them has been sent one. No column is altered or
-- dropped, so this cannot affect existing rows or order history.
ALTER TABLE "Order" ADD COLUMN "whatsapp_confirmation_sent" BOOLEAN NOT NULL DEFAULT false;

-- Landing-page funnel events.
--
-- Additive only: one new table and its indexes. No existing table, column or
-- row is touched, so applying this cannot affect orders, customers or the
-- Space Seller sync.
--
-- The unique index on (type, order_id) is the duplicate guard for
-- order_success: Postgres treats NULLs as distinct, so every other event type
-- (which carries no order_id) is unconstrained, while an order can only ever
-- have one success row.

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "landing_page" TEXT NOT NULL,
    "product_slug" TEXT,
    "outcome" TEXT,
    "order_id" TEXT,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrackingEvent_created_at_idx" ON "TrackingEvent"("created_at");

-- CreateIndex
CREATE INDEX "TrackingEvent_type_created_at_idx" ON "TrackingEvent"("type", "created_at");

-- CreateIndex
CREATE INDEX "TrackingEvent_landing_page_created_at_idx" ON "TrackingEvent"("landing_page", "created_at");

-- CreateIndex
CREATE INDEX "TrackingEvent_session_id_idx" ON "TrackingEvent"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "TrackingEvent_type_order_id_key" ON "TrackingEvent"("type", "order_id");


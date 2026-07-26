-- Phase 2.7 — Shipping Workflow
-- Additive, non-breaking:
--   • Extends OrderStatus with 5 new values (existing values untouched, so the
--     public order flow and all prior code keep working). PENDING remains the
--     initial "new" state.
--   • Adds OrderEvent (append-only fulfillment timeline) and Shipment (1-1 with
--     Order) tables. No existing column is changed.
--
-- Note: PostgreSQL 12+ allows adding several enum values in one migration; the
-- new values are only referenced by column type here (not used as data in this
-- transaction), so this applies cleanly.
--
-- Rollback (reversible) — run in this order to fully undo:
--   ALTER TABLE "Shipment"   DROP CONSTRAINT "Shipment_orderId_fkey";
--   ALTER TABLE "OrderEvent" DROP CONSTRAINT "OrderEvent_orderId_fkey";
--   DROP TABLE "Shipment";
--   DROP TABLE "OrderEvent";
--   -- Removing enum values requires recreating the type. Only do this if no row
--   -- uses a new value:
--   --   ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
--   --   CREATE TYPE "OrderStatus" AS ENUM ('PENDING','CONFIRMED','SHIPPED','DELIVERED','CANCELLED');
--   --   ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus" USING "status"::text::"OrderStatus";
--   --   DROP TYPE "OrderStatus_old";

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PREPARING';
ALTER TYPE "OrderStatus" ADD VALUE 'READY_TO_SHIP';
ALTER TYPE "OrderStatus" ADD VALUE 'IN_TRANSIT';
ALTER TYPE "OrderStatus" ADD VALUE 'RETURNED';
ALTER TYPE "OrderStatus" ADD VALUE 'REJECTED';

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "company" TEXT,
    "trackingNumber" TEXT,
    "shippingCost" INTEGER,
    "codAmount" INTEGER,
    "estimatedDeliveryAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "status" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Shipment_orderId_key" ON "Shipment"("orderId");

-- CreateIndex
CREATE INDEX "Shipment_company_idx" ON "Shipment"("company");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

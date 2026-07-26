-- Phase 2.6 — Products Manager
-- Additive, non-breaking: every new column is nullable or has a default, so
-- existing rows and the public order flow (Product.slug + Product.basePrice) are
-- unaffected. `isActive` is retained for backward compatibility; `status` is the
-- admin-managed lifecycle (ARCHIVED = soft delete).
--
-- Rollback (reversible) — run in this order to fully undo:
--   ALTER TABLE "ProductMedia" DROP CONSTRAINT "ProductMedia_productId_fkey";
--   DROP TABLE "ProductMedia";
--   DROP INDEX "Product_sku_key";
--   ALTER TABLE "Product" DROP COLUMN "status", DROP COLUMN "sku",
--     DROP COLUMN "offerPrice", DROP COLUMN "category";
--   ALTER TABLE "Color" DROP COLUMN "isActive";
--   DROP TYPE "MediaType";
--   DROP TYPE "ProductStatus";

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DRAFT', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');

-- AlterTable
ALTER TABLE "Color" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "category" TEXT,
ADD COLUMN     "offerPrice" INTEGER,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateTable
CREATE TABLE "ProductMedia" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "url" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductMedia_productId_idx" ON "ProductMedia"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- AddForeignKey
ALTER TABLE "ProductMedia" ADD CONSTRAINT "ProductMedia_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stockRestored" BOOLEAN NOT NULL DEFAULT false;

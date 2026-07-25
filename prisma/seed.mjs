// Seed the catalog: the product, its colours and sizes.
// Idempotent — safe to run repeatedly.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PRODUCT, COLORS, SIZES, CURRENCY } from "../shared/catalog.js";

// Node scripts use the direct (unpooled) connection when available.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const product = await prisma.product.upsert({
    where: { slug: PRODUCT.slug },
    update: {
      name: PRODUCT.name,
      description: PRODUCT.description,
      basePrice: PRODUCT.basePrice,
      compareAtPrice: PRODUCT.compareAtPrice,
      currency: CURRENCY,
      isActive: true,
    },
    create: {
      slug: PRODUCT.slug,
      name: PRODUCT.name,
      description: PRODUCT.description,
      basePrice: PRODUCT.basePrice,
      compareAtPrice: PRODUCT.compareAtPrice,
      currency: CURRENCY,
    },
  });

  for (let i = 0; i < COLORS.length; i++) {
    await prisma.color.upsert({
      where: { productId_name: { productId: product.id, name: COLORS[i] } },
      update: { position: i },
      create: { productId: product.id, name: COLORS[i], position: i },
    });
  }

  for (let i = 0; i < SIZES.length; i++) {
    await prisma.size.upsert({
      where: { productId_label: { productId: product.id, label: SIZES[i] } },
      update: { position: i },
      create: { productId: product.id, label: SIZES[i], position: i },
    });
  }

  const colors = await prisma.color.count({ where: { productId: product.id } });
  const sizes = await prisma.size.count({ where: { productId: product.id } });
  console.log(`[seed] product "${product.name}" ready · ${colors} colours · ${sizes} sizes`);
}

main()
  .catch((e) => { console.error("[seed] failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());

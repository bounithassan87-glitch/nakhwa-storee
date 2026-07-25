// End-to-end DB verification (Node): creates a real order through Prisma the
// same way the API does, reads it back, prints it, then cleans up the test row.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PRODUCT, PRICE_BY_QTY, CURRENCY } from "../shared/catalog.js";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const product = await prisma.product.findUnique({ where: { slug: PRODUCT.slug } });
  if (!product) throw new Error("product not seeded — run `npm run db:seed`");

  const phone = "0600000000"; // test customer
  const customer = await prisma.customer.upsert({
    where: { phone },
    update: { fullName: "اختبار النظام", city: "الدار البيضاء", address: "عنوان تجريبي" },
    create: { fullName: "اختبار النظام", phone, city: "الدار البيضاء", address: "عنوان تجريبي" },
  });

  const order = await prisma.order.create({
    data: {
      orderNumber: "TEST-" + Date.now().toString(36).toUpperCase(),
      customerId: customer.id,
      quantity: 2,
      totalPrice: PRICE_BY_QTY[2],
      currency: CURRENCY,
      items: {
        create: [
          { productId: product.id, colorName: "نمري أسود", sizeLabel: "XL", unitPrice: product.basePrice },
          { productId: product.id, colorName: "أبيض", sizeLabel: "L", unitPrice: product.basePrice },
        ],
      },
    },
    include: { items: true, customer: true },
  });

  console.log("[verify] order saved:", JSON.stringify({
    orderNumber: order.orderNumber,
    customer: order.customer.fullName + " / " + order.customer.phone,
    quantity: order.quantity,
    total: order.totalPrice,
    items: order.items.map((i) => `${i.sizeLabel} / ${i.colorName}`),
  }, null, 2));

  const counts = {
    products: await prisma.product.count(),
    colors: await prisma.color.count(),
    sizes: await prisma.size.count(),
    customers: await prisma.customer.count(),
    orders: await prisma.order.count(),
    orderItems: await prisma.orderItem.count(),
  };
  console.log("[verify] table counts:", JSON.stringify(counts));

  // cleanup the test order (keep tables clean); customer kept (upsert-safe)
  await prisma.order.delete({ where: { id: order.id } });
  console.log("[verify] cleaned up test order · OK");
}

main()
  .catch((e) => { console.error("[verify] FAILED:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());

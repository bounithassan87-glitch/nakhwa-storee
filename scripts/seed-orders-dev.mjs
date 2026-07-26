// DEV-ONLY: seed varied test orders into the LOCAL embedded Postgres so the
// admin Orders module has data to develop/verify against.
//
// SAFETY: uses an explicit LOCAL connection string and HARD-REFUSES any Neon /
// remote host. It never reads .env, so it can never touch production.
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PRODUCT, COLORS, SIZES, CURRENCY, PRICE_BY_QTY } from "../shared/catalog.js";

const LOCAL_URL = "postgresql://postgres:postgres@127.0.0.1:5434/nakhwa?schema=public";
if (/neon\.tech|\.aws\.|amazonaws|supabase/i.test(LOCAL_URL)) {
  console.error("Refusing to run against a non-local database.");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: LOCAL_URL }) });

const CITIES = [
  "الدار البيضاء", "الرباط", "مراكش", "طنجة", "فاس",
  "أكادير", "مكناس", "وجدة", "تطوان", "القنيطرة",
];
const NAMES = [
  "سعاد المرابط", "مريم العلوي", "خديجة بناني", "رجاء الفاسي", "أمينة الزهراء",
  "هند العمراني", "سلمى بنكيران", "نادية الشرقاوي", "زينب الإدريسي", "ليلى بوزيد",
  "فاطمة الغزواني", "سميرة الحسني", "وفاء المنصوري", "إيمان التازي", "غزلان الرامي",
  "بشرى العمري", "حنان الصقلي", "سناء بلحاج",
];
const STATUSES = ["PENDING", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const orderNo = (i) => "NK-D" + String(i).padStart(3, "0") + "-" + Math.random().toString(36).slice(2, 5).toUpperCase();

async function ensureCatalog() {
  const product = await prisma.product.upsert({
    where: { slug: PRODUCT.slug },
    update: {},
    create: {
      slug: PRODUCT.slug, name: PRODUCT.name, description: PRODUCT.description,
      basePrice: PRODUCT.basePrice, compareAtPrice: PRODUCT.compareAtPrice, currency: CURRENCY,
    },
  });
  for (let i = 0; i < COLORS.length; i++)
    await prisma.color.upsert({ where: { productId_name: { productId: product.id, name: COLORS[i] } }, update: {}, create: { productId: product.id, name: COLORS[i], position: i } });
  for (let i = 0; i < SIZES.length; i++)
    await prisma.size.upsert({ where: { productId_label: { productId: product.id, label: SIZES[i] } }, update: {}, create: { productId: product.id, label: SIZES[i], position: i } });
  return product;
}

async function main() {
  const product = await ensureCatalog();

  // reset orders + customers (LOCAL only) for a clean, repeatable dataset
  await prisma.order.deleteMany({});
  await prisma.customer.deleteMany({});

  const COUNT = 23;
  for (let i = 1; i <= COUNT; i++) {
    const qty = Math.random() < 0.4 ? 2 : 1;
    const phone = "06" + String(10000000 + Math.floor(Math.random() * 89999999));
    const customer = await prisma.customer.create({
      data: { fullName: pick(NAMES), phone, city: pick(CITIES), address: "حي " + pick(["السلام", "النهضة", "الرياض", "الأمل", "الوفاق"]) + " رقم " + (i + 3) },
    });
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(Date.now() - daysAgo * 86400000 - Math.floor(Math.random() * 86400000));
    const items = Array.from({ length: qty }, () => ({
      productId: product.id, colorName: pick(COLORS), sizeLabel: pick(SIZES), unitPrice: product.basePrice,
    }));
    await prisma.order.create({
      data: {
        orderNumber: orderNo(i), customerId: customer.id, quantity: qty,
        totalPrice: PRICE_BY_QTY[qty], currency: CURRENCY, status: pick(STATUSES),
        createdAt, items: { create: items },
      },
    });
  }

  const counts = { orders: await prisma.order.count(), customers: await prisma.customer.count() };
  console.log("[seed-orders-dev] LOCAL seeded:", JSON.stringify(counts));
}

main()
  .catch((e) => { console.error("[seed-orders-dev] failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());

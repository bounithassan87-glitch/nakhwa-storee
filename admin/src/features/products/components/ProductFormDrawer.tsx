import { useEffect, useState } from "react";
import { Save, Link2, ServerCog } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Badge } from "@/components/ui/Badge";
import { formatMoney } from "@/lib/format";
import { createProduct, type ProductCreated } from "../api";
import { errorMsg } from "../errors";
import { toCentimes } from "../pricing";
import { slugify, slugError } from "../slug";
import { landingUrlFor, previewLandingStatus, LANDING_STATUS_META, ORDER_ENDPOINT } from "../landing";
import { PRODUCT_STATUS_OPTIONS } from "../status";
import type { ProductStatus } from "../types";

const EMPTY = {
  name: "",
  slug: "",
  category: "",
  sku: "",
  basePrice: "",
  offerPrice: "",
  compareAtPrice: "",
  description: "",
  status: "DRAFT" as ProductStatus,
};

/**
 * Create-product form.
 *
 * Colours, sizes and media belong to the product detail page and are added
 * after creation, which is why a new product starts as a DRAFT — `onCreated`
 * hands the caller the new product so it can send the admin straight there.
 *
 * Three things beyond the plain fields, all of them there because this form is
 * where a storefront gets wired up and a mistake here is invisible afterwards:
 *
 *  · the **slug**, suggested from the name and editable, because it is the only
 *    link between the landing-page folder, the `productSlug` that page posts,
 *    and this catalog row;
 *  · the **landing page** it will connect to, resolved live from the slug, so a
 *    typo shows as "ماشي مربوط" before the product is saved rather than as
 *    silent `product_unavailable` responses after the ads are running;
 *  · the **selling price** the server will actually charge, spelled out,
 *    because three price columns are easy to confuse and only one of them ever
 *    reaches a customer.
 *
 * Prices are typed in dirhams and converted to the integer centimes the API
 * stores; the conversion lives in `../pricing` so the form and the table agree.
 */
export function ProductFormDrawer({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (product: ProductCreated) => void;
}) {
  const [f, setF] = useState(EMPTY);
  // Once the admin edits the slug themselves, the name stops driving it —
  // otherwise a deliberate slug is silently overwritten by the next keystroke
  // in the name field.
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset between openings so a cancelled draft never resurfaces.
  useEffect(() => {
    if (open) {
      setF(EMPTY);
      setSlugTouched(false);
      setError(null);
    }
  }, [open]);

  const set = (patch: Partial<typeof EMPTY>) => setF((prev) => ({ ...prev, ...patch }));

  function setName(name: string) {
    setF((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
  }

  const base = toCentimes(f.basePrice);
  const offer = toCentimes(f.offerPrice);
  const compareAt = toCentimes(f.compareAtPrice);

  // Exactly how `/api/orders` resolves it, and how the server re-derives it on
  // save: the offer when one is set, the regular price otherwise.
  const selling = offer ?? base;

  const nameOk = f.name.trim().length >= 2;
  const slugMsg = slugError(f.slug.trim());
  const sellingOk = selling !== null && selling > 0;
  const canSubmit = nameOk && !slugMsg && sellingOk && !busy;

  const slug = f.slug.trim();
  const landingUrl = landingUrlFor(slug);
  const landing = LANDING_STATUS_META[previewLandingStatus(slug, f.status)];

  async function submit() {
    if (!canSubmit || base === null) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createProduct({
        name: f.name.trim(),
        // Omitted when blank so the server derives one — the Arabic-name case.
        slug: slug || undefined,
        category: f.category.trim() || null,
        sku: f.sku.trim() || null,
        description: f.description.trim() || null,
        basePrice: base,
        offerPrice: offer,
        compareAtPrice: compareAt,
        status: f.status,
      });
      onCreated(res.data);
    } catch (e) {
      setError(errorMsg(e instanceof Error ? e.message : ""));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer open={open} onClose={busy ? () => undefined : onClose} title="منتج جديد">
      <div className="space-y-4">
        <Input
          label="اسم المنتج *"
          value={f.name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثال: BelleVia Anti Joint Pain"
          autoFocus
        />

        <div>
          <Input
            label="المعرّف (slug) *"
            value={f.slug}
            onChange={(e) => {
              setSlugTouched(true);
              set({ slug: e.target.value.toLowerCase() });
            }}
            placeholder="bellevia-anti-joint-pain"
            dir="ltr"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-muted">
            حروف صغيرة وأرقام وشرطات. هادا هو اللي كتبعت صفحة الهبوط فـ{" "}
            <code className="rounded bg-line/40 px-1 font-mono text-[11px]">productSlug</code>، وهادا هو
            اللي كيقلب بيه <code className="rounded bg-line/40 px-1 font-mono text-[11px]">{ORDER_ENDPOINT}</code>{" "}
            على المنتج. خليه خاوي وغادي يتصاوب من الاسم.
          </p>
          {slugMsg && (
            <p className="mt-1 text-xs font-bold text-danger" role="alert">
              {slugMsg}
            </p>
          )}
        </div>

        {/* Landing page + order system. Both are read-only status, not inputs:
            the page is deployed by the build and the endpoint is the same for
            every product. Showing them here is what turns a silent
            misconfiguration into something an admin can see before launch. */}
        <div className="space-y-2 rounded-xl border border-line bg-bg p-3">
          <div className="flex items-start gap-2">
            <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink">صفحة الهبوط</span>
                <Badge tone={landing.tone}>{landing.label}</Badge>
              </div>
              <p className="mt-0.5 font-mono text-xs text-muted" dir="ltr">
                {landingUrl ?? "—"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{landing.hint}</p>
            </div>
          </div>

          <div className="flex items-start gap-2 border-t border-line/60 pt-2">
            <ServerCog className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-ink">نظام الطلبات المركزي</span>
                <Badge tone="success">مربوط</Badge>
              </div>
              <p className="mt-0.5 font-mono text-xs text-muted" dir="ltr">
                POST {ORDER_ENDPOINT}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                نفس الـ endpoint لكل المنتجات. ما كاينش API خاص بكل منتج، والطلبات كلها كتبان فنفس صفحة
                الطلبات.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="التصنيف"
            value={f.category}
            onChange={(e) => set({ category: e.target.value })}
            placeholder="مكمل غذائي"
          />
          <Input
            label="SKU"
            value={f.sku}
            onChange={(e) => set({ sku: e.target.value })}
            placeholder="BVP-AJP-001"
            dir="ltr"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="السعر العادي (درهم) *"
            value={f.basePrice}
            onChange={(e) => set({ basePrice: e.target.value })}
            inputMode="decimal"
            placeholder="259"
          />
          <Input
            label="سعر العرض (درهم)"
            value={f.offerPrice}
            onChange={(e) => set({ offerPrice: e.target.value })}
            inputMode="decimal"
            placeholder="199"
          />
          <Input
            label="السعر القديم (درهم)"
            value={f.compareAtPrice}
            onChange={(e) => set({ compareAtPrice: e.target.value })}
            inputMode="decimal"
            placeholder="349"
          />
        </div>

        {/* The one number that reaches a customer, spelled out. The server
            recomputes it the same way and never trusts a price sent by a
            storefront, so this is what the delivery slip will say. */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft/60 px-3 py-2.5">
          <span className="text-sm font-bold text-ink">السعر اللي غادي يتخلّص</span>
          <span className="text-base font-black text-brand-dark">
            {sellingOk ? formatMoney(selling) : "—"}
          </span>
        </div>
        <p className="-mt-2 text-xs leading-relaxed text-muted">
          السيرفر كيحسبو بنفسو من هاد المنتج (سعر العرض إلا كان، وإلا السعر العادي) — وعمرو ما كيقبل ثمن
          جاي من صفحة الهبوط. المجموع = هاد السعر × الكمية.
        </p>
        {!sellingOk && (f.basePrice !== "" || f.offerPrice !== "") && (
          <p className="-mt-2 text-xs font-bold text-danger" role="alert">
            خاص السعر يكون أكبر من 0.
          </p>
        )}

        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">الوصف</span>
          <textarea
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
            rows={4}
            placeholder="وصف المنتج كما يظهر للزبون…"
            className="w-full rounded-xl border border-line bg-bg p-3 text-sm text-ink outline-none transition placeholder:text-faint focus:border-brand focus:ring-2 focus:ring-brand/20"
          />
        </label>

        <Select
          label="الحالة"
          value={f.status}
          onChange={(e) => set({ status: e.target.value as ProductStatus })}
        >
          {PRODUCT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <p className="rounded-xl bg-brand-soft/50 p-3 text-xs leading-relaxed text-muted">
          سيُنشأ المنتج كمسودة افتراضياً. أضِف الألوان والمقاسات والصور من صفحة المنتج، ثم غيّر حالته إلى
          «نشط» لعرضه في المتجر. المنتج بلا ألوان ولا مقاسات كيتقبل أي طلب — وهادشي هو المطلوب لصفحة هبوط
          بمنتج واحد.
        </p>

        {error && (
          <p className="rounded-xl bg-danger-soft p-3 text-sm font-bold text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <Button onClick={() => void submit()} disabled={!canSubmit}>
            {busy ? <Spinner className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            إنشاء المنتج
          </Button>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            إلغاء
          </Button>
        </div>
      </div>
    </Drawer>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, AlertCircle, SearchX } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDebouncedValue } from "@/lib/useDebounce";
import { useAuth } from "@/auth/AuthContext";
import { useNotifications } from "@/features/notifications/NotificationsContext";
import { roleCan } from "@/features/settings/permissions";
import { useProducts } from "@/features/products/useProducts";
import { useFeatured } from "@/features/products/useFeatured";
import { archiveProduct, deleteProduct, duplicateProduct } from "@/features/products/api";
import { errorMsg } from "@/features/products/errors";
import { publicProductUrl } from "@/features/products/actions";
import {
  DEFAULT_FILTERS,
  applyFeaturedFilter,
  hasActiveFilters,
  type ProductsFilters,
} from "@/features/products/filters";
import { ProductsToolbar } from "@/features/products/components/ProductsToolbar";
import { ProductsTable } from "@/features/products/components/ProductsTable";
import { ProductCardList } from "@/features/products/components/ProductCardList";
import { ProductsSkeleton } from "@/features/products/components/ProductsSkeleton";
import { ProductFormDrawer } from "@/features/products/components/ProductFormDrawer";
import type { ProductListItem } from "@/features/products/types";

const PAGE_SIZE = 10;

/**
 * The two destructive dispositions share one dialog: they ask the same shape of
 * question and differ only in wording and consequence, so duplicating the modal
 * would mean two places to keep in step.
 */
type PendingAction = { kind: "archive" | "delete"; product: ProductListItem };

// Split around the product name so it can be emphasised mid-sentence and the
// Arabic still reads as one grammatical sentence.
const CONFIRM_COPY = {
  archive: {
    title: "أرشفة المنتج؟",
    confirmLabel: "أرشفة",
    tone: "primary",
    lead: "سيتم أرشفة",
    tail: "وإخفاؤه من المتجر، مع الاحتفاظ بكل بياناته وطلباته السابقة. يمكن إرجاعه لاحقاً بتغيير حالته إلى «نشط».",
  },
  delete: {
    title: "حذف المنتج نهائياً؟",
    confirmLabel: "حذف نهائي",
    tone: "danger",
    lead: "سيتم حذف",
    tail: "نهائياً مع كل ألوانه ومقاساته وصوره. هذا الإجراء لا رجعة فيه.",
  },
} as const;

export default function Products() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useNotifications();

  // One permission covers the whole page: every catalog mutation — create,
  // edit, duplicate, archive, delete and the featured flag — is gated on
  // `manage_products`, matching functions/api/admin/products/_middleware.ts.
  const canManageProducts = roleCan(user?.role, "manage_products");

  const [filters, setFilters] = useState<ProductsFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [working, setWorking] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const debouncedQ = useDebouncedValue(filters.q);

  // Any change to what is being filtered invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [debouncedQ, filters.status, filters.category, filters.featured, filters.sort]);

  const { products, categories, total, totalPages, loading, error, refetch } = useProducts({
    page,
    pageSize: PAGE_SIZE,
    q: debouncedQ,
    status: filters.status,
    category: filters.category,
    sort: filters.sort,
    order: "desc",
  });

  const onFeaturedError = useCallback((msg: string) => notify("تعذّر الحفظ", msg), [notify]);
  const { featured, toggleFeatured } = useFeatured(canManageProducts, onFeaturedError);

  const patchFilters = useCallback((patch: Partial<ProductsFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  const resetFilters = useCallback(() => setFilters(DEFAULT_FILTERS), []);

  const visible = useMemo(
    () => applyFeaturedFilter(products, filters.featured, featured),
    [products, filters.featured, featured],
  );

  const openProduct = useCallback(
    (p: ProductListItem) => {
      void navigate(`/products/${p.id}`);
    },
    [navigate],
  );

  const previewProduct = useCallback(() => {
    window.open(publicProductUrl(), "_blank", "noopener,noreferrer");
  }, []);

  const handleToggleFeatured = useCallback(
    (id: string) => {
      void toggleFeatured(id);
    },
    [toggleFeatured],
  );

  const handleDuplicate = useCallback(
    (p: ProductListItem) => {
      void (async () => {
        setWorking(true);
        try {
          const res = await duplicateProduct(p.id);
          notify("تم إنشاء نسخة", `«${res.data.name}» أُنشئت كمسودة.`);
          void refetch();
        } catch (e) {
          notify("تعذّر النسخ", errorMsg(e instanceof Error ? e.message : ""));
        } finally {
          setWorking(false);
        }
      })();
    },
    [notify, refetch],
  );

  async function confirmPending() {
    if (!pending) return;
    const { kind, product } = pending;
    setWorking(true);
    try {
      if (kind === "archive") {
        await archiveProduct(product.id);
        notify("تمت الأرشفة", `تم أرشفة «${product.name}» وإخفاؤه من المتجر.`);
      } else {
        await deleteProduct(product.id);
        notify("تم الحذف", `حُذف «${product.name}» نهائياً.`);
      }
      setPending(null);
      void refetch();
    } catch (e) {
      notify(
        kind === "archive" ? "تعذّرت الأرشفة" : "تعذّر الحذف",
        errorMsg(e instanceof Error ? e.message : ""),
      );
    } finally {
      setWorking(false);
    }
  }

  const filtersActive = hasActiveFilters(filters);
  // `total` counts server-side matches; the featured filter runs on the client,
  // so the honest subtitle reports what the admin can actually see.
  const showingFeaturedSubset = filters.featured !== "" && visible.length !== products.length;

  const listProps = {
    products: visible,
    featured,
    canManageProducts,
    onOpen: openProduct,
    onToggleFeatured: handleToggleFeatured,
    onPreview: previewProduct,
    onDuplicate: handleDuplicate,
    onArchive: (p: ProductListItem) => setPending({ kind: "archive", product: p }),
    onDelete: (p: ProductListItem) => setPending({ kind: "delete", product: p }),
  };

  const copy = pending ? CONFIRM_COPY[pending.kind] : null;

  return (
    <>
      <PageHeader
        title="المنتجات"
        subtitle={
          loading
            ? "جارٍ التحميل…"
            : showingFeaturedSubset
              ? `${visible.length} من ${products.length} منتج في هذه الصفحة`
              : total
                ? `${total} منتج في الكتالوج`
                : "إدارة الكتالوج"
        }
      />

      <ProductsToolbar
        filters={filters}
        onChange={patchFilters}
        onReset={resetFilters}
        categories={categories}
        onRefresh={refetch}
        refreshing={loading}
        canCreate={canManageProducts}
        onCreate={() => setCreateOpen(true)}
      />

      {loading ? (
        <ProductsSkeleton />
      ) : error ? (
        <div className="animate-fade-in rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={AlertCircle}
            title="تعذّر تحميل المنتجات"
            description={error}
            action={<Button onClick={refetch}>إعادة المحاولة</Button>}
          />
        </div>
      ) : visible.length === 0 ? (
        <div className="animate-fade-in rounded-2xl border border-line bg-surface">
          {filtersActive ? (
            <EmptyState
              icon={SearchX}
              title="لا توجد نتائج"
              description="لا يوجد منتج مطابق للبحث أو الفلاتر الحالية. جرّب توسيع البحث أو إعادة ضبط الفلاتر."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  إعادة ضبط الفلاتر
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Package}
              title="لا توجد منتجات بعد"
              description="كتالوج المتجر فارغ حالياً. ابدأ بإضافة منتجك الأول — ستظهر هنا أسعاره وصوره وحالته."
              action={
                canManageProducts ? (
                  <Button onClick={() => setCreateOpen(true)}>إضافة منتج</Button>
                ) : undefined
              }
            />
          )}
        </div>
      ) : (
        <>
          <ProductsTable {...listProps} />
          <ProductCardList {...listProps} />
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} noun="منتج" />
        </>
      )}

      <ProductFormDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(product) => {
          setCreateOpen(false);
          notify("تم إنشاء المنتج", `«${product.name}» أُنشئ كمسودة — أضِف الألوان والصور.`);
          // Straight to the detail page: colours, sizes and media live there,
          // and a draft is not finished until they are set.
          void navigate(`/products/${product.id}`);
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        busy={working}
        title={copy?.title ?? ""}
        description={
          <>
            {copy?.lead} <span className="font-bold text-ink">{pending?.product.name}</span>{" "}
            {copy?.tail}
          </>
        }
        confirmLabel={copy?.confirmLabel}
        tone={copy?.tone}
        onConfirm={() => void confirmPending()}
        onClose={() => !working && setPending(null)}
      />
    </>
  );
}

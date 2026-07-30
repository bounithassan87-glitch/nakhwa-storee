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
import { archiveProduct } from "@/features/products/api";
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
import type { ProductListItem } from "@/features/products/types";

const PAGE_SIZE = 10;

export default function Products() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notify } = useNotifications();

  // One permission covers the whole page: every catalog mutation — edit,
  // archive, and the featured flag — is gated on `manage_products`, matching
  // what functions/api/admin/products/_middleware.ts enforces server-side.
  const canManageProducts = roleCan(user?.role, "manage_products");

  const [filters, setFilters] = useState<ProductsFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [pendingArchive, setPendingArchive] = useState<ProductListItem | null>(null);
  const [archiving, setArchiving] = useState(false);

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

  async function confirmArchive() {
    if (!pendingArchive) return;
    setArchiving(true);
    try {
      await archiveProduct(pendingArchive.id);
      notify("تمت الأرشفة", `تم أرشفة "${pendingArchive.name}" وإخفاؤه من المتجر.`);
      setPendingArchive(null);
      void refetch();
    } catch (e) {
      notify("تعذّرت الأرشفة", e instanceof Error ? e.message : "حاول مرة أخرى.");
    } finally {
      setArchiving(false);
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
    onArchive: setPendingArchive,
  };

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
              description="كتالوج المتجر فارغ حالياً. ستظهر المنتجات هنا فور إضافتها، مع أسعارها وصورها وحالتها."
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

      <ConfirmDialog
        open={pendingArchive !== null}
        busy={archiving}
        title="أرشفة المنتج؟"
        description={
          <>
            سيتم أرشفة <span className="font-bold text-ink">{pendingArchive?.name}</span> وإخفاؤه من المتجر،
            مع الاحتفاظ بكل بياناته وطلباته السابقة. يمكن إرجاعه لاحقاً بتغيير حالته إلى «نشط».
          </>
        }
        confirmLabel="أرشفة"
        onConfirm={() => void confirmArchive()}
        onClose={() => !archiving && setPendingArchive(null)}
      />
    </>
  );
}

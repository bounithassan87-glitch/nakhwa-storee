import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/lib/useDebounce";
import { useProducts } from "@/features/products/useProducts";
import { ProductsToolbar } from "@/features/products/components/ProductsToolbar";
import { ProductsTable } from "@/features/products/components/ProductsTable";
import type { ProductSortField } from "@/features/products/types";

const PAGE_SIZE = 10;

export default function Products() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState<ProductSortField>("createdAt");
  const [page, setPage] = useState(1);

  const dq = useDebouncedValue(q);

  useEffect(() => {
    setPage(1);
  }, [dq, status, category, sort]);

  const { products, categories, total, totalPages, loading, error, refetch } = useProducts({
    page,
    pageSize: PAGE_SIZE,
    q: dq,
    status,
    category,
    sort,
    order: "desc",
  });

  return (
    <>
      <PageHeader title="المنتجات" subtitle={total ? `${total} منتج` : "إدارة الكتالوج"} />

      <ProductsToolbar
        q={q}
        setQ={setQ}
        status={status}
        setStatus={setStatus}
        category={category}
        setCategory={setCategory}
        categories={categories}
        sort={sort}
        setSort={setSort}
        onRefresh={refetch}
        refreshing={loading}
      />

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-14" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={AlertCircle}
            title="حدث خطأ"
            description={error}
            action={<Button onClick={refetch}>إعادة المحاولة</Button>}
          />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={Package}
            title="لا توجد منتجات"
            description="لا توجد منتجات مطابقة للبحث أو الفلاتر الحالية."
          />
        </div>
      ) : (
        <>
          <ProductsTable products={products} onOpen={(p) => navigate(`/products/${p.id}`)} />
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} noun="منتج" />
        </>
      )}
    </>
  );
}

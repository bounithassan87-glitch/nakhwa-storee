import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/lib/useDebounce";
import { useCustomers } from "@/features/customers/useCustomers";
import { CustomersToolbar } from "@/features/customers/components/CustomersToolbar";
import { CustomersTable } from "@/features/customers/components/CustomersTable";
import type { CustomerSortField } from "@/features/customers/types";

const PAGE_SIZE = 10;

export default function Customers() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [tag, setTag] = useState("");
  const [city, setCity] = useState("");
  const [sort, setSort] = useState<CustomerSortField>("lastOrder");
  const [page, setPage] = useState(1);

  const dq = useDebouncedValue(q);
  const dCity = useDebouncedValue(city);

  useEffect(() => {
    setPage(1);
  }, [dq, tag, dCity, sort]);

  const { customers, total, totalPages, loading, error, refetch } = useCustomers({
    page,
    pageSize: PAGE_SIZE,
    q: dq,
    tag,
    city: dCity,
    sort,
    order: "desc",
  });

  return (
    <>
      <PageHeader title="الزبناء" subtitle={total ? `${total} زبون` : "قاعدة بيانات الزبناء"} />

      <CustomersToolbar
        q={q}
        setQ={setQ}
        tag={tag}
        setTag={setTag}
        city={city}
        setCity={setCity}
        sort={sort}
        setSort={setSort}
        onRefresh={refetch}
        refreshing={loading}
      />

      {loading ? (
        <div className="grid place-items-center gap-3 py-20 text-muted">
          <Spinner className="h-7 w-7 text-brand" />
          <span className="text-sm">جارٍ التحميل…</span>
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
      ) : customers.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={Users}
            title="لا يوجد زبناء"
            description="لا يوجد زبناء مطابقون للبحث أو الفلاتر الحالية."
          />
        </div>
      ) : (
        <>
          <CustomersTable customers={customers} onOpen={(c) => navigate(`/customers/${c.id}`)} />
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} noun="زبون" />
        </>
      )}
    </>
  );
}

import { useEffect, useState } from "react";
import { Truck, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/lib/useDebounce";
import { useNotifications } from "@/features/notifications/NotificationsContext";
import { useShipping } from "@/features/shipping/useShipping";
import { ShippingKPIs } from "@/features/shipping/components/ShippingKPIs";
import { ShippingToolbar } from "@/features/shipping/components/ShippingToolbar";
import { ShippingTable } from "@/features/shipping/components/ShippingTable";
import { ShippingCardList } from "@/features/shipping/components/ShippingCardList";
import { ShippingDrawer } from "@/features/shipping/components/ShippingDrawer";
import type { ShippingSortField } from "@/features/shipping/types";

const PAGE_SIZE = 10;

export default function Shipping() {
  const { refreshNow } = useNotifications();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [company, setCompany] = useState("");
  const [city, setCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort] = useState<ShippingSortField>("createdAt");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const dq = useDebouncedValue(q);
  const dCity = useDebouncedValue(city);
  const dCompany = useDebouncedValue(company);

  useEffect(() => {
    setPage(1);
  }, [dq, status, dCompany, dCity, dateFrom, dateTo]);

  const { orders, statusCounts, companies, total, totalPages, loading, error, refetch } = useShipping({
    page,
    pageSize: PAGE_SIZE,
    q: dq,
    status,
    company: dCompany,
    city: dCity,
    dateFrom,
    dateTo,
    sort,
    order: "desc",
  });

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }

  // Any fulfillment change → refresh the list + KPIs and re-poll notifications.
  // Analytics reads live, so it reflects the change on its next load.
  function onChanged() {
    void refetch();
    refreshNow();
  }

  return (
    <>
      <PageHeader title="الشحن والتتبع" subtitle={total ? `${total} طلب` : "إدارة عمليات التوصيل"} />

      <ShippingKPIs counts={statusCounts} />

      <ShippingToolbar
        q={q}
        setQ={setQ}
        status={status}
        setStatus={setStatus}
        company={company}
        setCompany={setCompany}
        companies={companies}
        city={city}
        setCity={setCity}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
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
          <EmptyState icon={AlertCircle} title="حدث خطأ" description={error} action={<Button onClick={refetch}>إعادة المحاولة</Button>} />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState icon={Truck} title="لا توجد طلبات" description="لا توجد طلبات مطابقة للبحث أو الفلاتر الحالية." />
        </div>
      ) : (
        <>
          <ShippingTable orders={orders} onOpen={(o) => setSelectedId(o.id)} />
          <ShippingCardList orders={orders} onOpen={(o) => setSelectedId(o.id)} />
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </>
      )}

      <ShippingDrawer
        orderId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={onChanged}
        notify={notify}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 rounded-xl bg-sidebar px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}

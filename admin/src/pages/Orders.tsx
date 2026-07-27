import { useEffect, useRef, useState } from "react";
import { ShoppingBag, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { useDebouncedValue } from "@/lib/useDebounce";
import { useNotifications } from "@/features/notifications/NotificationsContext";
import { useOrders } from "@/features/orders/useOrders";
import { OrdersToolbar } from "@/features/orders/components/OrdersToolbar";
import { OrdersTable } from "@/features/orders/components/OrdersTable";
import { OrderDrawer } from "@/features/orders/components/OrderDrawer";
import { STATUS_META } from "@/features/orders/status";
import type { Order, OrderStatus, SortField, SortOrder } from "@/features/orders/types";

const PAGE_SIZE = 10;

export default function Orders() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [city, setCity] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortField>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Order | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());

  const { revision, markAllSeen } = useNotifications();

  const dq = useDebouncedValue(q);
  const dCity = useDebouncedValue(city);

  // Reset to page 1 whenever a filter/sort changes.
  useEffect(() => {
    setPage(1);
  }, [dq, status, dCity, dateFrom, dateTo, sort, order]);

  const { orders, total, totalPages, loading, refreshing, error, refetch, changeStatus } = useOrders({
    page,
    pageSize: PAGE_SIZE,
    q: dq,
    status,
    city: dCity,
    dateFrom,
    dateTo,
    sort,
    order,
  });

  // Viewing the list clears the unseen-orders badge.
  useEffect(() => {
    markAllSeen();
  }, [markAllSeen]);

  // A new order was detected by the poller → refresh the current view in the
  // background (filters, pagination and scroll position are preserved) and
  // clear the badge since the admin is already looking at the list.
  useEffect(() => {
    if (revision === 0) return;
    refetch({ silent: true });
    markAllSeen();
    // React only to the poller's new-order signal. `refetch` changes identity
    // whenever filters/pagination change, so listing it would double-fetch on
    // every filter edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  // Briefly highlight rows that just appeared after a background refresh.
  const prevIds = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(orders.map((o) => o.id));
    if (prevIds.current) {
      const added = [...ids].filter((id) => !prevIds.current!.has(id));
      if (added.length) {
        setHighlightIds(new Set(added));
        const t = setTimeout(() => setHighlightIds(new Set()), 4000);
        prevIds.current = ids;
        return () => clearTimeout(t);
      }
    }
    prevIds.current = ids;
  }, [orders]);

  function onSort(f: SortField) {
    if (sort === f) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else {
      setSort(f);
      setOrder("desc");
    }
  }

  async function onChangeStatus(id: string, s: OrderStatus) {
    const prevSelected = selected;
    setStatusBusy(true);
    setSelected((sel) => (sel && sel.id === id ? { ...sel, status: s } : sel));
    try {
      await changeStatus(id, s); // optimistic in the list + revert on error
      setToast("تم تحديث الحالة إلى " + STATUS_META[s].label);
    } catch {
      setSelected(prevSelected);
      setToast("تعذّر تحديث الحالة");
    } finally {
      setStatusBusy(false);
      setTimeout(() => setToast(null), 2200);
    }
  }

  return (
    <>
      <PageHeader title="الطلبات" subtitle={total ? `${total} طلب` : "إدارة طلبات الزبناء"} />

      <OrdersToolbar
        q={q}
        setQ={setQ}
        status={status}
        setStatus={setStatus}
        city={city}
        setCity={setCity}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        onRefresh={() => refetch({ silent: true })}
        refreshing={loading || refreshing}
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
            action={<Button onClick={() => refetch()}>إعادة المحاولة</Button>}
          />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={ShoppingBag}
            title="لا توجد طلبات"
            description="لا توجد طلبات مطابقة للفلاتر الحالية."
          />
        </div>
      ) : (
        <>
          <OrdersTable orders={orders} sort={sort} order={order} onSort={onSort} onOpen={setSelected} highlightIds={highlightIds} />
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </>
      )}

      <OrderDrawer
        order={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
        onChangeStatus={onChangeStatus}
        statusBusy={statusBusy}
      />

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-sidebar px-4 py-2 text-sm font-bold text-white shadow-lg">
          {toast}
        </div>
      )}
    </>
  );
}

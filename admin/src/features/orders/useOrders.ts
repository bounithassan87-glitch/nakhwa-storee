import { useCallback, useEffect, useState } from "react";
import { fetchOrders, updateOrderStatus } from "./api";
import type { Order, OrderStatus, OrdersParams } from "./types";

export function useOrders(params: OrdersParams) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(params);

  // `silent` keeps the current table on screen (no full-page spinner, so scroll
  // position is preserved) — used for background auto-refresh and manual refresh.
  const load = useCallback(
    async (signal?: AbortSignal, opts?: { silent?: boolean }) => {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await fetchOrders(params, signal);
        setOrders(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message || "فشل تحميل الطلبات");
        }
      } finally {
        if (opts?.silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    // `params` is a new object literal every render; `key` is its stable
    // serialization. Listing `params` would rebuild `load` on each render and
    // retrigger the effect below → infinite refetch loop. Load-bearing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  /** Optimistic status change: update UI immediately, revert on failure. */
  const changeStatus = useCallback(
    async (id: string, status: OrderStatus) => {
      let prev: Order[] = [];
      setOrders((os) => {
        prev = os;
        return os.map((o) => (o.id === id ? { ...o, status } : o));
      });
      try {
        await updateOrderStatus(id, status);
      } catch (e) {
        setOrders(prev); // revert
        throw e;
      }
    },
    [],
  );

  const refetch = useCallback(
    (opts?: { silent?: boolean }) => load(undefined, opts),
    [load],
  );

  return { orders, total, totalPages, loading, refreshing, error, refetch, changeStatus };
}

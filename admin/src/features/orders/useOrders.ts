import { useCallback, useEffect, useState } from "react";
import { fetchOrders, updateOrderStatus } from "./api";
import type { Order, OrderStatus, OrdersParams } from "./types";

export function useOrders(params: OrdersParams) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = JSON.stringify(params);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
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
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
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

  return { orders, total, totalPages, loading, error, refetch: () => load(), changeStatus };
}

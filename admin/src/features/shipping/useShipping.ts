import { useCallback, useEffect, useState } from "react";
import { fetchShippingOrders } from "./api";
import type { OrderStatus } from "@/features/orders/types";
import type { ShippingOrder, ShippingParams } from "./types";

const EMPTY_COUNTS = {} as Record<OrderStatus, number>;

export function useShipping(params: ShippingParams) {
  const [orders, setOrders] = useState<ShippingOrder[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<OrderStatus, number>>(EMPTY_COUNTS);
  const [companies, setCompanies] = useState<string[]>([]);
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
        const res = await fetchShippingOrders(params, signal);
        setOrders(res.data);
        setStatusCounts(res.statusCounts);
        setCompanies(res.companies);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "فشل تحميل الطلبات");
      } finally {
        setLoading(false);
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

  return { orders, statusCounts, companies, total, totalPages, loading, error, refetch: () => load() };
}

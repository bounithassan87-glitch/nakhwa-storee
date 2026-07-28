import { useCallback, useEffect, useState } from "react";
import { fetchOrderDetail } from "./api";
import type { OrderDetail } from "./types";

export function useOrderDetail(id: string | null) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetchOrderDetail(id, signal);
        setOrder(res.data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "فشل تحميل الطلب");
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!id) {
      setOrder(null);
      return;
    }
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [id, load]);

  return { order, loading, error, setOrder, refetch: () => load() };
}

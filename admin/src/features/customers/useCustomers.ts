import { useCallback, useEffect, useState } from "react";
import { fetchCustomers } from "./api";
import type { CustomerListItem, CustomersParams } from "./types";

export function useCustomers(params: CustomersParams) {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
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
        const res = await fetchCustomers(params, signal);
        setCustomers(res.data);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message || "فشل تحميل الزبناء");
        }
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
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return { customers, total, totalPages, loading, error, refetch: () => load() };
}

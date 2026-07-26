import { useCallback, useEffect, useState } from "react";
import { fetchCustomer } from "./api";
import type { CustomerProfile } from "./types";

export function useCustomer(id: string | undefined) {
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const res = await fetchCustomer(id, signal);
        setCustomer(res.data);
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError") return;
        if (err.message === "not_found") setNotFound(true);
        else setError(err.message || "فشل تحميل الزبون");
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return { customer, loading, error, notFound, refetch: () => load() };
}

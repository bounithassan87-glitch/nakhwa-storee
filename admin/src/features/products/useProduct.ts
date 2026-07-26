import { useCallback, useEffect, useState } from "react";
import { fetchProduct } from "./api";
import type { ProductDetail } from "./types";

export function useProduct(id: string | undefined) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
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
        const res = await fetchProduct(id, signal);
        setProduct(res.data);
      } catch (e) {
        const err = e as Error;
        if (err.name === "AbortError") return;
        if (err.message === "not_found") setNotFound(true);
        else setError(err.message || "فشل تحميل المنتج");
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

  // Optimistically patch local state without a round-trip (used after mutations).
  const patchLocal = useCallback((updater: (p: ProductDetail) => ProductDetail) => {
    setProduct((p) => (p ? updater(p) : p));
  }, []);

  return { product, loading, error, notFound, refetch: () => load(), patchLocal };
}

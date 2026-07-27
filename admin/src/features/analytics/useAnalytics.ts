import { useCallback, useEffect, useState } from "react";
import { fetchAnalytics } from "./api";
import type { Analytics, RangeKey } from "./types";

export function useAnalytics(range: RangeKey, from: string, to: string) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const key = `${range}|${from}|${to}`;

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAnalytics(range, from, to, signal);
        const { ok, ...rest } = res;
        void ok;
        setData(rest as Analytics);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message || "فشل تحميل الإحصائيات");
        }
      } finally {
        setLoading(false);
      }
    },
    // `range`/`from`/`to` are primitives, but `key` is their stable composite;
    // listing them separately risks divergent refetches. Load-bearing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  useEffect(() => {
    const ac = new AbortController();
    load(ac.signal);
    return () => ac.abort();
  }, [load]);

  return { data, loading, error, refetch: () => load() };
}

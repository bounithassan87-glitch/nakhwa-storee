import { useCallback, useEffect, useState } from "react";
import { fetchCampaign } from "./api";
import type { CampaignDetail } from "./types";

export function useCampaign(id: string | null) {
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        setCampaign((await fetchCampaign(id, signal)).data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "فشل تحميل الحملة");
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    if (!id) {
      setCampaign(null);
      return;
    }
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [id, load]);

  return { campaign, loading, error, setCampaign, refetch: () => load() };
}

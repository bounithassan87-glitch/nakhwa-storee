import { useCallback, useEffect, useState } from "react";
import { fetchCampaigns } from "./api";
import type { CampaignListItem, CampaignsParams, CampaignSummary, PlatformStat, TimeseriesPoint, TopCampaign } from "./types";

const EMPTY_SUMMARY: CampaignSummary = {
  totalCampaigns: 0, activeCampaigns: 0, budget: 0, spent: 0, revenue: 0, profit: 0,
  roas: 0, cpa: 0, ctr: 0, conversionRate: 0, ordersGenerated: 0, customersAcquired: 0,
};

export function useCampaigns(params: CampaignsParams) {
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [summary, setSummary] = useState<CampaignSummary>(EMPTY_SUMMARY);
  const [platforms, setPlatforms] = useState<PlatformStat[]>([]);
  const [top, setTop] = useState<TopCampaign[]>([]);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
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
        const res = await fetchCampaigns(params, signal);
        setCampaigns(res.data);
        setSummary(res.summary);
        setPlatforms(res.platforms);
        setTop(res.top);
        setTimeseries(res.timeseries);
        setObjectives(res.objectives);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError((e as Error).message || "فشل تحميل الحملات");
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

  return { campaigns, summary, platforms, top, timeseries, objectives, total, totalPages, loading, error, refetch: () => load() };
}

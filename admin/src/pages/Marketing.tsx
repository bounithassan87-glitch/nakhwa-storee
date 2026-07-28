import { useEffect, useState } from "react";
import { Megaphone, AlertCircle, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/ui/Pagination";
import { Drawer } from "@/components/ui/Drawer";
import { useDebouncedValue } from "@/lib/useDebounce";
import { useAuth } from "@/auth/AuthContext";
import { useNotifications } from "@/features/notifications/NotificationsContext";
import { roleCan } from "@/features/settings/permissions";
import { useCampaigns } from "@/features/marketing/useCampaigns";
import { CampaignKPIs } from "@/features/marketing/components/CampaignKPIs";
import { CampaignCharts } from "@/features/marketing/components/CampaignCharts";
import { CampaignsToolbar } from "@/features/marketing/components/CampaignsToolbar";
import { CampaignsTable } from "@/features/marketing/components/CampaignsTable";
import { CampaignDrawer } from "@/features/marketing/components/CampaignDrawer";
import { CampaignForm } from "@/features/marketing/components/CampaignForm";
import { createCampaign } from "@/features/marketing/api";
import type { CampaignInput, CampaignSortField, SortOrder } from "@/features/marketing/types";

const PAGE_SIZE = 10;

export default function Marketing() {
  const { user } = useAuth();
  const { notify } = useNotifications();
  const canManage = roleCan(user?.role, "manage_marketing");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [platform, setPlatform] = useState("");
  const [objective, setObjective] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [sort, setSort] = useState<CampaignSortField>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const dq = useDebouncedValue(q);
  const dBudget = useDebouncedValue(budgetMin);

  useEffect(() => {
    setPage(1);
  }, [dq, status, platform, objective, dBudget, sort, order]);

  const { campaigns, summary, platforms, top, timeseries, objectives, total, totalPages, loading, error, refetch } = useCampaigns({
    page, pageSize: PAGE_SIZE, q: dq, status, platform, objective, budgetMin: dBudget, sort, order,
  });

  function onSort(f: CampaignSortField) {
    if (sort === f) setOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSort(f); setOrder("desc"); }
  }

  async function onCreate(input: CampaignInput) {
    // CampaignForm.submit wraps this in try/finally without a catch, so an
    // unhandled failure here would surface as an unhandled promise rejection
    // with no user feedback. Report it through the shared notification host,
    // matching how CampaignDrawer reports update failures.
    try {
      await createCampaign(input);
      setCreateOpen(false);
      void refetch();
    } catch (e) {
      const m = (e as Error).message;
      notify(
        "تعذّر إنشاء الحملة",
        m === "forbidden" ? "ليست لديك صلاحية." : m === "validation_error" ? "تحقّقي من الحقول." : undefined,
      );
    }
  }

  return (
    <>
      <PageHeader
        title="التسويق والحملات"
        subtitle={total ? `${total} حملة` : "إدارة الحملات الإعلانية"}
        action={canManage ? <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> حملة جديدة</Button> : undefined}
      />

      {loading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-72" />)}</div>
          <Skeleton className="h-14" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState icon={AlertCircle} title="حدث خطأ" description={error} action={<Button onClick={refetch}>إعادة المحاولة</Button>} />
        </div>
      ) : (
        <>
          <CampaignKPIs s={summary} />
          <CampaignCharts timeseries={timeseries} platforms={platforms} top={top} campaigns={campaigns} />

          <CampaignsToolbar
            q={q} setQ={setQ} status={status} setStatus={setStatus} platform={platform} setPlatform={setPlatform}
            objective={objective} setObjective={setObjective} objectives={objectives}
            budgetMin={budgetMin} setBudgetMin={setBudgetMin} sort={sort} setSort={setSort} onRefresh={refetch} refreshing={loading}
          />

          {campaigns.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface">
              <EmptyState icon={Megaphone} title="لا توجد حملات" description="أنشئي أول حملة إعلانية لتتبّع أدائها هنا." />
            </div>
          ) : (
            <>
              <CampaignsTable campaigns={campaigns} sort={sort} order={order} onSort={onSort} onOpen={(c) => setSelectedId(c.id)} />
              <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} noun="حملة" />
            </>
          )}
        </>
      )}

      <CampaignDrawer id={selectedId} canManage={canManage} onClose={() => setSelectedId(null)} onChanged={refetch} />

      <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="حملة جديدة">
        <CampaignForm submitLabel="إنشاء الحملة" onSubmit={onCreate} />
      </Drawer>
    </>
  );
}

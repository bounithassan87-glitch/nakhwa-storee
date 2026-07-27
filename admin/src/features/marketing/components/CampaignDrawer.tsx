import { useState } from "react";
import { Send, Trash2, PlusCircle, AlertTriangle } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { useNotifications } from "@/features/notifications/NotificationsContext";
import { formatMoney, formatDate, formatDateOnly } from "@/lib/format";
import { STATUS_META, STATUS_OPTIONS, PLATFORM_META, EVENT_LABEL } from "../meta";
import { formatX, formatPct } from "../metrics";
import { updateCampaign, deleteCampaign, addCampaignNote, attributeOrder, unattributeOrder } from "../api";
import { useCampaign } from "../useCampaign";
import { CampaignForm } from "./CampaignForm";
import type { CampaignInput, CampaignStatus } from "../types";

type Tab = "overview" | "performance" | "orders" | "customers" | "timeline" | "notes";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "نظرة عامة" },
  { key: "performance", label: "الأداء" },
  { key: "orders", label: "الطلبات" },
  { key: "customers", label: "الزبناء" },
  { key: "timeline", label: "المسار" },
  { key: "notes", label: "الملاحظات" },
];

// Client-side notification triggers on status change (reuses the notification host).
const STATUS_NOTICE: Partial<Record<CampaignStatus, string>> = {
  ACTIVE: "انطلقت الحملة",
  PAUSED: "تم إيقاف الحملة مؤقتاً",
  COMPLETED: "اكتملت الحملة",
  CANCELLED: "أُلغيت الحملة",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-bg p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-black text-ink">{value}</p>
    </div>
  );
}

export function CampaignDrawer({
  id,
  canManage,
  onClose,
  onChanged,
}: {
  id: string | null;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { campaign, loading, error, setCampaign, refetch } = useCampaign(id);
  const { notify } = useNotifications();
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [orderNo, setOrderNo] = useState("");
  const [note, setNote] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  async function save(input: CampaignInput, statusNotice?: CampaignStatus) {
    setBusy(true);
    try {
      const prevStatus = campaign?.status;
      const res = await updateCampaign(id!, input);
      setCampaign(res.data);
      onChanged();
      const newStatus = statusNotice ?? res.data.status;
      if (newStatus !== prevStatus && STATUS_NOTICE[newStatus]) notify(STATUS_NOTICE[newStatus]!, res.data.name);
      if (res.data.spent > res.data.budget && res.data.budget > 0) notify("تجاوز الميزانية", res.data.name);
      flash("تم الحفظ");
    } catch (e) {
      flash((e as Error).message === "forbidden" ? "ليست لديك صلاحية." : "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(s: CampaignStatus) {
    await save({ status: s }, s);
  }

  async function onDelete() {
    setBusy(true);
    try {
      await deleteCampaign(id!);
      onChanged();
      onClose();
    } catch {
      flash("تعذّر الحذف");
    } finally {
      setBusy(false);
    }
  }

  async function attribute() {
    if (!orderNo.trim()) return;
    setBusy(true);
    try {
      await attributeOrder(id!, orderNo.trim());
      setOrderNo("");
      await refetch();
      onChanged();
      flash("تمت النسبة");
    } catch (e) {
      flash((e as Error).message === "order_not_found" ? "رقم الطلب غير موجود." : "تعذّرت النسبة");
    } finally {
      setBusy(false);
    }
  }

  async function unattribute(orderId: string) {
    setBusy(true);
    try {
      await unattributeOrder(id!, orderId);
      await refetch();
      onChanged();
    } catch {
      flash("تعذّرت الإزالة");
    } finally {
      setBusy(false);
    }
  }

  async function submitNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await addCampaignNote(id!, note.trim());
      setNote("");
      await refetch();
      flash("تمت الإضافة");
    } catch {
      flash("تعذّرت الإضافة");
    } finally {
      setBusy(false);
    }
  }

  const m = campaign?.metrics;
  const overBudget = campaign && campaign.budget > 0 && campaign.spent > campaign.budget;

  return (
    <Drawer open={!!id} onClose={onClose} title={campaign ? campaign.name : "تفاصيل الحملة"}>
      {loading && !campaign ? (
        <div className="grid place-items-center gap-3 py-20 text-muted"><Spinner className="h-7 w-7 text-brand" /><span className="text-sm">جارٍ التحميل…</span></div>
      ) : error && !campaign ? (
        <div className="py-10 text-center text-sm text-danger">{error}</div>
      ) : campaign && m ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_META[campaign.status].tone}>{STATUS_META[campaign.status].label}</Badge>
            <span className="inline-flex items-center gap-1.5 text-sm text-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLATFORM_META[campaign.platform].color }} />
              {PLATFORM_META[campaign.platform].label}
            </span>
            <span className="text-lg font-black text-brand-dark ms-auto">{formatX(m.roas)}</span>
          </div>

          {overBudget && (
            <div className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm font-medium text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" /> تجاوزت الحملة ميزانيتها ({formatMoney(campaign.spent)} / {formatMoney(campaign.budget)}).
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-line pb-2">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab === t.key ? "bg-brand text-white" : "text-muted hover:bg-brand-soft"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "overview" && (
            <div className="space-y-4">
              {canManage && (
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_OPTIONS.map((o) => (
                    <Button key={o.value} size="sm" variant={campaign.status === o.value ? "primary" : "secondary"} disabled={busy || campaign.status === o.value} onClick={() => setStatus(o.value)}>
                      {o.label}
                    </Button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Metric label="الميزانية" value={formatMoney(campaign.budget)} />
                <Metric label="المصروف" value={formatMoney(campaign.spent)} />
                <Metric label="الإيراد" value={formatMoney(m.revenue)} />
                <Metric label="الربح" value={formatMoney(m.profit)} />
              </div>
              <p className="text-xs text-faint">
                {campaign.objective ? `الهدف: ${campaign.objective} · ` : ""}
                {campaign.startDate ? `من ${formatDateOnly(campaign.startDate)}` : ""} {campaign.endDate ? `إلى ${formatDateOnly(campaign.endDate)}` : ""}
              </p>
              {canManage && (
                <details className="rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-bold text-ink">تعديل الحملة</summary>
                  <div className="mt-3">
                    <CampaignForm initial={campaign} submitLabel="حفظ التعديلات" onSubmit={(input) => save(input)} />
                  </div>
                  <div className="mt-3 border-t border-line pt-3">
                    <Button size="sm" variant="danger" onClick={onDelete} disabled={busy}><Trash2 className="h-4 w-4" /> حذف الحملة</Button>
                  </div>
                </details>
              )}
            </div>
          )}

          {tab === "performance" && (
            <div className="grid grid-cols-2 gap-3">
              <Metric label="ROAS" value={formatX(m.roas)} />
              <Metric label="CPA" value={formatMoney(m.cpa)} />
              <Metric label="CPC" value={formatMoney(m.cpc)} />
              <Metric label="CPM" value={formatMoney(m.cpm)} />
              <Metric label="CTR" value={formatPct(m.ctr)} />
              <Metric label="معدل التحويل" value={formatPct(m.conversionRate)} />
              <Metric label="متوسط قيمة الطلب" value={formatMoney(m.aov)} />
              <Metric label="متوسط الإيراد/زبون" value={formatMoney(m.avgRevenue)} />
              <Metric label="النقرات" value={String(campaign.clicks)} />
              <Metric label="الظهور" value={String(campaign.impressions)} />
              <Metric label="التحويلات" value={String(campaign.conversions)} />
              <Metric label="الطلبات" value={String(m.orders)} />
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-3">
              {canManage && (
                <div className="flex gap-2">
                  <input value={orderNo} onChange={(e) => setOrderNo(e.target.value)} placeholder="رقم الطلب (NK-…)" dir="ltr"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" aria-label="رقم الطلب" />
                  <Button size="sm" onClick={attribute} disabled={busy || !orderNo.trim()}><PlusCircle className="h-4 w-4" /> نسب طلب</Button>
                </div>
              )}
              {campaign.orders.length === 0 ? (
                <p className="py-6 text-center text-sm text-faint">لا توجد طلبات منسوبة.</p>
              ) : (
                <ul className="space-y-2">
                  {campaign.orders.map((o) => (
                    <li key={o.id} className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-sm">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-ink">{o.orderNumber}</div>
                        <div className="text-xs text-muted">{o.customer.fullName} · {o.customer.city}</div>
                      </div>
                      <span className="font-bold text-ink">{formatMoney(o.totalPrice)}</span>
                      {canManage && (
                        <button onClick={() => unattribute(o.id)} disabled={busy} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger" aria-label="إزالة">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "customers" && (
            campaign.customers.length === 0 ? (
              <p className="py-6 text-center text-sm text-faint">لا يوجد زبناء مكتسَبون بعد.</p>
            ) : (
              <ul className="space-y-2">
                {campaign.customers.map((c, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-sm">
                    <div><div className="font-bold text-ink">{c.name}</div><div className="text-xs text-muted" dir="ltr">{c.phone}</div></div>
                    <div className="text-end"><div className="font-bold text-ink">{formatMoney(c.revenue)}</div><div className="text-xs text-muted">{c.orders} طلب</div></div>
                  </li>
                ))}
              </ul>
            )
          )}

          {tab === "timeline" && (
            <ul className="space-y-3">
              {campaign.timeline.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
                  <div>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-bold text-ink">{EVENT_LABEL[e.type] ?? e.type}</span>
                      <span className="text-xs text-faint">{formatDate(e.createdAt)}</span>
                    </div>
                    {e.note && <p className="text-sm text-muted">{e.note}</p>}
                    {e.actor && <p className="text-xs text-faint">— {e.actor}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === "notes" && (
            <div className="space-y-3">
              {campaign.notes && <div className="rounded-xl border border-line bg-bg p-3 text-sm text-ink whitespace-pre-wrap">{campaign.notes}</div>}
              {canManage && (
                <div className="flex gap-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submitNote()} placeholder="أضيفي ملاحظة إلى المسار…"
                    className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" aria-label="ملاحظة داخلية" />
                  <Button size="sm" onClick={submitNote} disabled={busy || !note.trim()}><Send className="h-4 w-4" /> إضافة</Button>
                </div>
              )}
            </div>
          )}

          {toast && <div className="rounded-xl bg-sidebar px-3 py-2 text-center text-sm font-bold text-white">{toast}</div>}
        </div>
      ) : null}
    </Drawer>
  );
}

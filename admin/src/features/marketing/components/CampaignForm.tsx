import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { STATUS_OPTIONS, PLATFORM_OPTIONS } from "../meta";
import type { CampaignInput, CampaignDetail, CampaignPlatform, CampaignStatus } from "../types";

const toDh = (c: number | undefined) => (c == null ? "" : String(c / 100));
const toCentimes = (s: string) => (s.trim() === "" ? 0 : Math.round(Number(s) * 100) || 0);
const toInt = (s: string) => (s.trim() === "" ? 0 : Math.max(0, Math.round(Number(s))) || 0);
const toDay = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export function CampaignForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: Partial<CampaignDetail>;
  submitLabel: string;
  onSubmit: (input: CampaignInput) => Promise<void>;
}) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    platform: (initial?.platform ?? "MANUAL") as CampaignPlatform,
    objective: initial?.objective ?? "",
    status: (initial?.status ?? "DRAFT") as CampaignStatus,
    budget: toDh(initial?.budget),
    spent: toDh(initial?.spent),
    clicks: initial?.clicks != null ? String(initial.clicks) : "",
    impressions: initial?.impressions != null ? String(initial.impressions) : "",
    conversions: initial?.conversions != null ? String(initial.conversions) : "",
    startDate: toDay(initial?.startDate),
    endDate: toDay(initial?.endDate),
    notes: initial?.notes ?? "",
  });
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (f.name.trim().length < 2) return;
    setBusy(true);
    try {
      await onSubmit({
        name: f.name.trim(),
        platform: f.platform,
        objective: f.objective.trim() || null,
        status: f.status,
        budget: toCentimes(f.budget),
        spent: toCentimes(f.spent),
        clicks: toInt(f.clicks),
        impressions: toInt(f.impressions),
        conversions: toInt(f.conversions),
        startDate: f.startDate || null,
        endDate: f.endDate || null,
        notes: f.notes.trim() || null,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="اسم الحملة" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">المنصة</span>
          <Select value={f.platform} onChange={(e) => setF({ ...f, platform: e.target.value as CampaignPlatform })}>
            {PLATFORM_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </label>
        <Input label="الهدف" value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">الحالة</span>
          <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as CampaignStatus })}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </label>
        <Input label="الميزانية (درهم)" type="number" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} />
        <Input label="المصروف (درهم)" type="number" value={f.spent} onChange={(e) => setF({ ...f, spent: e.target.value })} />
        <Input label="النقرات" type="number" value={f.clicks} onChange={(e) => setF({ ...f, clicks: e.target.value })} />
        <Input label="الظهور (Impressions)" type="number" value={f.impressions} onChange={(e) => setF({ ...f, impressions: e.target.value })} />
        <Input label="التحويلات" type="number" value={f.conversions} onChange={(e) => setF({ ...f, conversions: e.target.value })} />
        <Input label="تاريخ البداية" type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
        <Input label="تاريخ النهاية" type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
      </div>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-ink">ملاحظات</span>
        <textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={3}
          className="w-full resize-y rounded-xl border border-line bg-bg p-3 text-sm text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand/20" />
      </label>
      <Button onClick={submit} disabled={busy || f.name.trim().length < 2}>{busy ? "جارٍ الحفظ…" : submitLabel}</Button>
    </div>
  );
}

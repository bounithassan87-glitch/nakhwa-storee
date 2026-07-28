import { useEffect, useState } from "react";
import { Plus, Trash2, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatMoney } from "@/lib/format";
import { getCities, addCity, editCity, deleteCity } from "../api";
import type { City } from "../types";

const toCentimes = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};

export function CitiesSection({ canManage, notify }: { canManage: boolean; notify: (m: string) => void }) {
  const [rows, setRows] = useState<City[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", cost: "", days: "" });

  async function load() {
    try {
      setRows((await getCities()).data);
    } catch {
      notify("تعذّر تحميل المدن");
    }
  }
  useEffect(() => {
    void load();
    // Mount-only fetch. `load` is redeclared each render, so listing it would
    // refetch on every render; subsequent refreshes go through `run()`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      if (msg) notify(msg);
    } catch (e) {
      notify((e as Error).message === "duplicate_city" ? "المدينة موجودة مسبقاً." : "تعذّرت العملية.");
    } finally {
      setBusy(false);
    }
  }

  async function onAdd() {
    if (!f.name.trim()) return;
    await run(
      () => addCity({ name: f.name.trim(), shippingCost: toCentimes(f.cost), estimatedDays: f.days ? Number(f.days) : null }),
      "تمت إضافة المدينة",
    );
    setF({ name: "", cost: "", days: "" });
  }

  if (!rows) return <Skeleton className="h-64" />;

  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-ink">
        <MapPin className="h-4 w-4 text-brand" /> المدن ({rows.length})
      </h3>

      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="px-3 py-2 font-bold">المدينة</th>
              <th className="px-3 py-2 font-bold">تكلفة الشحن</th>
              <th className="px-3 py-2 font-bold">أيام التوصيل</th>
              <th className="px-3 py-2 font-bold">الحالة</th>
              {canManage && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-line/70 last:border-0">
                <td className="px-3 py-2 font-bold text-ink">{c.name}</td>
                <td className="px-3 py-2">{c.shippingCost != null ? formatMoney(c.shippingCost) : "—"}</td>
                <td className="px-3 py-2">{c.estimatedDays != null ? `${c.estimatedDays} يوم` : "—"}</td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <button
                      onClick={() => run(() => editCity(c.id, { isActive: !c.isActive }), "")}
                      disabled={busy}
                      className={`rounded-lg px-2 py-1 text-xs font-bold ${c.isActive ? "bg-success-soft text-success" : "bg-line/60 text-muted"}`}
                    >
                      {c.isActive ? "مفعّلة" : "معطّلة"}
                    </button>
                  ) : (
                    <span className="text-xs text-muted">{c.isActive ? "مفعّلة" : "معطّلة"}</span>
                  )}
                </td>
                {canManage && (
                  <td className="px-3 py-2">
                    <button onClick={() => run(() => deleteCity(c.id), "تم الحذف")} disabled={busy} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger" aria-label="حذف">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="py-4 text-center text-sm text-faint">لا توجد مدن.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {canManage && (
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسم المدينة" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" aria-label="اسم المدينة الجديدة" />
          <input value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} type="number" placeholder="تكلفة الشحن (درهم)" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" />
          <input value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} type="number" placeholder="أيام التوصيل" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" />
          <Button size="sm" onClick={onAdd} disabled={busy || !f.name.trim()}>
            <Plus className="h-4 w-4" /> إضافة
          </Button>
        </div>
      )}
    </Card>
  );
}

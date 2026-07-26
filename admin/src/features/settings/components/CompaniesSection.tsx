import { useEffect, useState } from "react";
import { Plus, Trash2, Truck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCompanies, addCompany, editCompany, deleteCompany } from "../api";
import type { ShippingCompany } from "../types";

export function CompaniesSection({ canManage, notify }: { canManage: boolean; notify: (m: string) => void }) {
  const [rows, setRows] = useState<ShippingCompany[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ name: "", phone: "", website: "", notes: "" });

  async function load() {
    try {
      setRows((await getCompanies()).data);
    } catch {
      notify("تعذّر تحميل الشركات");
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      await load();
      if (msg) notify(msg);
    } catch (e) {
      notify((e as Error).message === "duplicate_company" ? "الشركة موجودة مسبقاً." : "تعذّرت العملية.");
    } finally {
      setBusy(false);
    }
  }

  async function onAdd() {
    if (!f.name.trim()) return;
    await run(
      () => addCompany({ name: f.name.trim(), phone: f.phone.trim() || null, website: f.website.trim() || null, notes: f.notes.trim() || null }),
      "تمت إضافة الشركة",
    );
    setF({ name: "", phone: "", website: "", notes: "" });
  }

  if (!rows) return <Skeleton className="h-64" />;

  return (
    <Card className="p-5">
      <h3 className="mb-4 flex items-center gap-2 font-bold text-ink">
        <Truck className="h-4 w-4 text-brand" /> شركات الشحن ({rows.length})
      </h3>

      <ul className="mb-4 space-y-2">
        {rows.map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
            <input
              key={c.id + c.name}
              defaultValue={c.name}
              disabled={!canManage || busy}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) run(() => editCompany(c.id, { name: v }), "تم التعديل");
              }}
              className="min-w-0 flex-1 bg-transparent text-sm font-bold text-ink outline-none"
              aria-label="اسم الشركة"
            />
            <span className="text-xs text-muted" dir="ltr">{c.phone || "—"}</span>
            {canManage && (
              <>
                <button
                  onClick={() => run(() => editCompany(c.id, { isActive: !c.isActive }), "")}
                  disabled={busy}
                  className={`rounded-lg px-2 py-1 text-xs font-bold ${c.isActive ? "bg-success-soft text-success" : "bg-line/60 text-muted"}`}
                >
                  {c.isActive ? "مفعّلة" : "معطّلة"}
                </button>
                <button
                  onClick={() => run(() => deleteCompany(c.id), "تم الحذف")}
                  disabled={busy}
                  className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger"
                  aria-label="حذف"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </li>
        ))}
        {rows.length === 0 && <li className="py-3 text-center text-sm text-faint">لا توجد شركات.</li>}
      </ul>

      {canManage && (
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسم الشركة" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" aria-label="اسم الشركة الجديدة" />
          <input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="الهاتف" dir="ltr" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" />
          <input value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} placeholder="الموقع" dir="ltr" className="h-10 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand" />
          <Button size="sm" onClick={onAdd} disabled={busy || !f.name.trim()}>
            <Plus className="h-4 w-4" /> إضافة
          </Button>
        </div>
      )}
    </Card>
  );
}

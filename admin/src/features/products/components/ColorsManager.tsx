import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { addColor, editColor, deleteColor, reorderColors } from "../api";
import type { ProductColor } from "../types";

export function ColorsManager({
  productId,
  colors,
  onChanged,
  notify,
}: {
  productId: string;
  colors: ProductColor[];
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [swatch, setSwatch] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, msg: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
      if (msg) notify(msg);
    } catch (e) {
      notify(errorMsg((e as Error).message));
    } finally {
      setBusy(false);
    }
  }

  async function onAdd() {
    if (!name.trim()) return;
    await run(() => addColor(productId, { name: name.trim(), swatch: swatch.trim() || null }), "تمت إضافة اللون");
    setName("");
    setSwatch("");
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...colors];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    run(() => reorderColors(productId, next.map((c) => c.id)), "");
  }

  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold text-ink">الألوان ({colors.length})</h3>

      <ul className="mb-4 space-y-2">
        {colors.map((c, i) => (
          <li key={c.id} className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
            <span
              className="h-5 w-5 shrink-0 rounded-full border border-line"
              style={{ backgroundColor: c.swatch || "var(--color-line)" }}
            />
            <input
              key={c.id + c.name}
              defaultValue={c.name}
              disabled={busy}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== c.name) run(() => editColor(productId, c.id, { name: v }), "تم تعديل اللون");
              }}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none"
              aria-label="اسم اللون"
            />
            <button
              onClick={() => run(() => editColor(productId, c.id, { isActive: !c.isActive }), "")}
              disabled={busy}
              className={`rounded-lg px-2 py-1 text-xs font-bold ${c.isActive ? "bg-success-soft text-success" : "bg-line/60 text-muted"}`}
              title={c.isActive ? "مفعّل" : "معطّل"}
            >
              {c.isActive ? "مفعّل" : "معطّل"}
            </button>
            <div className="flex items-center">
              <button onClick={() => move(i, -1)} disabled={busy || i === 0} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-soft disabled:opacity-30" aria-label="أعلى">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button onClick={() => move(i, 1)} disabled={busy || i === colors.length - 1} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-soft disabled:opacity-30" aria-label="أسفل">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => run(() => deleteColor(productId, c.id), "تم حذف اللون")}
              disabled={busy}
              className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger"
              aria-label="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {colors.length === 0 && <li className="py-3 text-center text-sm text-faint">لا توجد ألوان.</li>}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={swatch}
          onChange={(e) => setSwatch(e.target.value)}
          placeholder="#لون"
          className="h-10 w-24 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand"
          aria-label="كود اللون"
        />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="اسم اللون الجديد"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand"
          aria-label="اسم اللون الجديد"
        />
        <Button size="sm" onClick={onAdd} disabled={busy || !name.trim()}>
          <Plus className="h-4 w-4" /> إضافة
        </Button>
      </div>
    </Card>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function errorMsg(code: string): string {
  switch (code) {
    case "duplicate_color":
      return "هذا اللون موجود مسبقاً.";
    case "duplicate_size":
      return "هذا المقاس موجود مسبقاً.";
    default:
      return "تعذّرت العملية.";
  }
}

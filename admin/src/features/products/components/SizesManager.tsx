import { useState } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { addSize, editSize, deleteSize, reorderSizes } from "../api";
import { errorMsg } from "./ColorsManager";
import type { ProductSize } from "../types";

export function SizesManager({
  productId,
  sizes,
  onChanged,
  notify,
}: {
  productId: string;
  sizes: ProductSize[];
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const [label, setLabel] = useState("");
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
    if (!label.trim()) return;
    await run(() => addSize(productId, { label: label.trim() }), "تمت إضافة المقاس");
    setLabel("");
  }

  function move(index: number, dir: -1 | 1) {
    const next = [...sizes];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    run(() => reorderSizes(productId, next.map((s) => s.id)), "");
  }

  return (
    <Card className="p-5">
      <h3 className="mb-4 font-bold text-ink">المقاسات ({sizes.length})</h3>

      <ul className="mb-4 space-y-2">
        {sizes.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2">
            <input
              key={s.id + s.label}
              defaultValue={s.label}
              disabled={busy}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== s.label) run(() => editSize(productId, s.id, { label: v }), "تم تعديل المقاس");
              }}
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-ink outline-none"
              aria-label="المقاس"
            />
            <div className="flex items-center">
              <button onClick={() => move(i, -1)} disabled={busy || i === 0} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-soft disabled:opacity-30" aria-label="أعلى">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button onClick={() => move(i, 1)} disabled={busy || i === sizes.length - 1} className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-brand-soft disabled:opacity-30" aria-label="أسفل">
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <button
              onClick={() => run(() => deleteSize(productId, s.id), "تم حذف المقاس")}
              disabled={busy}
              className="grid h-7 w-7 place-items-center rounded text-muted hover:bg-danger-soft hover:text-danger"
              aria-label="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
        {sizes.length === 0 && <li className="py-3 text-center text-sm text-faint">لا توجد مقاسات.</li>}
      </ul>

      <div className="flex items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="مقاس جديد (مثال: 4XL)"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand"
          aria-label="مقاس جديد"
        />
        <Button size="sm" onClick={onAdd} disabled={busy || !label.trim()}>
          <Plus className="h-4 w-4" /> إضافة
        </Button>
      </div>
    </Card>
  );
}

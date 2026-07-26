import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { transitionOrder } from "../api";
import { ACTION_META, nextStatuses } from "../workflow";
import type { OrderDetail } from "../types";
import type { OrderStatus } from "@/features/orders/types";

export function WorkflowActions({
  orderId,
  status,
  onTransitioned,
  notify,
}: {
  orderId: string;
  status: OrderStatus;
  onTransitioned: (detail: OrderDetail) => void;
  notify: (msg: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const actions = nextStatuses(status);

  async function act(target: OrderStatus) {
    setBusy(target);
    try {
      const res = await transitionOrder(orderId, target, note.trim() || undefined);
      onTransitioned(res.data);
      setNote("");
      notify("تم تحديث الحالة");
    } catch (e) {
      const m = (e as Error).message;
      notify(m === "invalid_transition" ? "هذا الانتقال غير مسموح." : "تعذّر تحديث الحالة.");
    } finally {
      setBusy(null);
    }
  }

  if (actions.length === 0) {
    return <p className="text-sm text-faint">لا توجد إجراءات متاحة (حالة نهائية).</p>;
  }

  return (
    <div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="ملاحظة اختيارية مع الإجراء…"
        className="mb-3 h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        aria-label="ملاحظة الإجراء"
      />
      <div className="flex flex-wrap gap-2">
        {actions.map((t) => (
          <Button key={t} size="sm" variant={ACTION_META[t].variant} onClick={() => act(t)} disabled={busy !== null}>
            {busy === t ? "…" : ACTION_META[t].label}
          </Button>
        ))}
      </div>
    </div>
  );
}

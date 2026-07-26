import { useState } from "react";
import { Send } from "lucide-react";
import { Drawer } from "@/components/ui/Drawer";
import { Badge } from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { OrderActions } from "@/features/orders/components/OrderActions";
import { STATUS_META } from "@/features/orders/status";
import { formatMoney } from "@/lib/format";
import { WorkflowActions } from "./WorkflowActions";
import { ShipmentForm } from "./ShipmentForm";
import { OrderTimeline } from "./OrderTimeline";
import { addOrderNote } from "../api";
import { useOrderDetail } from "../useOrderDetail";

function SectionTitle({ children }: { children: string }) {
  return <h3 className="mb-3 text-xs font-black uppercase tracking-wide text-faint">{children}</h3>;
}

export function ShippingDrawer({
  orderId,
  onClose,
  onChanged,
  notify,
}: {
  orderId: string | null;
  onClose: () => void;
  onChanged: () => void;
  notify: (msg: string) => void;
}) {
  const { order, loading, error, setOrder, refetch } = useOrderDetail(orderId);
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  async function submitNote() {
    if (!order || !note.trim()) return;
    setAddingNote(true);
    try {
      await addOrderNote(order.id, note.trim());
      setNote("");
      await refetch();
      notify("تمت إضافة الملاحظة");
    } catch {
      notify("تعذّرت إضافة الملاحظة");
    } finally {
      setAddingNote(false);
    }
  }

  return (
    <Drawer open={!!orderId} onClose={onClose} title={order ? `طلب ${order.orderNumber}` : "تفاصيل الشحن"}>
      {loading && !order ? (
        <div className="grid place-items-center gap-3 py-20 text-muted">
          <Spinner className="h-7 w-7 text-brand" />
          <span className="text-sm">جارٍ التحميل…</span>
        </div>
      ) : error && !order ? (
        <div className="py-10 text-center text-sm text-danger">{error}</div>
      ) : order ? (
        <div className="space-y-6">
          {/* Summary */}
          <div>
            <div className="flex items-center justify-between">
              <Badge tone={STATUS_META[order.status].tone}>{STATUS_META[order.status].label}</Badge>
              <span className="text-lg font-black text-brand-dark">{formatMoney(order.totalPrice)}</span>
            </div>
            <div className="mt-3 rounded-xl border border-line bg-bg p-3 text-sm">
              <div className="font-bold text-ink">{order.customer.fullName}</div>
              <div className="text-muted" dir="ltr">{order.customer.phone}</div>
              <div className="text-muted">{order.customer.city} — {order.customer.address}</div>
              <div className="mt-1 text-xs text-faint">
                {order.items.map((it) => `${it.sizeLabel} — ${it.colorName}`).join("، ")}
              </div>
              <div className="mt-2">
                <OrderActions phone={order.customer.phone} orderNumber={order.orderNumber} />
              </div>
            </div>
          </div>

          {/* Workflow actions */}
          <section>
            <SectionTitle>إجراءات سير العمل</SectionTitle>
            <WorkflowActions
              orderId={order.id}
              status={order.status}
              onTransitioned={(d) => {
                setOrder(d);
                onChanged();
              }}
              notify={notify}
            />
          </section>

          {/* Shipment info */}
          <section>
            <ShipmentForm
              orderId={order.id}
              shipment={order.shipment}
              onSaved={(s) => {
                setOrder({ ...order, shipment: s });
                onChanged();
              }}
              notify={notify}
            />
          </section>

          {/* Timeline */}
          <section>
            <SectionTitle>المسار الزمني</SectionTitle>
            <OrderTimeline createdAt={order.createdAt} events={order.timeline} />
          </section>

          {/* Internal notes */}
          <section>
            <SectionTitle>ملاحظة داخلية</SectionTitle>
            <div className="flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNote()}
                placeholder="أضيفي ملاحظة إلى المسار…"
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                aria-label="ملاحظة داخلية"
              />
              <Button size="sm" onClick={submitNote} disabled={addingNote || !note.trim()}>
                <Send className="h-4 w-4" /> إضافة
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </Drawer>
  );
}

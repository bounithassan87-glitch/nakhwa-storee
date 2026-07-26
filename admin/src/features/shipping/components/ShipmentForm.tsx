import { useEffect, useState } from "react";
import { Truck, Save } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { saveShipment } from "../api";
import type { Shipment } from "../types";

const toDh = (c: number | null | undefined) => (c == null ? "" : String(c / 100));
const toCentimes = (s: string): number | null => {
  const t = s.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
};
const toDay = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : "");

export function ShipmentForm({
  orderId,
  shipment,
  onSaved,
  notify,
}: {
  orderId: string;
  shipment: Shipment | null;
  onSaved: (s: Shipment) => void;
  notify: (msg: string) => void;
}) {
  const [f, setF] = useState({
    company: "",
    trackingNumber: "",
    shippingCost: "",
    codAmount: "",
    estimatedDeliveryAt: "",
    deliveredAt: "",
    status: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setF({
      company: shipment?.company ?? "",
      trackingNumber: shipment?.trackingNumber ?? "",
      shippingCost: toDh(shipment?.shippingCost),
      codAmount: toDh(shipment?.codAmount),
      estimatedDeliveryAt: toDay(shipment?.estimatedDeliveryAt),
      deliveredAt: toDay(shipment?.deliveredAt),
      status: shipment?.status ?? "",
    });
  }, [shipment]);

  async function onSave() {
    setSaving(true);
    try {
      const res = await saveShipment(orderId, {
        company: f.company.trim() || null,
        trackingNumber: f.trackingNumber.trim() || null,
        shippingCost: toCentimes(f.shippingCost),
        codAmount: toCentimes(f.codAmount),
        estimatedDeliveryAt: f.estimatedDeliveryAt || null,
        deliveredAt: f.deliveredAt || null,
        status: f.status.trim() || null,
      });
      onSaved(res.data);
      notify("تم حفظ بيانات الشحنة");
    } catch {
      notify("تعذّر حفظ الشحنة");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 font-bold text-ink">
          <Truck className="h-4 w-4 text-brand" /> بيانات الشحنة
        </h4>
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "جارٍ الحفظ…" : "حفظ"}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="شركة الشحن" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
        <Input label="رقم التتبع" value={f.trackingNumber} onChange={(e) => setF({ ...f, trackingNumber: e.target.value })} dir="ltr" />
        <Input label="تكلفة الشحن (درهم)" type="number" value={f.shippingCost} onChange={(e) => setF({ ...f, shippingCost: e.target.value })} />
        <Input label="مبلغ الدفع عند الاستلام (درهم)" type="number" value={f.codAmount} onChange={(e) => setF({ ...f, codAmount: e.target.value })} />
        <Input label="تاريخ التوصيل المتوقع" type="date" value={f.estimatedDeliveryAt} onChange={(e) => setF({ ...f, estimatedDeliveryAt: e.target.value })} />
        <Input label="تاريخ التوصيل الفعلي" type="date" value={f.deliveredAt} onChange={(e) => setF({ ...f, deliveredAt: e.target.value })} />
        <Input label="حالة الشحنة (لدى الشركة)" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} />
      </div>
    </div>
  );
}

import { Clock, CheckCircle2, Package, PackageCheck, Truck, CheckCheck, Undo2, XCircle, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { STATUS_META } from "@/features/orders/status";
import { KPI_STATUSES } from "../workflow";
import type { OrderStatus } from "@/features/orders/types";

const ICONS: Partial<Record<OrderStatus, LucideIcon>> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  PREPARING: Package,
  READY_TO_SHIP: PackageCheck,
  IN_TRANSIT: Truck,
  DELIVERED: CheckCheck,
  RETURNED: Undo2,
  CANCELLED: XCircle,
};

export function ShippingKPIs({ counts }: { counts: Record<OrderStatus, number> }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8">
      {KPI_STATUSES.map((s) => {
        const Icon = ICONS[s] ?? Package;
        return (
          <Card key={s} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand-dark">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-2xl font-black text-ink">{counts?.[s] ?? 0}</span>
            </div>
            <p className="mt-2 text-xs font-bold text-muted">{STATUS_META[s].label}</p>
          </Card>
        );
      })}
    </div>
  );
}

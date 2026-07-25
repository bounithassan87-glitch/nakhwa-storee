import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 text-2xl font-black text-ink">{value}</p>
          {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
        </div>
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand-dark">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </Card>
  );
}

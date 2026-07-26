import { PackagePlus } from "lucide-react";
import { STATUS_META } from "@/features/orders/status";
import { formatDate } from "@/lib/format";
import type { TimelineEvent } from "../types";

const DOT: Record<string, string> = {
  neutral: "bg-line",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  brand: "bg-brand",
  gold: "bg-gold",
};

function Node({
  color,
  title,
  time,
  note,
  actor,
  last,
}: {
  color: string;
  title: string;
  time: string;
  note?: string | null;
  actor?: string | null;
  last?: boolean;
}) {
  return (
    <li className="relative flex gap-3 ps-1">
      {!last && <span className="absolute top-5 h-full w-px bg-line" style={{ insetInlineStart: "0.6875rem" }} />}
      <span className={`relative z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full ${color} text-white`}>
        <span className="h-2 w-2 rounded-full bg-white/90" />
      </span>
      <div className="pb-5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold text-ink">{title}</span>
          <span className="text-xs text-faint">{time}</span>
        </div>
        {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
        {actor && <p className="mt-0.5 text-xs text-faint">— {actor}</p>}
      </div>
    </li>
  );
}

export function OrderTimeline({ createdAt, events }: { createdAt: string; events: TimelineEvent[] }) {
  return (
    <ul className="space-y-0">
      <li className="relative flex gap-3 ps-1">
        {events.length > 0 && <span className="absolute top-5 h-full w-px bg-line" style={{ insetInlineStart: "0.6875rem" }} />}
        <span className="relative z-10 mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-dark text-white">
          <PackagePlus className="h-3.5 w-3.5" />
        </span>
        <div className="pb-5">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-bold text-ink">تم إنشاء الطلب</span>
            <span className="text-xs text-faint">{formatDate(createdAt)}</span>
          </div>
        </div>
      </li>

      {events.map((e, i) => (
        <Node
          key={e.id}
          color={DOT[STATUS_META[e.status].tone] ?? "bg-brand"}
          title={STATUS_META[e.status].label}
          time={formatDate(e.createdAt)}
          note={e.note}
          actor={e.actor}
          last={i === events.length - 1}
        />
      ))}
    </ul>
  );
}

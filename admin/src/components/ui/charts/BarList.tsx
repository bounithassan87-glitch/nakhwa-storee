// Horizontal bar list (DOM, not SVG) — clean and responsive for ranked
// categories like top cities / best sellers. RTL: bars grow from the start (right)
// edge, matching the reading direction.

export interface BarItem {
  label: string;
  value: number;
  /** Optional secondary text shown after the value (e.g. revenue). */
  hint?: string;
}

export function BarList({
  items,
  color = "var(--color-brand)",
  formatValue = (v: number) => String(v),
}: {
  items: BarItem[];
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="truncate font-medium text-ink">{it.label}</span>
            <span className="shrink-0 font-bold text-ink">
              {formatValue(it.value)}
              {it.hint && <span className="ms-1 text-xs font-normal text-faint">{it.hint}</span>}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-line/60">
            <div
              className="h-full rounded-full transition-[width] duration-500"
              style={{ width: `${(it.value / max) * 100}%`, backgroundColor: color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

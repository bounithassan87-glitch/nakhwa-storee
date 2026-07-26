// Dependency-free donut chart with legend (SVG). Used for order-status
// distribution. Renders an empty ring when there is no data.

export interface DonutSegment {
  label: string;
  value: number;
  color: string; // CSS color (e.g. var(--color-success))
}

export function DonutChart({
  segments,
  size = 176,
  thickness = 26,
}: {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;

  let offset = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = s.value / total;
      const len = frac * c;
      const arc = { color: s.color, dash: `${len} ${c - len}`, dashoffset: -offset };
      offset += len;
      return arc;
    });

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" className="shrink-0">
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--color-line)" strokeWidth={thickness} />
          {total > 0 &&
            arcs.map((a, i) => (
              <circle
                key={i}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={a.color}
                strokeWidth={thickness}
                strokeDasharray={a.dash}
                strokeDashoffset={a.dashoffset}
              />
            ))}
        </g>
        <text x={cx} y={cx - 4} textAnchor="middle" fontSize={26} fontWeight={800} fill="var(--color-ink)">
          {total}
        </text>
        <text x={cx} y={cx + 18} textAnchor="middle" fontSize={13} fill="var(--color-muted)">
          طلب
        </text>
      </svg>

      <ul className="space-y-2">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
            <span className="text-muted">{s.label}</span>
            <span className="font-bold text-ink">{s.value}</span>
            <span className="text-xs text-faint">
              {total ? Math.round((s.value / total) * 100) : 0}٪
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

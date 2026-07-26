// Dependency-free, responsive area/line chart (SVG). Uniform-scaling viewBox so
// it shrinks cleanly on mobile while keeping labels legible. RTL-safe: the time
// axis reads left→right (chronological) which is conventional for charts even in
// RTL layouts.
import { useId } from "react";

export interface AreaPoint {
  label: string; // x-axis label (e.g. day)
  value: number;
}

const W = 720;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

export function AreaChart({
  data,
  height = 240,
  color = "var(--color-brand)",
  formatValue = (v: number) => String(v),
}: {
  data: AreaPoint[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
}) {
  const gid = useId();
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;

  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");
  const areaPath = n
    ? `${linePath} L ${x(n - 1)} ${PAD.top + innerH} L ${x(0)} ${PAD.top + innerH} Z`
    : "";

  const gridVals = [0, 0.5, 1].map((f) => f * max);
  const labelIdxs = n <= 1 ? [0] : [0, Math.floor((n - 1) / 2), n - 1];

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} role="img" className="overflow-visible">
      <defs>
        <linearGradient id={`area-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {gridVals.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--color-line)"
            strokeWidth={1}
          />
          <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--color-faint)">
            {formatValue(v)}
          </text>
        </g>
      ))}

      {areaPath && <path d={areaPath} fill={`url(#area-${gid})`} />}
      {linePath && <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={n > 40 ? 0 : 3} fill={color} />
      ))}

      {labelIdxs.map((i) => (
        <text key={i} x={x(i)} y={height - 8} textAnchor="middle" fontSize={12} fill="var(--color-faint)">
          {data[i]?.label}
        </text>
      ))}
    </svg>
  );
}

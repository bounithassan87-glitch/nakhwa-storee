// Display formatters for derived metrics (values themselves come from the server).

/** ROAS / multiplier, e.g. 3.25 → "3.25×". */
export function formatX(v: number): string {
  return `${v.toFixed(2)}×`;
}

/** Ratio 0..1 → percentage, e.g. 0.0333 → "3.33٪". */
export function formatPct(v: number, digits = 2): string {
  return `${(v * 100).toFixed(digits)}٪`;
}

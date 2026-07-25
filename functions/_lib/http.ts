// Small HTTP helpers shared by the API functions.
export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

/** Structured single-line JSON log (queryable in Cloudflare Logs / tail). */
export function log(level: "info" | "warn" | "error", fields: Record<string, unknown>): void {
  const line = JSON.stringify({ level, ts: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

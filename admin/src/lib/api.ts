// Fetch wrapper for the admin API. Sends the session cookie (credentials) and,
// on mutating requests, the double-submit CSRF token. A global handler fires on
// any 401 so the app can redirect an expired session to /login.

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)admin_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function parse(res: Response) {
  if (res.status === 401) onUnauthorized?.();
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

export async function apiGet<T = unknown>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    signal,
    credentials: "include",
    headers: { accept: "application/json" },
  });
  return parse(res) as Promise<T>;
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
    body: JSON.stringify(body),
  });
  return parse(res) as Promise<T>;
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse(res) as Promise<T>;
}

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

/** The envelope every admin API response shares (`{ ok, error?, ... }`). */
interface ApiEnvelope {
  ok?: unknown;
  error?: unknown;
}

/** Narrow an unknown JSON body to the response envelope, or null if it isn't one. */
function asEnvelope(body: unknown): ApiEnvelope | null {
  // `ApiEnvelope` has only optional members, so a non-null object already
  // satisfies it — no assertion needed.
  return typeof body === "object" && body !== null ? body : null;
}

/**
 * Validate the response envelope and return the parsed body.
 *
 * `Response.json()` is typed `any`, which previously leaked straight through
 * this function's return value into every call site — every `apiGet<T>()`
 * result was effectively unchecked. The body is now read as `unknown` and
 * narrowed here, so the single `body as T` below is the one explicit trust
 * boundary between the server's response shape and the client's types.
 */
async function parse<T>(res: Response): Promise<T> {
  if (res.status === 401) onUnauthorized?.();
  const body: unknown = await res.json().catch(() => null);
  const envelope = asEnvelope(body);
  if (!res.ok || !envelope?.ok) {
    const message = typeof envelope?.error === "string" ? envelope.error : `HTTP ${res.status}`;
    throw new Error(message);
  }
  return body as T;
}

export async function apiGet<T = unknown>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    signal,
    credentials: "include",
    headers: { accept: "application/json" },
  });
  return parse<T>(res);
}

export async function apiPatch<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
    body: JSON.stringify(body),
  });
  return parse<T>(res);
}

export async function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json", "x-csrf-token": csrfToken() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(res);
}

export async function apiDelete<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, {
    method: "DELETE",
    credentials: "include",
    headers: { accept: "application/json", "x-csrf-token": csrfToken() },
  });
  return parse<T>(res);
}

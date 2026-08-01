// Firebase Cloud Messaging — HTTP v1 sender for the Workers runtime.
//
// v1 authenticates with a short-lived OAuth2 access token minted from a service
// account, not with a legacy server key. The JWT is signed here with WebCrypto,
// so there is no Node crypto and no Google SDK in the bundle.
//
// Everything degrades quietly: with no service account configured, `sendPush`
// reports that it did nothing and the caller carries on. Push is an addition to
// the dashboard's sound/popup/badge, never a dependency of taking an order.
import { log } from "../../_lib/http";

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Opened when the notification is clicked. */
  link: string;
  /** Collapses repeats of the same order into one notification. */
  tag: string;
}

export interface SendResult {
  sent: number;
  /** Tokens FCM rejected as dead — the caller should delete these rows. */
  invalid: string[];
  /** Set when push is not configured; not an error. */
  skipped?: string;
}

/** Access tokens last an hour; reuse within the isolate rather than per send. */
let cachedToken: { value: string; expiresAt: number } | null = null;

function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const sa = parsed as Partial<ServiceAccount>;
    if (!sa.project_id || !sa.client_email || !sa.private_key) return null;
    return { project_id: sa.project_id, client_email: sa.client_email, private_key: sa.private_key };
  } catch {
    return null;
  }
}

const b64url = (bytes: ArrayBuffer | Uint8Array): string => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/** PEM (PKCS#8) → the ArrayBuffer WebCrypto wants. */
function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** Exchange a self-signed JWT for a Google OAuth2 access token. */
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) return cachedToken.value;

  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const claims = b64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600,
      }),
    ),
  );
  const unsigned = `${header}.${claims}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    // Service-account JSON stores the PEM with literal \n sequences.
    pemToDer(sa.private_key.replace(/\\n/g, "\n")),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const assertion = `${unsigned}.${b64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`oauth_failed_${res.status}`);
  const body: { access_token?: string; expires_in?: number } = await res.json();
  if (!body.access_token) throw new Error("oauth_no_token");

  cachedToken = { value: body.access_token, expiresAt: now + (body.expires_in ?? 3600) };
  return body.access_token;
}

/**
 * Deliver one notification to many devices.
 *
 * v1 sends per token, so this fans out and tolerates individual failures: one
 * dead device must not stop the rest. Tokens FCM reports as unregistered come
 * back in `invalid` so the caller can prune them.
 */
export async function sendPush(
  serviceAccountJson: string | undefined,
  tokens: string[],
  payload: PushPayload,
  reqId?: string,
): Promise<SendResult> {
  const sa = parseServiceAccount(serviceAccountJson);
  if (!sa) return { sent: 0, invalid: [], skipped: "not_configured" };
  if (tokens.length === 0) return { sent: 0, invalid: [], skipped: "no_devices" };

  let accessToken: string;
  try {
    accessToken = await getAccessToken(sa);
  } catch (err) {
    log("error", { reqId, msg: "fcm_auth_failed", error: err instanceof Error ? err.message : String(err) });
    return { sent: 0, invalid: [], skipped: "auth_failed" };
  }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`;
  const invalid: string[] = [];
  let sent = 0;

  const results = await Promise.allSettled(
    tokens.map(async (token) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            // `data` only: the service worker renders the notification itself,
            // which keeps one code path for foreground and background instead
            // of the browser drawing its own for `notification` messages.
            data: {
              title: payload.title,
              body: payload.body,
              link: payload.link,
              tag: payload.tag,
            },
            webpush: {
              headers: { Urgency: "high", TTL: "86400" },
              fcm_options: { link: payload.link },
            },
          },
        }),
      });

      if (res.ok) return { token, ok: true as const };

      // 404 UNREGISTERED / 400 INVALID_ARGUMENT on the token means the device is
      // gone (app uninstalled, permission revoked, token rotated).
      const text = await res.text();
      if (res.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(text)) {
        return { token, ok: false as const, dead: true };
      }
      log("warn", { reqId, msg: "fcm_send_failed", status: res.status, detail: text.slice(0, 200) });
      return { token, ok: false as const, dead: false };
    }),
  );

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    if (r.value.ok) sent++;
    else if (r.value.dead) invalid.push(r.value.token);
  }

  return { sent, invalid };
}

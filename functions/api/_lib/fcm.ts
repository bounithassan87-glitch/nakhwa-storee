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
  /** Absolute URL — a relative path is not resolvable from the push service. */
  icon: string;
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
 * Report where push configuration stands, without revealing any of it.
 *
 * Push failing is silent by design — an order must never be held up by it —
 * which leaves no way to tell a missing secret from a malformed one from a
 * rejected key. This answers that question and returns only booleans, the
 * public project id, and an error code.
 */
export async function checkPushConfig(serviceAccountJson: string | undefined): Promise<{
  configured: boolean;
  parsed: boolean;
  projectId: string | null;
  clientEmailDomain: string | null;
  oauth: "ok" | "failed" | "skipped";
  oauthError?: string;
}> {
  const configured = typeof serviceAccountJson === "string" && serviceAccountJson.length > 0;
  const sa = parseServiceAccount(serviceAccountJson);
  if (!sa) {
    return { configured, parsed: false, projectId: null, clientEmailDomain: null, oauth: "skipped" };
  }
  try {
    cachedToken = null; // force a real exchange rather than reporting on a cached one
    await getAccessToken(sa);
    return {
      configured: true,
      parsed: true,
      projectId: sa.project_id,
      clientEmailDomain: sa.client_email.split("@")[1] ?? null,
      oauth: "ok",
    };
  } catch (err) {
    return {
      configured: true,
      parsed: true,
      projectId: sa.project_id,
      clientEmailDomain: sa.client_email.split("@")[1] ?? null,
      oauth: "failed",
      oauthError: err instanceof Error ? err.message : String(err),
    };
  }
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
            // A `webpush.notification` block, not data-only.
            //
            // Data-only messages are displayed by our own service worker, which
            // means nothing appears unless that worker is running — so they
            // arrive while the dashboard is open and silently do not when the
            // browser is closed. With a notification block the push service and
            // the browser render it themselves, with no code of ours in the
            // path, which is what makes background delivery work.
            notification: { title: payload.title, body: payload.body },
            webpush: {
              // Urgency high asks the push service not to batch it; TTL keeps it
              // queued for a day so a device that is offline still gets it when
              // it comes back.
              headers: { Urgency: "high", TTL: "86400" },
              notification: {
                title: payload.title,
                body: payload.body,
                icon: payload.icon,
                badge: payload.icon,
                // The order id — a repeat replaces rather than stacks.
                tag: payload.tag,
                // Orders should not disappear on their own before they are seen.
                requireInteraction: true,
                dir: "rtl",
                lang: "ar",
                data: { link: payload.link },
              },
              // `fcm_options.link` is deliberately omitted: it installs the SDK's
              // own notificationclick handler alongside ours, and both would act
              // on the same click. The link travels in `notification.data`
              // instead, which our handler reads.
            },
            // Mirrored so the click handler can find the target whichever shape
            // the browser hands it back in.
            data: { link: payload.link, tag: payload.tag },
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

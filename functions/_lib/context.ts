// Typed request context for the Pages Functions pipeline.
//
// `PagesFunction<Env>` leaves its third type parameter (`Data`) at the default
// `Record<string, unknown>`, which is why handlers historically reached into the
// per-request bag with inline structural casts:
//
//     const reqId = (data as { reqId?: string }).reqId;
//     const role  = (data as { admin?: { role?: string } }).admin?.role;
//
// Those casts are unchecked assertions: if the middleware ever changed the shape
// it writes, nothing would fail to compile — and `admin.role` drives every
// `roleCan()` authorization decision. Declaring the shape once and threading it
// through `AppFunction` turns that into a compile-time contract between the
// middleware (producer) and the route handlers (consumers).
//
// Types only — erased at build time, so runtime behaviour is unchanged.
import type { Env } from "./env";

/**
 * The authenticated administrator, attached by
 * `functions/api/admin/_middleware.ts` after it verifies the session cookie.
 * Present on every `/api/admin/*` request except `/api/admin/auth/*`.
 */
export interface AdminIdentity {
  /** Admin email — the JWT `sub` claim; also used as the audit-log actor. */
  email: string;
  /** Role name (`owner` | `admin` | `staff`), consumed by `roleCan()`. */
  role: string;
}

/**
 * Per-request data carried through the middleware chain.
 *
 * The index signature is required to satisfy the `Data extends
 * Record<string, unknown>` constraint on `PagesFunction`; the declared members
 * still take precedence, so `data.reqId` is `string | undefined` rather than
 * `unknown`.
 */
export interface RequestData {
  /** Correlation id assigned by `functions/api/_middleware.ts`, used in logs. */
  reqId?: string;
  /** Set by the admin authorization middleware once the session is verified. */
  admin?: AdminIdentity;
  [key: string]: unknown;
}

/**
 * A Pages Function in this codebase: the project `Env` plus the typed
 * per-request `RequestData`.
 *
 * `Params` stays `string` (resolving to `Record<string, string | string[]>`),
 * preserving the existing `String(params.id ?? "")` access pattern.
 */
export type AppFunction<Params extends string = string> = PagesFunction<Env, Params, RequestData>;

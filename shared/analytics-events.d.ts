// Types for analytics-events.js.
//
// The module is plain JS so the Workers runtime, the Vite bundle and the plain
// browser script can all import it unchanged. These declarations give the
// TypeScript call sites real types instead of `any`.

export type EventType =
  | "page_view"
  | "form_view"
  | "form_start"
  | "form_submit"
  | "order_success";

/** Everything except order_success, which only the server may write. */
export type ClientEventType = Exclude<EventType, "order_success">;

export type SubmitOutcome = "attempt" | "success" | "failure";

export declare const EVENT_TYPES: readonly EventType[];
export declare const CLIENT_EVENT_TYPES: readonly ClientEventType[];
export declare const SUBMIT_OUTCOMES: readonly SubmitOutcome[];
export declare const LIMITS: Readonly<{
  sessionId: number;
  landingPage: number;
  productSlug: number;
  detail: number;
}>;

export declare function isValidSessionId(v: unknown): boolean;
export declare function isValidSlug(v: unknown): boolean;

/** A validated event, ready to insert. Carries no personal data. */
export interface AnalyticsEvent {
  type: ClientEventType;
  sessionId: string;
  landingPage: string;
  productSlug: string | null;
  outcome: SubmitOutcome | null;
  detail: string | null;
}

export type AnalyticsValidation =
  | { ok: true; value: AnalyticsEvent; error?: undefined }
  | { ok: false; error: string; value?: undefined };

export declare function validateAnalyticsEvent(input: unknown): AnalyticsValidation;

/** Percentage to one decimal, or null when the denominator is zero. */
export declare function rate(numerator: number, denominator: number): number | null;

export interface FunnelCounts {
  visitors?: number;
  formViews?: number;
  formStarts?: number;
  submitAttempts?: number;
  failedSubmissions?: number;
  orders?: number;
  abandoned?: number;
}

export interface Funnel {
  visitors: number;
  formViews: number;
  formStarts: number;
  submitAttempts: number;
  failedSubmissions: number;
  orders: number;
  abandoned: number;
  rates: {
    visitorsToFormViews: number | null;
    formViewsToStarts: number | null;
    startsToSubmits: number | null;
    submitsToOrders: number | null;
    conversion: number | null;
    formCompletion: number | null;
    abandonment: number | null;
  };
}

export declare function buildFunnel(counts: FunnelCounts): Funnel;

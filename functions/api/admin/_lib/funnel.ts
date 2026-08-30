// Landing-page funnel aggregates.
//
// Kept out of the analytics endpoint because the abandonment question is not a
// count — it is a set difference over session ids, and the SQL that answers it
// deserves to be read on its own.
//
// Everything here is read-only and reads no personal data: TrackingEvent holds
// an opaque session id, a page slug and an event type, and nothing else.
import type { PrismaClient } from "@prisma/client";
import { buildFunnel, type Funnel } from "../../../../shared/analytics-events.js";

export interface FunnelRow extends Funnel {
  landingPage: string;
}

interface Counts {
  visitors: number;
  formViews: number;
  formStarts: number;
  submitAttempts: number;
  failedSubmissions: number;
  orders: number;
  abandoned: number;
}

const EMPTY: Counts = {
  visitors: 0,
  formViews: 0,
  formStarts: 0,
  submitAttempts: 0,
  failedSubmissions: 0,
  orders: 0,
  abandoned: 0,
};

/**
 * Per-page counts for a window.
 *
 * `visitors` counts DISTINCT sessions rather than page_view rows: a reload is
 * the same person, and counting rows would inflate the top of the funnel and
 * make every rate below it look worse than it is.
 *
 * `abandoned` is the number of sessions that recorded a form_start and no
 * order_success — computed as a set difference, never as
 * `form_starts - orders`. Someone can start the form twice, come back the next
 * day, or place an order in a session that began before the window; subtraction
 * gets all three wrong and can even go negative.
 */
export async function funnelByLandingPage(
  prisma: PrismaClient,
  from: Date,
  to: Date,
): Promise<{ overall: Funnel; byPage: FunnelRow[] }> {
  const rows = await prisma.$queryRaw<
    {
      landing_page: string;
      visitors: bigint;
      form_views: bigint;
      form_starts: bigint;
      submit_attempts: bigint;
      failed_submissions: bigint;
      orders: bigint;
      abandoned: bigint;
    }[]
  >`
    WITH ev AS (
      SELECT landing_page, session_id, type, outcome
        FROM "TrackingEvent"
       WHERE created_at >= ${from} AND created_at <= ${to}
    ),
    started AS (
      SELECT DISTINCT landing_page, session_id FROM ev WHERE type = 'form_start'
    ),
    succeeded AS (
      SELECT DISTINCT landing_page, session_id FROM ev WHERE type = 'order_success'
    )
    SELECT
      ev.landing_page,
      COUNT(DISTINCT session_id) FILTER (WHERE type = 'page_view')                        AS visitors,
      COUNT(DISTINCT session_id) FILTER (WHERE type = 'form_view')                        AS form_views,
      COUNT(DISTINCT session_id) FILTER (WHERE type = 'form_start')                       AS form_starts,
      COUNT(*)                   FILTER (WHERE type = 'form_submit')                      AS submit_attempts,
      COUNT(*)                   FILTER (WHERE type = 'form_submit' AND outcome = 'failure') AS failed_submissions,
      COUNT(*)                   FILTER (WHERE type = 'order_success')                    AS orders,
      (
        SELECT COUNT(*) FROM started s
         WHERE s.landing_page = ev.landing_page
           AND NOT EXISTS (
             SELECT 1 FROM succeeded x
              WHERE x.landing_page = s.landing_page AND x.session_id = s.session_id
           )
      )                                                                                   AS abandoned
    FROM ev
    GROUP BY ev.landing_page
    ORDER BY visitors DESC, ev.landing_page ASC
  `;

  const byPage: FunnelRow[] = rows.map((r) => ({
    landingPage: r.landing_page,
    ...buildFunnel({
      visitors: Number(r.visitors),
      formViews: Number(r.form_views),
      formStarts: Number(r.form_starts),
      submitAttempts: Number(r.submit_attempts),
      failedSubmissions: Number(r.failed_submissions),
      orders: Number(r.orders),
      abandoned: Number(r.abandoned),
    }),
  }));

  // The overall figures are summed from the per-page rows for every count
  // EXCEPT the rates, which are recomputed — averaging percentages would weight
  // a page with three visitors the same as one with three thousand.
  const totals = byPage.reduce<Counts>(
    (acc, p) => ({
      visitors: acc.visitors + p.visitors,
      formViews: acc.formViews + p.formViews,
      formStarts: acc.formStarts + p.formStarts,
      submitAttempts: acc.submitAttempts + p.submitAttempts,
      failedSubmissions: acc.failedSubmissions + p.failedSubmissions,
      orders: acc.orders + p.orders,
      abandoned: acc.abandoned + p.abandoned,
    }),
    { ...EMPTY },
  );

  return { overall: buildFunnel(totals), byPage };
}

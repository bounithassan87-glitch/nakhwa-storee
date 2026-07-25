// Runs for every /api/* request: request logging, a request id, security
// headers, and a global error boundary so no unhandled error leaks a stack
// trace or an HTML error page to the client.
import type { Env } from "../_lib/env";
import { json, log } from "../_lib/http";

export const onRequest: PagesFunction<Env> = async (ctx) => {
  const start = Date.now();
  const reqId = crypto.randomUUID();
  const url = new URL(ctx.request.url);
  ctx.data.reqId = reqId; // made available to route handlers

  let res: Response;
  try {
    res = await ctx.next();
  } catch (err) {
    log("error", {
      reqId,
      method: ctx.request.method,
      path: url.pathname,
      msg: "unhandled_error",
      error: err instanceof Error ? err.message : String(err),
    });
    res = json({ ok: false, error: "server_error", reqId }, 500);
  }

  const out = new Response(res.body, res);
  out.headers.set("x-request-id", reqId);
  out.headers.set("x-content-type-options", "nosniff");
  out.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  out.headers.set("cache-control", "no-store");

  log("info", {
    reqId,
    method: ctx.request.method,
    path: url.pathname,
    status: out.status,
    ms: Date.now() - start,
  });
  return out;
};

// Permission guard for every /api/admin/products/* route.
//
// The parent middleware (functions/api/admin/_middleware.ts) authenticates the
// request and populates `data.admin` before calling `next()`, so by the time
// this runs the role is known. Authentication and CSRF are its concern; this
// file only answers "may this admin change the catalog?".
//
// Enforcing it here rather than inside each handler means every current route
// — product, colors, sizes, media — and every future one (a create or duplicate
// endpoint, say) is covered by construction, with no way to add a mutating
// endpoint that forgets the check.
//
// Reads stay open to any authenticated admin: `staff` fulfils orders and needs
// to see the catalog. Only mutations require `manage_products`, which the role
// matrix grants to OWNER (via "*") and ADMIN.
import type { AppFunction } from "../../../_lib/context";
import { json } from "../../../_lib/http";
import { roleCan } from "../_lib/permissions";

const READ_ONLY = new Set(["GET", "HEAD", "OPTIONS"]);

export const onRequest: AppFunction = async (ctx) => {
  if (READ_ONLY.has(ctx.request.method.toUpperCase())) return ctx.next();

  if (!roleCan(ctx.data.admin?.role, "manage_products")) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  return ctx.next();
};

// SPA deep-link fallback for the admin dashboard (served under /admin).
//
// Static assets under /admin (index.html, /admin/assets/*) are served directly.
// Any other /admin/* path — a client-side route like /admin/orders reached by a
// deep link or a page refresh — has no matching file, so we serve the admin shell
// (/admin/index.html) with a 200 and let React Router resolve the route.
//
// This uses the Pages `ASSETS` binding (rather than a `_redirects` rule, which
// Cloudflare's loop-detector rejects for a subpath SPA). Same-origin, so the
// admin's relative `/api` calls and SameSite=Strict session cookie are unaffected.
interface AssetsEnv {
  ASSETS: { fetch: (input: Request | URL | string) => Promise<Response> };
}

export const onRequest: PagesFunction<AssetsEnv> = async ({ request, env }) => {
  const url = new URL(request.url);

  // Serve the requested asset if it exists.
  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404) return asset;

  // Otherwise fall back to the admin SPA shell.
  const shell = await env.ASSETS.fetch(new URL("/admin/index.html", url.origin));
  return new Response(shell.body, {
    status: 200,
    headers: shell.headers,
  });
};

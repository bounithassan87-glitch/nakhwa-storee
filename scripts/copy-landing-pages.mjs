// Copies the standalone product landing pages into the Pages output.
//
// Each of these is a self-contained static page (its own HTML, CSS, JS and
// assets) that ships under its own path on the same origin as the API — which
// is what lets its order form POST a relative `/api/orders` and inherit
// whatever domain the site is served from.
//
// They are NOT built: no bundler, no npm install, nothing to compile. This is a
// copy plus the same placeholder stamping `set-site-url.mjs` does for the root
// page, so canonical and OpenGraph URLs are absolute in the deployed copy while
// the source keeps its relative paths and stays openable from `file://`.
//
// Run after the other build steps: node scripts/copy-landing-pages.mjs
import { cpSync, existsSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

/** Folders at the repo root that deploy as-is under the same name. */
const PAGES = ["bellevia-weight-gain"];

const raw = process.env.SITE_URL || process.argv[2] || "https://nakhwa-store.pages.dev";
let origin;
try {
  origin = new URL(raw).origin;
} catch {
  console.error(`[copy-landing-pages] invalid SITE_URL: "${raw}"`);
  process.exit(1);
}

if (!existsSync(dist)) {
  console.error("[copy-landing-pages] dist/ not found — run the site build first.");
  process.exit(1);
}

for (const name of PAGES) {
  const src = join(root, name);
  if (!existsSync(join(src, "index.html"))) {
    console.error(`[copy-landing-pages] ${name}/index.html not found — skipping.`);
    continue;
  }

  const dest = join(dist, name);
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, {
    recursive: true,
    // Build tooling and notes are not part of what ships.
    filter: (s) => !/[\\/](tools|README\.md|CREDITS\.md)$/.test(s),
  });

  const base = `${origin}/${name}`;

  // Absolute canonical + OG url, so the deployed copy does not advertise a
  // relative canonical. The source keeps `./` and stays openable offline.
  const html = join(dest, "index.html");
  if (existsSync(html)) {
    let out = readFileSync(html, "utf8");
    out = out.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${base}/">`);
    out = out.replace(
      /(<meta property="og:image" content=")([^"]*)(">)/,
      (_m, a, url, c) => a + (/^https?:\/\//.test(url) ? url : `${base}/${url.replace(/^\.?\//, "")}`) + c,
    );
    if (!/property="og:url"/.test(out)) {
      out = out.replace(/(<meta property="og:image"[^>]*>)/, `$1\n<meta property="og:url" content="${base}/">`);
    }
    writeFileSync(html, out);
  }

  // robots.txt / sitemap.xml carry a placeholder domain in source. The root
  // site serves its own robots and sitemap, so a second pair nested under this
  // path would only ever be a stale copy for someone to find and trust —
  // they are dropped rather than stamped.
  for (const f of ["robots.txt", "sitemap.xml"]) rmSync(join(dest, f), { force: true });

  console.log(`[copy-landing-pages] ${name}/ → dist/${name}/  (canonical ${base}/)`);
}

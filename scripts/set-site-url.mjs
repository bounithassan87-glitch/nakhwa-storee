// Stamps the production site URL into the deploy artifacts (dist/), replacing the
// REPLACE-WITH-YOUR-DOMAIN placeholder and making canonical/OpenGraph URLs
// absolute. Configurable — never hardcodes a domain into source:
//
//   SITE_URL=https://your-domain.tld node scripts/set-site-url.mjs
//   node scripts/set-site-url.mjs https://your-domain.tld
//
// Default is the project's real Cloudflare Pages URL (nakhwa-store.pages.dev);
// override with SITE_URL for a custom domain. Idempotent — safe to re-run.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const raw = process.env.SITE_URL || process.argv[2] || "https://nakhwa-store.pages.dev";
let origin;
try {
  origin = new URL(raw).origin; // validate + normalise (drops path/trailing slash)
} catch {
  console.error(`[set-site-url] invalid SITE_URL: "${raw}". Use e.g. https://your-domain.tld`);
  process.exit(1);
}
if (!origin.startsWith("https://")) {
  console.error("[set-site-url] SITE_URL must be https://");
  process.exit(1);
}

const write = (rel, content) => {
  writeFileSync(join(dist, rel), content);
  console.log(`[set-site-url] wrote dist/${rel}`);
};
const patch = (rel, fn) => {
  const p = join(dist, rel);
  if (!existsSync(p)) return;
  const before = readFileSync(p, "utf8");
  const after = fn(before);
  if (after !== before) {
    writeFileSync(p, after);
    console.log(`[set-site-url] updated dist/${rel}`);
  }
};

const today = new Date().toISOString().slice(0, 10);

// robots.txt — regenerated (idempotent). Admin is disallowed from indexing.
write(
  "robots.txt",
  `User-agent: *\nAllow: /\nDisallow: /admin\n\nSitemap: ${origin}/sitemap.xml\n`,
);

// sitemap.xml — regenerated (idempotent).
write(
  "sitemap.xml",
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url>\n    <loc>${origin}/</loc>\n    <lastmod>${today}</lastmod>\n` +
    `    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n` +
    `</urlset>\n`,
);

// index.html — absolute canonical + OpenGraph/Twitter URLs (idempotent regexes).
patch("index.html", (html) => {
  let out = html;
  // canonical → absolute
  out = out.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${origin}/">`);
  // og:image / twitter:image → absolute (handles the current relative asset path)
  out = out.replace(/(<meta property="og:image" content=")([^"]*)(">)/, (_m, a, url, c) => a + toAbs(url) + c);
  out = out.replace(/(<meta name="twitter:image" content=")([^"]*)(">)/, (_m, a, url, c) => a + toAbs(url) + c);
  // ensure og:url exists (insert right after og:image if absent)
  if (!/property="og:url"/.test(out)) {
    out = out.replace(/(<meta property="og:image"[^>]*>)/, `$1 <meta property="og:url" content="${origin}/">`);
  } else {
    out = out.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${origin}/">`);
  }
  return out;

  function toAbs(url) {
    if (/^https?:\/\//.test(url)) return url.replace(/^https?:\/\/[^/]+/, origin);
    return `${origin}/${url.replace(/^\//, "")}`;
  }
});

// README (build note) — drop the literal placeholder if still present.
patch("README.md", (t) => t.replaceAll("https://REPLACE-WITH-YOUR-DOMAIN", origin).replaceAll("REPLACE-WITH-YOUR-DOMAIN", new URL(origin).host));

console.log(`[set-site-url] done → ${origin}`);

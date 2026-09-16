// Fail the build if an unstamped placeholder reached `dist/`.
//
// This exists because one did. `bellevia-genouillere/index.html` writes
// `__ORIGIN__` into its JSON-LD for a build step to replace, that step was not
// part of the committed build, and the page went live advertising
// `__ORIGIN__/bellevia-genouillere/` to Google. Nothing failed: the page looked
// perfect, every asset returned 200, and only the structured data was wrong.
//
// A placeholder that survives into `dist/` is always a bug — either the
// stamping step is missing or the page was written against one that does not
// exist. Either way it must not be deployable.
//
// Deliberately separate from `copy-landing-pages.mjs`: this is a gate over
// whatever that script produced, not another thing for it to do, and it stays
// useful if the copying is ever rewritten.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

/** Placeholders a build is supposed to replace. Extend as new ones appear. */
const PLACEHOLDERS = ["__ORIGIN__", "__SITE_URL__", "__CANONICAL__"];

/** Text formats worth scanning. A placeholder inside a .webp is not a thing. */
const TEXT = new Set([".html", ".json", ".webmanifest", ".xml", ".txt", ".js", ".css"]);

// `dist/admin` is a bundler's output: hashed chunk names and minified source
// where a bare match would be noise, and nothing there is built from a template
// this project stamps.
const SKIP_DIRS = new Set(["admin"]);

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (dir === dist && SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), acc);
    } else if (TEXT.has(path.extname(entry.name).toLowerCase())) {
      acc.push(path.join(dir, entry.name));
    }
  }
  return acc;
}

let scanned = 0;
const hits = [];

try {
  statSync(dist);
} catch {
  console.error("[check-dist-placeholders] dist/ does not exist — run the build first");
  process.exit(1);
}

for (const file of walk(dist)) {
  scanned++;
  const text = readFileSync(file, "utf8");
  for (const token of PLACEHOLDERS) {
    const n = (text.split(token).length - 1);
    if (n > 0) hits.push({ file: path.relative(root, file).replace(/\\/g, "/"), token, n });
  }
}

if (hits.length) {
  console.error(`[check-dist-placeholders] ${hits.length} unstamped placeholder(s) in dist/:\n`);
  for (const h of hits) console.error(`  ${h.file}  ${h.token} ×${h.n}`);
  console.error("\nA placeholder in dist/ ships to production. Either the stamping step is");
  console.error("missing from the build, or the source should carry the real value.");
  process.exit(1);
}

console.log(`[check-dist-placeholders] ${scanned} files scanned, no placeholders`);

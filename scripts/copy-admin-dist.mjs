// Copies the built admin SPA (admin/dist) into the Pages output at dist/admin so
// it deploys same-origin as the API under /admin. Run after `vite build` in admin.
import { cpSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "admin", "dist");
const dest = join(root, "dist", "admin");

if (!existsSync(join(src, "index.html"))) {
  console.error("[copy-admin-dist] admin/dist/index.html not found — build the admin first (npm --prefix admin run build).");
  process.exit(1);
}

rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-admin-dist] copied admin/dist → dist/admin");

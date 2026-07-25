#!/usr/bin/env node
/**
 * Zero-install local PostgreSQL for development — runs a self-contained
 * embedded Postgres process (no Docker, no system service, no admin rights).
 * Data persists under ./.data/postgres (gitignored).
 *
 * Usage: npm run db:local   (leave running in its own terminal)
 */
import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { access } from "node:fs/promises";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", ".data", "postgres");

const PORT = 5434;
const USER = "postgres";
const PASSWORD = "postgres";
const DB_NAME = "nakhwa";

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
  // Force UTF-8 so Arabic content stores correctly regardless of host locale.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function pathExists(p) {
  try { await access(p); return true; } catch { return false; }
}

async function main() {
  const isFirstRun = !(await pathExists(dataDir));
  if (isFirstRun) {
    console.log("[local-postgres] initialising data directory…");
    await pg.initialise();
  }
  console.log(`[local-postgres] starting on 127.0.0.1:${PORT}…`);
  await pg.start();
  if (isFirstRun) {
    console.log(`[local-postgres] creating database "${DB_NAME}"…`);
    await pg.createDatabase(DB_NAME);
  }
  console.log(
    `[local-postgres] ready → postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB_NAME}?schema=public`,
  );
  console.log("[local-postgres] READY_SIGNAL");

  const shutdown = async () => {
    console.log("\n[local-postgres] stopping…");
    try { await pg.stop(); } catch {}
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => { console.error("[local-postgres] failed:", e); process.exit(1); });

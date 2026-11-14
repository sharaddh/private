import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const serverDir = path.join(root, "server");
const schema = path.join(serverDir, "prisma", "schema.prisma");
const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");

const env = { ...process.env };
env.PRISMA_HIDE_UPDATE_MESSAGE = "1";

// Prisma migrations take an advisory lock. Neon's PgBouncer pooler runs in
// transaction mode, which can make that lock unreliable (P1002). Apply
// migrations over the direct endpoint when one is configured.
const directUrl = env.DATABASE_URL_UNPOOLED || env.DIRECT_URL;
if (directUrl) {
  env.DATABASE_URL = directUrl;
  console.log("[migrate] using direct/unpooled database URL");
} else {
  console.log("[migrate] using DATABASE_URL");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let status = 1;
for (let attempt = 1; attempt <= 3; attempt += 1) {
  const result = spawnSync(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", schema],
    { cwd: serverDir, env, stdio: "inherit" }
  );
  status = result.status ?? 1;
  if (status === 0) process.exit(0);
  if (attempt < 3) {
    const delay = 5000 * attempt;
    console.error(`[migrate] attempt ${attempt} failed; retrying in ${delay}ms`);
    await sleep(delay);
  }
}

process.exit(status);

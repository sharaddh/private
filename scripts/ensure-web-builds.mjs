#!/usr/bin/env node
/**
 * Ensures the client and warehouse frontends have a production build.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const targets = [
  { name: "client", dir: path.join(root, "client"), marker: path.join(root, "client", "dist", "index.html") },
  {
    name: "warehouse",
    dir: path.join(root, "warehouse"),
    marker: path.join(root, "warehouse", "dist", "index.html"),
  },
];

const missing = targets.filter((t) => !fs.existsSync(t.marker));

if (missing.length === 0) {
  console.log("[ensure-web-builds] client and warehouse dist present - nothing to do");
  process.exit(0);
}

for (const target of missing) {
  console.log(`[ensure-web-builds] building ${target.name} (dist missing)`);
  // Try to use workspace build if possible
  const result = spawnSync("npm", ["run", "build"], {
    cwd: target.dir,
    stdio: "inherit",
    shell: false,
    env: { ...process.env, NODE_ENV: "production", PATH: process.env.PATH },
  });

  if (result.status !== 0 || !fs.existsSync(target.marker)) {
    console.error(
      `[ensure-web-builds] ${target.name} build failed. The ${target.name} app will not be served.`
    );
    process.exit(result.status === 0 ? 1 : result.status);
  }
}

console.log("[ensure-web-builds] all frontend dists present");

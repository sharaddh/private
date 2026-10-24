#!/usr/bin/env node
/**
 * Deployment smoke test.
 *
 * Usage:
 *   node scripts/verify-deploy.mjs [--api <url>] [--user <username> --pass <password>] [--branch <branchId>]
 *
 * With credentials it also exercises the authenticated endpoints, measures
 * latency and verifies the Redis cache (x-cache: MISS -> HIT) on a cached
 * route. Without credentials it only checks the public surface.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const args = process.argv.slice(2);
const getArg = (name) => {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : undefined;
};

const API = (getArg("--api") || process.env.DEPLOY_API_URL || "https://kmj-server.onrender.com").replace(
  /\/+$/,
  ""
);
const USER = getArg("--user") || process.env.DEPLOY_USER || "";
const PASS = getArg("--pass") || process.env.DEPLOY_PASS || "";
const BRANCH = getArg("--branch") || process.env.DEPLOY_BRANCH_ID || "";

let failures = 0;
const log = (msg) => console.log(msg);
const ok = (msg) => console.log(`  PASS  ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`  FAIL  ${msg}`);
};

async function timed(url, options = {}) {
  const started = Date.now();
  const res = await fetch(url, { redirect: "manual", ...options });
  const ms = Date.now() - started;
  let body = "";
  try {
    body = await res.text();
  } catch {
    body = "";
  }
  return { res, ms, body };
}

function jsonOf(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

log(`\n== Local build outputs ==`);
for (const [label, rel] of [
  ["client", "client/dist/index.html"],
  ["warehouse", "warehouse/dist/index.html"],
  ["server", "server/dist/index.js"],
]) {
  const file = path.join(root, rel);
  if (fs.existsSync(file)) ok(`${label} build present (${rel})`);
  else bad(`${label} build MISSING (${rel})`);
}

log(`\n== Public endpoints (${API}) ==`);

const health = await timed(`${API}/api/health`);
if (health.res.status === 200) ok(`/api/health -> 200 (${health.ms}ms)`);
else bad(`/api/health -> ${health.res.status}`);

const ready = await timed(`${API}/api/ready`);
const readyBody = jsonOf(ready.body);
if (ready.res.status === 200) {
  const db = readyBody?.data?.db ?? readyBody?.db ?? "?";
  const redis = readyBody?.data?.redis ?? readyBody?.redis ?? "?";
  ok(`/api/ready -> 200 (${ready.ms}ms) db=${db} redis=${redis}`);
} else {
  bad(`/api/ready -> ${ready.res.status}`);
}

const rootRes = await timed(`${API}/`);
if (rootRes.res.status === 200 && /<div id="root"|<!doctype html/i.test(rootRes.body)) {
  ok(`/ -> 200 SPA html`);
} else if ([301, 302, 307, 308].includes(rootRes.res.status)) {
  ok(`/ -> ${rootRes.res.status} redirect to ${rootRes.res.headers.get("location")}`);
} else {
  bad(`/ -> ${rootRes.res.status} (no SPA html, no redirect)`);
}

const whRes = await timed(`${API}/warehouse`);
if (whRes.res.status === 200 && /<div id="root"|<!doctype html/i.test(whRes.body)) {
  ok(`/warehouse -> 200 SPA html`);
} else if ([301, 302, 307, 308].includes(whRes.res.status)) {
  ok(`/warehouse -> ${whRes.res.status} redirect to ${whRes.res.headers.get("location")}`);
} else {
  bad(`/warehouse -> ${whRes.res.status} (no SPA html, no redirect)`);
}

const unauth = await timed(`${API}/api/customers`);
if (unauth.res.status === 401) ok(`/api/customers without token -> 401 (auth enforced)`);
else bad(`/api/customers without token -> ${unauth.res.status} (expected 401)`);

if (!USER || !PASS) {
  log(`\nSkipping authenticated checks (pass --user/--pass or set DEPLOY_USER/DEPLOY_PASS).`);
  log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

log(`\n== Authenticated endpoints ==`);
const login = await timed(`${API}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ username: USER, password: PASS }),
});
const loginBody = jsonOf(login.body);
const token = loginBody?.data?.access;
if (login.res.status === 200 && token) {
  ok(`login ok (${login.ms}ms) role=${loginBody?.data?.user?.role ?? "?"}`);
} else {
  bad(`login failed -> ${login.res.status} ${(login.body || "").slice(0, 160)}`);
  log(`\n${failures} CHECK(S) FAILED\n`);
  process.exit(1);
}

const authHeaders = { authorization: `Bearer ${token}` };
if (BRANCH) authHeaders["x-branch-id"] = BRANCH;

const endpoints = [
  ["GET", "/api/auth/me"],
  ["GET", "/api/branches/active"],
  ["GET", "/api/dashboard/stats"],
  ["GET", "/api/customers?page=1&limit=5"],
  ["GET", "/api/orders?page=1&limit=5"],
  ["GET", "/api/orders/status-counts"],
  ["GET", "/api/inventory/stats"],
  ["GET", "/api/inventory?page=1&limit=5"],
  ["GET", "/api/reports/revenue"],
  ["GET", "/api/reports/monthly"],
  ["GET", "/api/reports/customers"],
  ["GET", "/api/reports/inventory"],
  ["GET", "/api/reports/deliveries"],
];

for (const [method, route] of endpoints) {
  const r = await timed(`${API}${route}`, { method, headers: authHeaders });
  const cache = r.res.headers.get("x-cache") || "-";
  const level = r.res.status >= 500 ? bad : r.res.status >= 400 ? bad : ok;
  level(`${method} ${route} -> ${r.res.status} (${r.ms}ms) x-cache=${cache}`);
}

// Redis cache verification: first call populates, second call should hit.
log(`\n== Redis cache verification ==`);
const cachedRoute = "/api/dashboard/stats";
const first = await timed(`${API}${cachedRoute}`, { headers: authHeaders });
const second = await timed(`${API}${cachedRoute}`, { headers: authHeaders });
const firstCache = first.res.headers.get("x-cache");
const secondCache = second.res.headers.get("x-cache");
log(`  ${cachedRoute}: first x-cache=${firstCache ?? "-"} (${first.ms}ms), second x-cache=${secondCache ?? "-"} (${second.ms}ms)`);
if (secondCache === "HIT") ok("cache returns HIT on repeat request");
else if (firstCache || secondCache) bad(`cache did not return HIT (first=${firstCache}, second=${secondCache})`);
else bad("no x-cache header - route is not cached");

log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);

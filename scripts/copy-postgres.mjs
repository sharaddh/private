import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const hasFlag = (flag) => args.includes(flag);
const confirmed = hasFlag("--yes") || process.env.DB_COPY_CONFIRM === "1";
const schemaOnly = hasFlag("--schema-only");
const dataOnly = hasFlag("--data-only");
const noClean = hasFlag("--no-clean");
const useDocker = hasFlag("--docker") || process.env.DB_COPY_DOCKER === "1";
const dockerImage = process.env.DB_COPY_IMAGE || "postgres:17";

const source = process.env.SOURCE_DATABASE_URL;
const target = process.env.TARGET_DATABASE_URL || process.env.DATABASE_URL;

const usage = `
Usage:
  SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... npm run db:copy -- --yes
  SOURCE_DATABASE_URL=... TARGET_DATABASE_URL=... npm run db:copy:docker -- --yes

Options:
  --yes          Confirm copying into the target database
  --docker       Run pg_dump/pg_restore through the postgres:17 Docker image
  --schema-only  Copy schema only
  --data-only    Copy data only
  --no-clean     Do not drop existing objects in the target
`.trim();

function fail(message) {
  console.error(`[db:copy] ${message}\n\n${usage}`);
  process.exit(1);
}

function validateUrl(name, value) {
  if (!value) fail(`${name} is not set`);
  try {
    const url = new URL(value);
    if (!/^postgres(ql)?:$/.test(url.protocol))
      fail(`${name} must be a postgres:// URL`);
    if (/pooler/i.test(url.hostname)) {
      fail(`${name} must be a direct Postgres URL, not a pooler URL`);
    }
  } catch {
    fail(`${name} is not a valid URL`);
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, { stdio: "inherit" });
  if (result.error) {
    throw new Error(
      `${command} is not installed; install the PostgreSQL client tools (pg_dump/pg_restore)`,
    );
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!confirmed)
  fail("missing confirmation; pass --yes or set DB_COPY_CONFIRM=1");
if (schemaOnly && dataOnly)
  fail("--schema-only and --data-only cannot be used together");

validateUrl("SOURCE_DATABASE_URL", source);
validateUrl("TARGET_DATABASE_URL", target);

if (source === target) fail("source and target database URLs are identical");

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "kmj-db-copy-"));
const dumpFile = path.join(tempDir, "database.dump");

function runPg(tool, args) {
  if (!useDocker) {
    run(tool, args);
    return;
  }

  const mount = tempDir.replace(/\\/g, "/");
  run("docker", [
    "run",
    "--rm",
    "-v",
    `${mount}:/work`,
    "-w",
    "/work",
    dockerImage,
    tool,
    ...args,
  ]);
}

try {
  const toolDumpFile = useDocker ? "/work/database.dump" : dumpFile;

  const dumpArgs = [
    "--format=custom",
    "--no-owner",
    "--no-privileges",
    `--file=${toolDumpFile}`,
  ];
  if (schemaOnly) dumpArgs.push("--schema-only");
  if (dataOnly) dumpArgs.push("--data-only");
  dumpArgs.push(source);

  console.log(
    `[db:copy] dumping source database${useDocker ? " (docker)" : ""}`,
  );
  runPg("pg_dump", dumpArgs);

  const restoreArgs = ["--no-owner", "--no-privileges", "--exit-on-error"];
  if (!noClean && !dataOnly) restoreArgs.push("--clean", "--if-exists");
  if (schemaOnly) restoreArgs.push("--schema-only");
  if (dataOnly) restoreArgs.push("--data-only");
  restoreArgs.push(`--dbname=${target}`, toolDumpFile);

  console.log(
    `[db:copy] restoring target database${useDocker ? " (docker)" : ""}`,
  );
  runPg("pg_restore", restoreArgs);

  console.log("[db:copy] done");
} catch (error) {
  console.error(
    `[db:copy] ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true });
}

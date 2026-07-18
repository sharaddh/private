#!/usr/bin/env node
/**
 * Camera Relay Manager
 * 
 * Manages dh-p2p processes for each camera and updates MediaMTX config.
 * 
 * Usage:
 *   node relay-manager.js add <cameraId> <serialNumber> <username> <password>
 *   node relay-manager.js remove <cameraId>
 *   node relay-manager.js list
 *   node relay-manager.js health
 */

const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");

const STATE_DIR = path.join(__dirname, ".state");
const MEDIAMTX_CONFIG = path.join(__dirname, "mediamtx.yml");
const PROCESSES_FILE = path.join(STATE_DIR, "processes.json");

// Ensure state directory exists
if (!fs.existsSync(STATE_DIR)) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function loadState() {
  try {
    if (fs.existsSync(PROCESSES_FILE)) {
      return JSON.parse(fs.readFileSync(PROCESSES_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveState(state) {
  fs.writeFileSync(PROCESSES_FILE, JSON.stringify(state, null, 2));
}

function updateMediamtxConfig(cameras) {
  const baseConfig = fs.readFileSync(path.join(__dirname, "mediamtx.base.yml"), "utf-8");

  const paths = {};
  for (const [id, cam] of Object.entries(cameras)) {
    const localPort = 8554 + Object.keys(cameras).indexOf(id);
    paths[`camera_${id}`] = {
      source: `rtsp://127.0.0.1:${localPort}/`,
      sourceProtocol: "tcp",
      sourceOnDemand: true,
    };
  }

  let config = baseConfig;
  // Replace paths section
  const pathsYaml = Object.entries(paths)
    .map(([key, val]) => `  ${key}:\n    source: ${val.source}\n    sourceProtocol: ${val.sourceProtocol}\n    sourceOnDemand: ${val.sourceOnDemand}`)
    .join("\n");

  config = config.replace("paths: {}", `paths:\n${pathsYaml}`);

  fs.writeFileSync(MEDIAMTX_CONFIG, config);
  console.log("[relay-manager] Updated mediamtx.yml");
}

function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:9997/v3/paths/list", (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ ok: true, paths: JSON.parse(data) });
        } catch {
          resolve({ ok: true, paths: [] });
        }
      });
    });
    req.on("error", () => resolve({ ok: false }));
    req.setTimeout(3000, () => { req.destroy(); resolve({ ok: false }); });
  });
}

async function main() {
  const [,, action, ...args] = process.argv;

  switch (action) {
    case "add": {
      const [cameraId, serialNumber, username, password] = args;
      if (!cameraId || !serialNumber) {
        console.error("Usage: relay-manager.js add <cameraId> <serialNumber> <username> <password>");
        process.exit(1);
      }

      const state = loadState();

      // Kill existing process for this camera
      if (state[cameraId]?.pid) {
        try { process.kill(state[cameraId].pid, "SIGTERM"); } catch {}
      }

      // Start dh-p2p
      const localPort = 8554 + Object.keys(state).length;
      const dhP2p = spawn("dh-p2p", [
        serialNumber,
        "-p", `127.0.0.1:${localPort}:554`,
      ], {
        stdio: ["ignore", "pipe", "pipe"],
        detached: false,
      });

      dhP2p.stdout.on("data", (data) => {
        console.log(`[dh-p2p:${cameraId}] ${data.toString().trim()}`);
      });
      dhP2p.stderr.on("data", (data) => {
        console.error(`[dh-p2p:${cameraId}] ERR: ${data.toString().trim()}`);
      });

      state[cameraId] = {
        serialNumber,
        username: username || "admin",
        password: password || "",
        pid: dhP2p.pid,
        localPort,
        startedAt: new Date().toISOString(),
      };

      dhP2p.on("exit", (code) => {
        console.log(`[dh-p2p:${cameraId}] Exited with code ${code}`);
        const s = loadState();
        if (s[cameraId]) {
          s[cameraId].status = code === 0 ? "stopped" : "error";
          s[cameraId].pid = null;
          saveState(s);
        }
      });

      saveState(state);
      updateMediamtxConfig(state);

      console.log(JSON.stringify({ success: true, cameraId, localPort, pid: dhP2p.pid }));
      break;
    }

    case "remove": {
      const [cameraId] = args;
      if (!cameraId) {
        console.error("Usage: relay-manager.js remove <cameraId>");
        process.exit(1);
      }

      const state = loadState();
      if (state[cameraId]?.pid) {
        try { process.kill(state[cameraId].pid, "SIGTERM"); } catch {}
      }
      delete state[cameraId];
      saveState(state);
      updateMediamtxConfig(state);

      console.log(JSON.stringify({ success: true, cameraId }));
      break;
    }

    case "list": {
      const state = loadState();
      console.log(JSON.stringify(state, null, 2));
      break;
    }

    case "health": {
      const result = await healthCheck();
      console.log(JSON.stringify(result));
      break;
    }

    default:
      console.error("Actions: add, remove, list, health");
      process.exit(1);
  }
}

main().catch(console.error);

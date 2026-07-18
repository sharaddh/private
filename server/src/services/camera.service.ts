import { spawn, type ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { Camera } from "../models/camera";

const RELAY_DIR = path.resolve(__dirname, "../../../relay-server");
const STATE_DIR = path.join(RELAY_DIR, ".state");
const PROCESSES_FILE = path.join(STATE_DIR, "processes.json");

const runningProcesses = new Map<string, ChildProcess>();

function loadRelayState(): Record<string, any> {
  try {
    if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
    if (fs.existsSync(PROCESSES_FILE)) {
      return JSON.parse(fs.readFileSync(PROCESSES_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveRelayState(state: Record<string, any>) {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(PROCESSES_FILE, JSON.stringify(state, null, 2));
}

function updateMediamtxConfig(cameras: Record<string, any>) {
  const baseConfigPath = path.join(RELAY_DIR, "mediamtx.base.yml");
  const configPath = path.join(RELAY_DIR, "mediamtx.yml");

  if (!fs.existsSync(baseConfigPath)) return;

  const baseConfig = fs.readFileSync(baseConfigPath, "utf-8");
  const ids = Object.keys(cameras);

  const pathsYaml = ids
    .map((id, i) => {
      const port = 8554 + i;
      return [
        `  camera_${id}:`,
        `    source: rtsp://127.0.0.1:${port}/`,
        "    sourceProtocol: tcp",
        "    sourceOnDemand: true",
      ].join("\n");
    })
    .join("\n");

  const config = baseConfig.replace("paths: {}", `paths:\n${pathsYaml || "  {}"}`);
  fs.writeFileSync(configPath, config);
}

export async function listCameras() {
  return Camera.find().sort({ createdAt: -1 }).lean();
}

export async function getCamera(id: string) {
  return Camera.findById(id).lean();
}

export async function addCamera(data: {
  name: string;
  serialNumber: string;
  username?: string;
  password?: string;
}) {
  const existing = await Camera.findOne({ serialNumber: data.serialNumber });
  if (existing) throw new Error("Camera with this serial number already exists");

  const camera = await Camera.create({
    name: data.name,
    serialNumber: data.serialNumber,
    username: data.username || "admin",
    password: data.password || "",
    status: "connecting",
  });

  await startRelay(String(camera._id), camera.serialNumber, camera.username, camera.password);

  return camera;
}

export async function updateCamera(id: string, data: {
  name?: string;
  username?: string;
  password?: string;
}) {
  const camera = await Camera.findById(id);
  if (!camera) throw new Error("Camera not found");

  if (data.name) camera.name = data.name;
  if (data.username) camera.username = data.username;
  if (data.password !== undefined) camera.password = data.password;
  await camera.save();

  return camera;
}

export async function removeCamera(id: string) {
  await stopRelay(id);
  await Camera.findByIdAndDelete(id);
}

export async function getCameraStatus(id: string) {
  const camera = await Camera.findById(id).lean();
  if (!camera) throw new Error("Camera not found");

  const state = loadRelayState();
  const relayInfo = state[id];

  return {
    ...camera,
    relayActive: !!relayInfo?.pid,
    localPort: relayInfo?.localPort,
  };
}

async function startRelay(cameraId: string, serialNumber: string, username: string, password: string) {
  try {
    const state = loadRelayState();
    const existingIndex = Object.keys(state).length;
    const localPort = 8554 + existingIndex;

    const dhP2pPath = path.join(RELAY_DIR, "dh-p2p");

    let proc: ChildProcess;
    if (fs.existsSync(dhP2pPath) || fs.existsSync(dhP2pPath + ".exe")) {
      proc = spawn(dhP2pPath, [
        serialNumber,
        "-p", `127.0.0.1:${localPort}:554`,
      ], {
        stdio: ["ignore", "pipe", "pipe"],
      });
    } else {
      console.log(`[camera-relay] dh-p2p not found at ${dhP2pPath}, skipping relay start`);
      await Camera.findByIdAndUpdate(cameraId, { status: "offline", lastError: "dh-p2p binary not found" });
      return;
    }

    proc.stdout?.on("data", (data) => {
      console.log(`[dh-p2p:${cameraId}] ${data.toString().trim()}`);
    });
    proc.stderr?.on("data", (data) => {
      console.error(`[dh-p2p:${cameraId}] ERR: ${data.toString().trim()}`);
    });

    proc.on("exit", async (code) => {
      console.log(`[dh-p2p:${cameraId}] Exited with code ${code}`);
      runningProcesses.delete(cameraId);
      await Camera.findByIdAndUpdate(cameraId, {
        status: code === 0 ? "offline" : "error",
        lastError: code === 0 ? "" : `Process exited with code ${code}`,
      }).catch(() => {});
    });

    runningProcesses.set(cameraId, proc);

    state[cameraId] = {
      serialNumber,
      username,
      password,
      pid: proc.pid,
      localPort,
      startedAt: new Date().toISOString(),
    };

    saveRelayState(state);
    updateMediamtxConfig(state);

    await Camera.findByIdAndUpdate(cameraId, { status: "connecting" });

    console.log(`[camera-relay] Started relay for camera ${cameraId} (SN: ${serialNumber}, port: ${localPort})`);
  } catch (error: any) {
    console.error(`[camera-relay] Failed to start relay for ${cameraId}:`, error.message);
    await Camera.findByIdAndUpdate(cameraId, {
      status: "error",
      lastError: error.message,
    }).catch(() => {});
  }
}

async function stopRelay(cameraId: string) {
  const proc = runningProcesses.get(cameraId);
  if (proc) {
    proc.kill("SIGTERM");
    runningProcesses.delete(cameraId);
  }

  const state = loadRelayState();
  if (state[cameraId]) {
    delete state[cameraId];
    saveRelayState(state);
    updateMediamtxConfig(state);
  }
}

export async function restartAllRelays() {
  const cameras = await Camera.find().lean();
  for (const cam of cameras) {
    await startRelay(String(cam._id), cam.serialNumber, cam.username, cam.password);
  }
}

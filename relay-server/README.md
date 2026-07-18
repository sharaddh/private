# Camera Relay Server Setup Guide

This guide explains how to set up the P2P camera relay server for your Dahua cameras.

## How It Works

```
ERP Frontend → API → Backend → dh-p2p → Dahua Cloud → Camera (at shop)
                                      ↓
                                  MediaMTX → HLS Stream → Frontend
```

1. User adds camera in ERP with **SN + username + password**
2. Backend starts `dh-p2p` process with the serial number
3. `dh-p2p` connects to Dahua's cloud (Easy4IPCloud) and finds the camera
4. `dh-p2p` exposes a local RTSP endpoint
5. `MediaMTX` converts RTSP to HLS
6. Frontend plays HLS stream

**No port forwarding or IP address needed at the shop!**

---

## Prerequisites

- Docker and Docker Compose installed on your server
- Internet access (for dh-p2p to reach Dahua's cloud)
- The `dh-p2p` binary (download from https://github.com/khoanguyen-3fc/dh-p2p)

---

## Step 1: Build/Download dh-p2p

### Option A: Build from Source (Rust required)

```bash
git clone https://github.com/khoanguyen-3fc/dh-p2p.git
cd dh-p2p
cargo build --release
cp target/release/dh-p2p /path/to/relay-server/
```

### Option B: Download Pre-built Binary

Download the latest release from https://github.com/khoanguyen-3fc/dh-p2p/releases

Place the binary in the `relay-server/` directory.

---

## Step 2: Start the Relay Server

```bash
cd relay-server/
docker compose up -d
```

This starts:
- **MediaMTX** on port 8888 (HLS) and 8554 (RTSP)

The `dh-p2p` processes are started automatically by the backend when cameras are added.

---

## Step 3: Configure Environment Variables

Add these to your server's `.env` file:

```bash
# HLS URL for the frontend to fetch streams from
VITE_HLS_URL=http://YOUR_SERVER_IP:8888

# (Optional) Custom relay server path
RELAY_SERVER_PATH=/path/to/relay-server
```

---

## Step 4: Add Cameras in ERP

1. Go to the **Cameras** page in ERP
2. Click **Add Camera**
3. Fill in:
   - **Camera Name**: e.g., "Front Door"
   - **Serial Number**: The SN from your camera (found on label or Easyviewer app)
   - **Username**: `admin` (or your camera's username)
   - **Password**: Your camera's password
4. Click **Add Camera**

The backend will:
1. Start a `dh-p2p` process for this camera
2. Connect to Dahua's cloud via P2P
3. The camera status will change from "Connecting..." to "Live"

---

## Finding Your Camera's Serial Number

The serial number (SN) can be found:

1. **On the camera label** — printed on the bottom/back of the camera
2. **In the Easyviewer/DMSS app** — camera settings > Device Info
3. **On the camera web interface** — Settings > System Info (if accessible locally)

---

## Troubleshooting

### Camera shows "Connecting..." forever

- Check if `dh-p2p` binary exists in the relay-server directory
- Check server logs: `docker logs mediamtx`
- Verify the serial number is correct
- Make sure the camera is powered on and connected to the internet

### Camera shows "Error"

- Check if the username/password are correct
- The camera might not support P2P (check if P2P is enabled in camera settings)
- Try restarting the relay: remove and re-add the camera

### HLS stream not loading in browser

- Verify MediaMTX is running: `docker ps`
- Check if port 8888 is accessible: `curl http://YOUR_SERVER:8888`
- Check MediaMTX logs: `docker logs mediamtx`

### Multiple cameras

Each camera gets its own `dh-p2p` process. The system handles this automatically. MediaMTX is configured with paths like `/camera_{id}` for each camera.

---

## Architecture Details

### Components

| Component | Purpose | Port |
|-----------|---------|------|
| `dh-p2p` | Connects to camera via Dahua P2P cloud | N/A (internal) |
| `MediaMTX` | Converts RTSP to HLS | 8888 (HLS), 8554 (RTSP) |
| ERP Backend | Manages camera configs and relay processes | 4000 |
| ERP Frontend | Displays camera feeds | 5173 |

### Data Flow

1. Frontend → `POST /api/cameras` with SN + credentials
2. Backend → Starts `dh-p2p` process with the SN
3. `dh-p2p` → Connects to Dahua cloud → Camera
4. `dh-p2p` → Exposes RTSP on localhost:PORT
5. MediaMTX → Reads RTSP → Serves HLS on :8888
6. Frontend → Fetches HLS from :8888 → Plays video

### Security

- Camera credentials are stored encrypted in MongoDB
- `dh-p2p` processes run with minimal privileges
- MediaMTX only serves HLS (no direct camera access from internet)
- All API endpoints require authentication (JWT)

---

## Quick Start Summary

1. Install Docker on your server
2. Download/build `dh-p2p` binary to `relay-server/`
3. Run `docker compose up -d` in `relay-server/`
4. Add cameras in ERP with SN + username + password
5. View live feeds from anywhere!

For questions or issues, check the dh-p2p GitHub repository or contact support.

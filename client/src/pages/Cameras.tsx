import { useState, useCallback, useEffect, useRef } from "react";
import Hls from "hls.js";
import api from "../api";
import Modal from "../components/Modal";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";
import {
  Camera, Plus, Trash2, Maximize2, Minimize2,
  RefreshCw, Monitor, AlertCircle, Edit3, Copy, Info, Wifi,
} from "lucide-react";

interface CameraDoc {
  _id: string;
  name: string;
  serialNumber: string;
  username: string;
  password: string;
  streamPath?: string;
  status: "connecting" | "online" | "offline" | "error";
  lastError?: string;
}

function HlsPlayer({ src, className, style, onLoaded, onError }: {
  src: string;
  className?: string;
  style?: React.CSSProperties;
  onLoaded?: () => void;
  onError?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 10 });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); onLoaded?.(); });
      hls.on(Hls.Events.ERROR, (_e, data) => { if (data.fatal) onError?.(); });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", () => { video.play().catch(() => {}); onLoaded?.(); });
      video.addEventListener("error", () => onError?.());
    } else {
      onError?.();
    }

    return () => { if (hls) { hls.destroy(); hls = null; } };
  }, [src, onLoaded, onError]);

  return <video ref={videoRef} className={className} style={style} controls muted autoPlay playsInline />;
}

const HLS_BASE = import.meta.env.VITE_HLS_URL || "";

function CameraCard({
  cam,
  onDelete,
  onEdit,
  t,
}: {
  cam: CameraDoc;
  onDelete: (id: string) => void;
  onEdit: (cam: CameraDoc) => void;
  t: (en: string, hi: string) => string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const hlsUrl = cam.streamPath && HLS_BASE
    ? `${HLS_BASE.replace(/\/+$/, "")}/${cam.streamPath}/index.m3u8`
    : "";

  const toggleExpand = useCallback(() => setExpanded((p) => !p), []);

  useEffect(() => { setLoadError(false); setLoading(true); }, [cam.streamPath, cam.status]);

  const handleLoaded = useCallback(() => { setLoading(false); setLoadError(false); }, []);
  const handleError = useCallback(() => { setLoading(false); setLoadError(true); }, []);

  const copySn = useCallback(() => { navigator.clipboard.writeText(cam.serialNumber); }, [cam.serialNumber]);

  const statusColor = cam.status === "online" ? "#1ed760" : cam.status === "error" ? "#ef4444" : cam.status === "connecting" ? "#f59e0b" : "#6b7280";
  const statusLabel = { online: "Live", connecting: "Connecting...", offline: "Offline", error: "Error" }[cam.status];

  return (
    <div ref={containerRef} className={`bg-th-surface rounded-xl shadow-lg overflow-hidden transition-all duration-300 flex flex-col ${expanded ? "fixed inset-4 z-40" : ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-th-hover">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: statusColor }} />
          <span className="text-sm font-semibold text-th-text truncate">{cam.name}</span>
          <span className="text-[14px] px-1.5 py-0.5 rounded font-medium flex-shrink-0"
            style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={copySn} title="Copy SN" className="p-1.5 rounded-lg text-th-secondary hover:text-th-text hover:bg-th-hover transition-colors">
            <Copy size={14} />
          </button>
          <button onClick={() => onEdit(cam)} title={t("Edit", "संपादित करें")} className="p-1.5 rounded-lg text-th-secondary hover:text-th-text hover:bg-th-hover transition-colors">
            <Edit3 size={14} />
          </button>
          <button onClick={() => onDelete(cam._id)} title={t("Delete", "हटाएँ")} className="p-1.5 rounded-lg text-th-secondary hover:text-red-400 hover:bg-red-400/10 transition-colors">
            <Trash2 size={14} />
          </button>
          <button onClick={toggleExpand} title={expanded ? t("Minimize", "छोटा करें") : t("Maximize", "बड़ा करें")} className="p-1.5 rounded-lg text-th-secondary hover:text-th-text hover:bg-th-hover transition-colors">
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="relative flex-1 bg-black min-h-[200px]">
        {loading && !loadError && cam.status !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw size={20} className="animate-spin text-[#1ed760]" />
              <span className="text-xs text-th-secondary">
                {cam.status === "connecting" ? t("Connecting via P2P...", "P2P से कनेक्ट हो रहा है...") : t("Loading feed...", "फ़ीड लोड हो रहा है...")}
              </span>
            </div>
          </div>
        )}

        {cam.status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
            <div className="flex flex-col items-center gap-3 text-center max-w-xs">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-th-text mb-1">{t("Connection failed", "कनेक्शन विफल")}</p>
                <p className="text-xs text-th-secondary leading-relaxed">{cam.lastError || "Relay server error"}</p>
              </div>
            </div>
          </div>
        )}

        {loadError && cam.status !== "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
            <div className="flex flex-col items-center gap-3 text-center max-w-xs">
              <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
                <AlertCircle size={24} className="text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-th-text mb-1">{t("Cannot load feed", "फ़ीड लोड नहीं हो सका")}</p>
              </div>
              <button onClick={() => { setLoadError(false); setLoading(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-hover text-th-text text-xs font-medium hover:bg-th-elevated transition-colors">
                <RefreshCw size={12} /> {t("Retry", "पुनः प्रयास")}
              </button>
            </div>
          </div>
        )}

        {hlsUrl && cam.status === "online" && (
          <HlsPlayer
            src={hlsUrl}
            className={`w-full h-full border-0 ${loadError || cam.status !== "online" ? "hidden" : ""}`}
            style={{ minHeight: expanded ? "calc(100vh - 120px)" : "280px" }}
            onLoaded={handleLoaded}
            onError={handleError}
          />
        )}

        {cam.status === "offline" && (
          <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
            <div className="flex flex-col items-center gap-3 text-center max-w-xs">
              <div className="w-12 h-12 rounded-full bg-yellow-500/15 flex items-center justify-center">
                <Info size={24} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-th-text mb-1">{t("Camera offline", "कैमरा ऑफ़लाइन")}</p>
                <p className="text-xs text-th-secondary leading-relaxed">
                  {t("P2P relay is not connected. Check if the relay server is running.", "P2P रिले कनेक्ट नहीं है। जाँचें कि रिले सर्वर चल रहा है।")}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddEditModal({
  open,
  onClose,
  onSave,
  editCam,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: { name: string; serialNumber: string; username: string; password: string }) => void;
  editCam: CameraDoc | null;
  t: (en: string, hi: string) => string;
}) {
  const [name, setName] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (editCam) {
      setName(editCam.name);
      setSerialNumber(editCam.serialNumber);
      setUsername(editCam.username || "admin");
      setPassword(editCam.password || "");
    } else {
      setName("");
      setSerialNumber("");
      setUsername("admin");
      setPassword("");
    }
  }, [editCam, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !serialNumber.trim()) return;
    onSave({
      name: name.trim(),
      serialNumber: serialNumber.trim(),
      username: username.trim() || "admin",
      password: password.trim(),
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={editCam ? t("Edit Camera", "कैमरा संपादित करें") : t("Add Camera", "कैमरा जोड़ें")} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Camera Name */}
        <div>
          <label className="block text-xs font-medium text-th-secondary uppercase tracking-wider mb-1.5">
            {t("Camera Name", "कैमरा का नाम")}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("e.g. Front Door, Counter", "जैसे फ्रंट डोर, काउंटर")}
            className="w-full bg-th-base border border-th-border rounded-lg px-3 py-2.5 text-sm text-th-text placeholder-th-muted outline-none focus:border-[#1ed760] transition-colors"
            autoFocus
          />
        </div>

        {/* Serial Number */}
        <div>
          <label className="block text-xs font-medium text-th-secondary uppercase tracking-wider mb-1.5">
            {t("Serial Number (SN)", "सीरियल नंबर (SN)")}
          </label>
          <input
            type="text"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
            placeholder={t("Find on camera label or Easyviewer app", "कैमरे के लेबल या Easyviewer ऐप पर देखें")}
            className="w-full bg-th-base border border-th-border rounded-lg px-3 py-2.5 text-sm text-th-text placeholder-th-muted outline-none focus:border-[#1ed760] transition-colors font-mono"
          />
          <p className="mt-1.5 text-[15px] text-th-muted leading-relaxed">
            {t(
              "The serial number from your Dahua camera. You can find it on the camera label, in the Easyviewer app, or on the camera's web interface under Settings > System Info.",
              "आपके Dahua कैमरे का सीरियल नंबर। यह कैमरे के लेबल, Easyviewer ऐप, या कैमरे के वेब इंटरफ़ेस (Settings > System Info) में मिल सकता है।"
            )}
          </p>
        </div>

        {/* Credentials */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-th-secondary uppercase tracking-wider mb-1.5">
              {t("Username", "यूज़रनेम")}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              className="w-full bg-th-base border border-th-border rounded-lg px-3 py-2.5 text-sm text-th-text placeholder-th-muted outline-none focus:border-[#1ed760] transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-th-secondary uppercase tracking-wider mb-1.5">
              {t("Password", "पासवर्ड")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              className="w-full bg-th-base border border-th-border rounded-lg px-3 py-2.5 text-sm text-th-text placeholder-th-muted outline-none focus:border-[#1ed760] transition-colors"
            />
          </div>
        </div>

        {/* How it works */}
        <div className="bg-th-base/50 rounded-lg p-3 border border-th-border">
          <div className="flex items-start gap-2">
            <Wifi size={14} className="text-[#1ed760] mt-0.5 flex-shrink-0" />
            <p className="text-[15px] text-th-secondary leading-relaxed">
              {t(
                "The camera will be connected via Dahua's P2P cloud using the serial number. No port forwarding or IP address needed. The relay server on our cloud handles the connection automatically.",
                "कैमरा सीरियल नंबर का उपयोग करके Dahua के P2P क्लाउड से कनेक्ट किया जाएगा। कोई पोर्ट फॉरवर्डिंग या IP पता की आवश्यकता नहीं है। हमारे क्लाउड पर रिले सर्वर स्वचालित रूप से कनेक्शन संभालता है।"
              )}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-th-border text-sm font-medium text-th-secondary hover:text-th-text hover:bg-th-hover transition-colors">
            {t("Cancel", "रद्द करें")}
          </button>
          <button type="submit" disabled={!name.trim() || !serialNumber.trim()}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-black transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#1ed760" }}>
            {editCam ? t("Save Changes", "बदलाव सहेजें") : t("Add Camera", "कैमरा जोड़ें")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Cameras() {
  const { uiT: t } = useTranslate();
  const toast = useToast();

  const [cameras, setCameras] = useState<CameraDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editCam, setEditCam] = useState<CameraDoc | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchCameras = useCallback(async () => {
    const res = await api.get<CameraDoc[]>("/api/cameras");
    if (res.success) {
      setCameras((res.data as any)?.data || res.data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);

  // Poll status every 10s
  useEffect(() => {
    const interval = setInterval(fetchCameras, 10000);
    return () => clearInterval(interval);
  }, [fetchCameras]);

  const handleSave = useCallback(async (data: { name: string; serialNumber: string; username: string; password: string }) => {
    if (editCam) {
      const res = await api.patch(`/api/cameras/${editCam._id}`, data);
      if (res.success) {
        toast.success(t("Camera updated", "कैमरा अपडेट हो गया"));
        fetchCameras();
      } else {
        toast.error((res as any).message || "Failed to update camera");
      }
    } else {
      const res = await api.post("/api/cameras", data);
      if (res.success) {
        toast.success(t("Camera added — connecting via P2P...", "कैमरा जोड़ा गया — P2P से कनेक्ट हो रहा है..."));
        fetchCameras();
      } else {
        toast.error((res as any).message || "Failed to add camera");
      }
    }
    setModalOpen(false);
    setEditCam(null);
  }, [editCam, toast, t, fetchCameras]);

  const handleDelete = useCallback(async (id: string) => {
    const res = await api.del(`/api/cameras/${id}`);
    if (res.success) {
      toast.success(t("Camera removed", "कैमरा हटा दिया गया"));
      fetchCameras();
    }
    setDeleteConfirm(null);
  }, [toast, t, fetchCameras]);

  const handleEdit = useCallback((cam: CameraDoc) => { setEditCam(cam); setModalOpen(true); }, []);

  const onlineCount = cameras.filter((c) => c.status === "online").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-th-text flex items-center gap-2">
            <Monitor className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: "#1ed760" }} />
            {t("Live Cameras", "लाइव कैमरे")}
          </h1>
          <p className="text-xs sm:text-sm text-th-secondary mt-1">
            {loading ? t("Loading...", "लोड हो रहा है...") :
              cameras.length === 0
                ? t("No cameras configured", "कोई कैमरा कॉन्फ़िगर नहीं")
                : t(
                    `${cameras.length} camera${cameras.length !== 1 ? "s" : ""}, ${onlineCount} online`,
                    `${cameras.length} कैमरा, ${onlineCount} ऑनलाइन`
                  )
            }
          </p>
        </div>
        <button
          onClick={() => { setEditCam(null); setModalOpen(true); }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-black transition-all duration-200 active:scale-95"
          style={{ backgroundColor: "#1ed760" }}
        >
          <Plus size={16} />
          {t("Add Camera", "कैमरा जोड़ें")}
        </button>
      </div>

      {/* Camera Grid */}
      {!loading && cameras.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {cameras.map((cam) => (
            <CameraCard key={cam._id} cam={cam} onDelete={setDeleteConfirm} onEdit={handleEdit} t={t} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && cameras.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-th-surface flex items-center justify-center mb-4">
            <Camera size={28} className="text-th-muted" />
          </div>
          <h3 className="text-base font-semibold text-th-text mb-1">
            {t("No cameras added", "कोई कैमरा नहीं जोड़ा गया")}
          </h3>
          <p className="text-sm text-th-secondary max-w-md mb-5 leading-relaxed">
            {t(
              "Add your Dahua cameras using just the serial number, username and password. No IP address or port forwarding needed.",
              "अपने Dahua कैमरे केवल सीरियल नंबर, यूज़रनेम और पासवर्ड से जोड़ें। कोई IP पता या पोर्ट फॉरवर्डिंग की आवश्यकता नहीं।"
            )}
          </p>
          <button
            onClick={() => { setEditCam(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold text-black transition-all duration-200 active:scale-95"
            style={{ backgroundColor: "#1ed760" }}
          >
            <Plus size={16} />
            {t("Add Your First Camera", "अपना पहला कैमरा जोड़ें")}
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      <AddEditModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditCam(null); }}
        onSave={handleSave}
        editCam={editCam}
        t={t}
      />

      {/* Delete Confirmation */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title={t("Delete Camera", "कैमरा हटाएँ")} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-th-secondary">
            {t(
              "Are you sure you want to remove this camera? This action cannot be undone.",
              "क्या आप वाकई इस कैमरे को हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।"
            )}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setDeleteConfirm(null)}
              className="flex-1 px-4 py-2.5 rounded-lg border border-th-border text-sm font-medium text-th-secondary hover:text-th-text hover:bg-th-hover transition-colors">
              {t("Cancel", "रद्द करें")}
            </button>
            <button onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-red-500 hover:bg-red-600 transition-colors active:scale-95">
              {t("Delete", "हटाएँ")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

import { useState, useEffect } from "react";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import {
  MessageCircle, RefreshCw, LogOut, Smartphone,
  CheckCircle, XCircle, AlertTriangle, Info
} from "lucide-react";
import { useTranslate } from "../context/TranslateContext";

export default function WhatsApp() {
  const { uiT } = useTranslate();
  const [status, setStatus] = useState<string>("checking");
  const [qr, setQr] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [reinitializing, setReinitializing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      while (!cancelled) {
        try {
          const res = await api.get("/api/whatsapp/qr");
          if (cancelled) return;
          if (res.success) {
            if (res.data?.qr) {
              setQr(res.data.qr);
              setStatus("qr");
            } else if (res.data?.status === "connected") {
              setQr(null);
              setStatus("connected");
            } else if (res.data?.status === "error") {
              setQr(null);
              setStatus("error");
            } else {
              setQr(null);
              setStatus("initializing");
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await api.post("/api/whatsapp/disconnect", {});
      setStatus("disconnected");
      setQr(null);
    } catch {}
    setDisconnecting(false);
  }

  async function handleReinit() {
    setReinitializing(true);
    try {
      await api.post("/api/whatsapp/init", {});
      setStatus("initializing");
      setQr(null);
    } catch {}
    setReinitializing(false);
  }

  if (status === "checking") return <PageSkeleton page="settings" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{uiT("WhatsApp Connection", "WhatsApp कनेक्शन")}</h1>
          <p className="page-subtitle">Connect WhatsApp to send bills and announcements</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        <div className="card p-6 text-center space-y-6">
          <div className="w-16 h-16 bg-[#1ed760]/10 rounded-full flex items-center justify-center mx-auto">
            <MessageCircle size={32} className="text-[#1ed760]" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-th-text mb-1">{uiT("Connect WhatsApp", "WhatsApp कनेक्ट करें")}</h2>
            <p className="body-sm text-th-secondary">
              Link your WhatsApp account to send automated messages
            </p>
          </div>

          {/* Status Display */}
          {status === "connected" && (
            <div className="bg-[#1ed760]/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-center gap-2 text-[#1ed760]">
                <CheckCircle size={24} />
                <span className="text-base font-semibold">{uiT("Connected", "जुड़ा हुआ")}</span>
              </div>
              <p className="body-sm text-th-secondary">
                Your WhatsApp is active. Bills and announcements will be sent automatically.
              </p>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-[#1ed760] hover:bg-[#1db954] text-black body-sm font-medium rounded-lg transition-colors disabled:opacity-50 mx-auto active:scale-95"
              >
                <LogOut size={16} />
                {disconnecting ? uiT("Disconnect", "डिस्कनेक्ट करें") + "..." : uiT("Disconnect", "डिस्कनेक्ट करें")}
              </button>
            </div>
          )}

          {status === "qr" && qr && (
            <div className="space-y-4">
              <div className="bg-th-elevated rounded-lg p-4">
                <div className="flex items-center justify-center gap-2 text-amber-400 mb-2">
                  <Smartphone size={20} />
                  <span className="body-sm font-semibold">{uiT("Scan the QR code", "QR कोड स्कैन करें")}</span>
                </div>
                <p className="text-xs text-th-secondary">
                  Open WhatsApp on your phone → Menu → Linked Devices → Link a Device
                </p>
              </div>
              <img src={qr} alt="WhatsApp QR Code" className="mx-auto w-64 h-64" />
              <div className="flex items-center justify-center gap-2 text-xs text-th-muted">
                <RefreshCw size={12} className="animate-spin" />
                Waiting for scan...
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-[#1ed760] hover:bg-[#1db954] text-black body-sm font-medium rounded-lg transition-colors disabled:opacity-50 mx-auto active:scale-95"
              >
                <LogOut size={16} />
                {disconnecting ? uiT("Disconnect", "डिस्कनेक्ट करें") + "..." : uiT("Cancel", "रद्द करें")}
              </button>
            </div>
          )}

          {status === "initializing" && (
            <div className="bg-th-elevated rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-th-secondary">
                <RefreshCw size={20} className="animate-spin" />
                <span className="body-sm font-medium">Initializing...</span>
              </div>
              <p className="text-xs text-th-muted">
                Starting WhatsApp Web client. This may take up to 30 seconds.
              </p>
              <button
                onClick={handleReinit}
                disabled={reinitializing}
                className="flex items-center gap-2 px-4 py-2 bg-[#1ed760] hover:bg-[#1db954] text-black body-sm font-medium rounded-lg transition-colors disabled:opacity-50 mx-auto active:scale-95"
              >
                <RefreshCw size={16} className={reinitializing ? "animate-spin" : ""} />
                {reinitializing ? uiT("Reinitialize", "पुनः आरंभ करें") + "..." : uiT("Reinitialize", "पुनः आरंभ करें")}
              </button>
            </div>
          )}

          {status === "disconnected" && (
            <div className="bg-th-elevated rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-th-secondary">
                <Info size={20} />
                <span className="body-sm font-medium">{uiT("Disconnected", "डिस्कनेक्ट")}</span>
              </div>
              <p className="text-xs text-th-muted">
                Session has been reset. A new QR code will appear shortly.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="bg-[#e74c3c]/10 rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-[#e74c3c]">
                <XCircle size={20} />
                <span className="body-sm font-medium">Connection Error</span>
              </div>
              <p className="text-xs text-th-secondary">
                WhatsApp failed to start. The server will keep retrying automatically.
                If the issue persists, try clicking "Retry Connection" below.
              </p>
              <button
                onClick={handleReinit}
                disabled={reinitializing}
                className="flex items-center gap-2 px-4 py-2 bg-[#1ed760] hover:bg-[#1db954] text-black body-sm font-medium rounded-lg transition-colors disabled:opacity-50 mx-auto active:scale-95"
              >
                <RefreshCw size={16} className={reinitializing ? "animate-spin" : ""} />
                {reinitializing ? uiT("Reinitialize", "पुनः आरंभ करें") + "..." : uiT("Reinitialize", "पुनः आरंभ करें")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

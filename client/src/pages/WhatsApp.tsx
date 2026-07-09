import { useState, useEffect } from "react";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import {
  MessageCircle, RefreshCw, LogOut, Smartphone,
  CheckCircle, XCircle, AlertTriangle, Info
} from "lucide-react";

export default function WhatsApp() {
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
          <h1 className="page-title">WhatsApp</h1>
          <p className="page-subtitle">Connect WhatsApp to send bills and announcements</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        <div className="card p-6 text-center space-y-6">
          <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-2xl flex items-center justify-center mx-auto">
            <MessageCircle size={32} className="text-green-600 dark:text-green-400" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">WhatsApp Web Connection</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Link your WhatsApp account to send automated messages
            </p>
          </div>

          {/* Status Display */}
          {status === "connected" && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle size={24} />
                <span className="text-base font-semibold">Connected</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Your WhatsApp is active. Bills and announcements will be sent automatically.
              </p>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 mx-auto"
              >
                <LogOut size={16} />
                {disconnecting ? "Disconnecting..." : "Logout & Reset"}
              </button>
            </div>
          )}

          {status === "qr" && qr && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 mb-2">
                  <Smartphone size={20} />
                  <span className="text-sm font-semibold">Scan to Connect</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Open WhatsApp on your phone → Menu → Linked Devices → Link a Device
                </p>
              </div>
              <img src={qr} alt="WhatsApp QR Code" className="mx-auto w-64 h-64" />
              <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                <RefreshCw size={12} className="animate-spin" />
                Waiting for scan...
              </div>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 mx-auto"
              >
                <LogOut size={16} />
                {disconnecting ? "Cancelling..." : "Cancel & Reset"}
              </button>
            </div>
          )}

          {status === "initializing" && (
            <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <RefreshCw size={20} className="animate-spin" />
                <span className="text-sm font-medium">Initializing...</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Starting WhatsApp Web client. This may take up to 30 seconds.
              </p>
              <button
                onClick={handleReinit}
                disabled={reinitializing}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 mx-auto"
              >
                <RefreshCw size={16} className={reinitializing ? "animate-spin" : ""} />
                {reinitializing ? "Reinitializing..." : "Restart Connection"}
              </button>
            </div>
          )}

          {status === "disconnected" && (
            <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400">
                <Info size={20} />
                <span className="text-sm font-medium">Session Cleared</span>
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Session has been reset. A new QR code will appear shortly.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-red-600 dark:text-red-400">
                <XCircle size={20} />
                <span className="text-sm font-medium">Connection Error</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                WhatsApp failed to start. The server will keep retrying automatically.
                If the issue persists, try clicking "Retry Connection" below.
              </p>
              <button
                onClick={handleReinit}
                disabled={reinitializing}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-50 mx-auto"
              >
                <RefreshCw size={16} className={reinitializing ? "animate-spin" : ""} />
                {reinitializing ? "Restarting..." : "Retry Connection"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

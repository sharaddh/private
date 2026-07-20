import { useState, useEffect } from "react";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import {
  MessageCircle, CheckCircle, XCircle, AlertTriangle
} from "lucide-react";
import { useTranslate } from "../context/TranslateContext";

interface WhatsAppStatusResponse {
  status: "connected" | "error" | "disconnected";
  error?: string;
  connectedPhone?: string;
}

type WhatsAppStatus = "checking" | "connected" | "error" | "disconnected";

export default function WhatsApp() {
  const { uiT } = useTranslate();
  const [status, setStatus] = useState<WhatsAppStatus>("checking");
  const [connectedPhone, setConnectedPhone] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      while (!cancelled) {
        try {
          const res = await api.get<WhatsAppStatusResponse>("/api/whatsapp/status");
          if (cancelled) return;
          if (res.success) {
            setConnectedPhone(res.data?.connectedPhone || "");
            setErrorMsg(res.data?.error || "");
            if (res.data?.status === "connected") {
              setStatus("connected");
            } else if (res.data?.status === "error") {
              setStatus("error");
            } else {
              setStatus("disconnected");
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  if (status === "checking") return <PageSkeleton page="settings" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{uiT("WhatsApp Connection", "WhatsApp कनेक्शन")}</h1>
          <p className="page-subtitle">Meta WhatsApp Cloud API — send bills and announcements</p>
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        <div className="card p-6 text-center space-y-6">
          <div className="w-16 h-16 bg-[#1ed760]/10 rounded-full flex items-center justify-center mx-auto">
            <MessageCircle size={32} className="text-[#1ed760]" aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-th-text mb-1">{uiT("WhatsApp Cloud API", "WhatsApp क्लाउड API")}</h2>
            <p className="body-sm text-th-secondary">
              Send automated messages via Meta WhatsApp Business API
            </p>
          </div>

          {status === "connected" && (
            <div className="bg-[#1ed760]/10 rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-center gap-2 text-[#1ed760]">
                <CheckCircle size={24} aria-hidden="true" />
                <span className="text-base font-semibold">{uiT("Connected", "जुड़ा हुआ")}</span>
              </div>
              {connectedPhone && (
                <p className="text-sm text-th-text font-mono">Phone ID: {connectedPhone}</p>
              )}
              <p className="body-sm text-th-secondary">
                WhatsApp Cloud API is active. Bills and announcements will be sent automatically.
              </p>
            </div>
          )}

          {status === "disconnected" && (
            <div className="bg-th-elevated rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <AlertTriangle size={20} aria-hidden="true" />
                <span className="body-sm font-medium">{uiT("Not Configured", "कॉन्फ़िगर नहीं")}</span>
              </div>
              <p className="text-xs text-th-muted">
                Set WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in your environment to enable WhatsApp.
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="bg-[#e74c3c]/10 rounded-lg p-6 space-y-3">
              <div className="flex items-center justify-center gap-2 text-[#e74c3c]">
                <XCircle size={20} aria-hidden="true" />
                <span className="body-sm font-medium">Configuration Error</span>
              </div>
              <p className="text-xs text-th-secondary">
                {errorMsg || "WhatsApp Cloud API is not properly configured. Check your environment variables."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

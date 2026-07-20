import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api";
import { customerService, settingsService, whatsappService } from "../services";
import PageSkeleton from "../components/PageSkeleton";
import { useToast } from "../context/ToastContext";
import { useTranslate } from "../context/TranslateContext";
import {
  Send, Search, MessageCircle, Users, CheckSquare, Square,
  Smartphone, RefreshCw, CheckCircle, XCircle, Loader2,
  X, Clock, Shield, AlertTriangle, Filter,
  Hourglass, Paperclip, FileText,
} from "lucide-react";
import type { Customer, ShopSettings } from "../types";

interface AntiBanPreset {
  label: string;
  delay: { min: number; max: number };
  batchSize: number;
  pause: number;
}

interface SendResult {
  phone: string;
  status: "sent" | "failed";
  name?: string;
}

const ANTIBAN_PRESETS: AntiBanPreset[] = [
  { label: "Slow (Safe)", delay: { min: 4000, max: 8000 }, batchSize: 10, pause: 30000 },
  { label: "Normal", delay: { min: 2000, max: 5000 }, batchSize: 20, pause: 15000 },
  { label: "Fast", delay: { min: 1000, max: 3000 }, batchSize: 30, pause: 5000 },
];

const ANTIBAN_LABEL_HI: Record<string, string> = {
  "Slow (Safe)": "धीमा (सुरक्षित)",
  "Normal": "सामान्य",
  "Fast": "तेज़",
};

type PhoneFilter = "all" | "yes" | "no";

export default function Announcement() {
  const { uiT } = useTranslate();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filtered, setFiltered] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const [waConnected, setWaConnected] = useState<boolean | null>(null);

  const [sending, setSending] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [results, setResults] = useState<SendResult[]>([]);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const [antibanPreset, setAntibanPreset] = useState<AntiBanPreset>(ANTIBAN_PRESETS[1]);

  const [mediaFile, setMediaFile] = useState<{ base64: string; filename: string; mimetype: string } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterHasPhone, setFilterHasPhone] = useState<PhoneFilter>("all");

  const [allPhones, setAllPhones] = useState<string[]>([]);
  const [sentPhones, setSentPhones] = useState<Set<string>>(new Set());

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get<{ status?: string }>("/api/whatsapp/status");
      if (res.success) {
        setWaConnected(res.data?.status === "connected");
      } else {
        setWaConnected(false);
      }
    } catch {
      setWaConnected(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([
      customerService.list<Customer[]>(),
      settingsService.get(),
    ]).then(([c, s]) => {
      if (c.success) {
        const list = (c.data as any)?.data || (Array.isArray(c.data) ? c.data : []) as Customer[];
        setCustomers(list);
        setFiltered(list);
        setAllPhones(list.filter((x: Customer) => x.mobile).map((x: Customer) => x.mobile!.replace(/\D/g, "")));
      }
      if (s.success) setSettings(s.data ?? null);
    }).finally(() => setLoading(false));
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  useEffect(() => {
    let list = [...customers];
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.mobile || "").includes(q) ||
        (c.customerId || "").toLowerCase().includes(q)
      );
    }
    if (filterHasPhone === "yes") {
      list = list.filter((c) => !!c.mobile?.replace(/\D/g, ""));
    } else if (filterHasPhone === "no") {
      list = list.filter((c) => !c.mobile?.replace(/\D/g, ""));
    }
    setFiltered(list);
    setSelectAll(false);
    setSelected(new Set());
  }, [search, customers, filterHasPhone]);

  function toggleSelect(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function toggleSelectAll() {
    if (selectAll) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c._id)));
    }
    setSelectAll(!selectAll);
  }

  function getSelectedPhones(): string[] {
    const ids = selectAll ? filtered.map((c) => c._id) : [...selected];
    return ids
      .map((id) => customers.find((c) => c._id === id))
      .filter((c) => c?.mobile)
      .map((c) => c!.mobile!.replace(/\D/g, ""));
  }

  function getSelectedCustomers(): Customer[] {
    const ids = selectAll ? filtered.map((c) => c._id) : [...selected];
    return ids
      .map((id) => customers.find((c) => c._id === id))
      .filter(Boolean) as Customer[];
  }

  async function handleSend() {
    setShowConfirm(false);
    const phones = getSelectedPhones();
    if (phones.length === 0) { toast.error("No customers with phone numbers selected."); return; }
    if (!message.trim() && !mediaFile) { toast.error("Please enter a message or attach a file."); return; }

    setSending(true);
    setProgress({ sent: 0, failed: 0, total: phones.length });
    setResults([]);
    setDone(false);
    setShowResults(false);

    const msg = message;

    const payload: Record<string, unknown> = {
      numbers: phones,
      message: msg,
      antiban: {
        delayMin: antibanPreset.delay.min,
        delayMax: antibanPreset.delay.max,
        batchSize: antibanPreset.batchSize,
        pause: antibanPreset.pause,
      },
    };
    if (mediaFile) payload.media = mediaFile;

    try {
      const res = await api.post<{ sent: number; failed: number; results: SendResult[] }>("/api/whatsapp/broadcast", payload);
      if (res.success) {
        setProgress({ sent: res.data!.sent, failed: res.data!.failed, total: phones.length });
        const resultsList: SendResult[] = (res.data!.results || []).map((r) => ({
          ...r,
          name: customers.find((c) => c.mobile?.replace(/\D/g, "") === r.phone)?.name || r.phone,
        }));
        setResults(resultsList);
        setSentPhones((prev) => {
          const next = new Set(prev);
          resultsList.filter((r) => r.status === "sent").forEach((r) => next.add(r.phone));
          return next;
        });
      } else {
        setProgress({ sent: 0, failed: phones.length, total: phones.length });
      }
    } catch {
      setProgress({ sent: 0, failed: phones.length, total: phones.length });
    } finally {
      setSending(false);
      setDone(true);
      setShowResults(true);
    }
  }

  const selectedCount = selectAll ? filtered.length : selected.size;
  const selectedPhones = getSelectedPhones();
  const selectedCustomers = getSelectedCustomers();
  const remainingCount = allPhones.length - sentPhones.size;

  if (loading) return <PageSkeleton page="announcement" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{uiT("Announcements", "घोषणाएँ")}</h1>
          <p className="page-subtitle">{uiT("Send WhatsApp messages to your customers.", "अपने ग्राहकों को WhatsApp संदेश भेजें।")}</p>
        </div>
      </div>

      {/* WhatsApp Connection Status */}
      <div className={`card ${waConnected ? "border-[#1ed760]/20" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${
              waConnected ? "bg-[#1ed760]/10 text-[#1ed760]" :
              waConnected === false ? "bg-[#e74c3c]/10 text-[#e74c3c]" :
              "bg-th-elevated text-th-muted"
            }`}>
              <Smartphone size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-th-text">
                WhatsApp {waConnected ? "Connected" : waConnected === false ? "Not Connected" : "Checking..."}
              </h3>
              <p className="text-xs text-th-secondary">
                {waConnected ? "Ready to send messages" :
                 waConnected === false ? "Connect WhatsApp in Settings to send messages" :
                 "Checking connection..."}
              </p>
            </div>
          </div>
          <button onClick={checkStatus} aria-label={uiT("Refresh WhatsApp status", "WhatsApp स्थिति रीफ्रेश करें")} className="btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Compose */}
        <div className="lg:col-span-1 card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1ed760]/10 rounded-sm flex items-center justify-center text-[#1ed760]">
              <MessageCircle size={20} aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-semibold text-th-text">{uiT("Compose Message", "संदेश लिखें")}</h3>
              <p className="text-xs text-th-secondary">{uiT("WhatsApp broadcast", "WhatsApp प्रसारण")}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Message", "संदेश")}</label>
            <textarea
              className="input-field resize-none"
              rows={8}
              placeholder={uiT("Type your announcement message here...", "यहाँ अपना संदेश लिखें...")}
              aria-label={uiT("Announcement message", "घोषणा संदेश")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={5000}
            />
            <p className="text-xs text-th-secondary mt-1">{message.length} characters</p>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-th-secondary mb-2">{uiT("Attachment (optional)", "संलग्नक (वैकल्पिक)")}</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              aria-label={uiT("Attach file", "फ़ाइल संलग्न करें")}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const base64 = (reader.result as string).split(",")[1];
                  setMediaFile({ base64, filename: file.name, mimetype: file.type });
                  if (file.type.startsWith("image/")) {
                    setMediaPreview(reader.result as string);
                  } else {
                    setMediaPreview(null);
                  }
                };
                reader.readAsDataURL(file);
              }}
            />
            {mediaFile ? (
              <div className="flex items-center gap-3 p-3 bg-th-elevated rounded-sm border border-th-border">
                {mediaPreview ? (
                  <img src={mediaPreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#1ed760]/10 flex items-center justify-center text-[#1ed760]">
                    <FileText size={18} aria-hidden="true" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-th-text truncate">{mediaFile.filename}</p>
                  <p className="text-xs text-th-muted">{mediaFile.mimetype}</p>
                </div>
                <button
                  onClick={() => { setMediaFile(null); setMediaPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  aria-label={uiT("Remove attachment", "संलग्नक हटाएं")}
                  className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted transition-colors"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label={uiT("Attach file for broadcast", "प्रसारण के लिए फ़ाइल संलग्न करें")}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-th-border rounded-sm text-sm text-th-secondary hover:border-[#1ed760] hover:text-[#1ed760] transition-all"
              >
                <Paperclip size={16} aria-hidden="true" /> {uiT("Attach File (Image, PDF, Document...)", "फ़ाइल संलग्न करें (चित्र, PDF, दस्तावेज़...)")}
              </button>
            )}
          </div>

          {/* Anti-ban Preset */}
          <div>
            <label className="block text-sm font-medium text-th-secondary mb-2 flex items-center gap-1.5">
              <Shield size={14} aria-hidden="true" /> {uiT("Anti-Ban Speed", "एंटी-बैन स्पीड")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ANTIBAN_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setAntibanPreset(p)}
                  aria-label={uiT(p.label, ANTIBAN_LABEL_HI[p.label] || p.label)}
                  className={`px-3 py-2 rounded-sm text-xs font-medium border transition-all ${
                    antibanPreset.label === p.label
                      ? "bg-[#1ed760]/10 border-[#1ed760]/30 text-[#1ed760]"
                      : "bg-th-card border-th-border text-th-secondary hover:border-[#555]"
                  }`}
                >
                  <div className="font-semibold mb-0.5">{uiT(p.label, ANTIBAN_LABEL_HI[p.label] || p.label)}</div>
                  <div className="opacity-70">{p.delay.min / 1000}s-{p.delay.max / 1000}s</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-th-secondary mt-1.5 flex items-center gap-1">
              <Clock size={11} aria-hidden="true" /> {antibanPreset.batchSize} msgs/batch · {antibanPreset.pause / 1000}s pause · Random greetings
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-th-elevated rounded-sm">
              <Users size={18} className="text-th-muted" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-th-text">{customers.length} {uiT("Total Customers", "कुल ग्राहक")}</p>
                <p className="text-xs text-th-secondary">
                  {selectedCount > 0 ? `${selectedCount} ${uiT("selected", "चयनित")} (${selectedPhones.length} ${uiT("with number", "नंबर के साथ")})` : uiT("No customers selected", "कोई ग्राहक चयनित नहीं")}
                </p>
              </div>
            </div>
            {remainingCount > 0 && (
              <div className="flex items-center gap-3 p-3 bg-[#1ed760]/10 rounded-sm">
                <Hourglass size={18} className="text-[#1ed760]" aria-hidden="true" />
                <div>
                  <p className="text-sm font-medium text-[#1ed760]">{uiT("Previously Sent", "पहले भेजे गए")}</p>
                  <p className="text-xs text-[#1ed760]/70">{allPhones.length - remainingCount} {uiT("sent", "भेजा गया")} · {remainingCount} {uiT("remaining", "शेष")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="p-3 rounded-sm bg-th-elevated">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-th-text">
                  {sending ? "Sending..." : done ? "Complete" : ""}
                </p>
              </div>
              <div className="w-full bg-th-card rounded-full h-1.5 mb-2">
                <div
                  className="bg-[#1ed760] h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.sent + progress.failed) / progress.total * 100)}%` }}
                  role="progressbar"
                  aria-valuenow={Math.round((progress.sent + progress.failed) / progress.total * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-[#1ed760] flex items-center gap-1">
                  <CheckCircle size={14} aria-hidden="true" /> {progress.sent} sent
                </span>
                {progress.failed > 0 && (
                  <span className="text-[#e74c3c] flex items-center gap-1">
                    <XCircle size={14} aria-hidden="true" /> {progress.failed} failed
                  </span>
                )}
                <span className="text-th-muted">/ {progress.total}</span>
              </div>
            </div>
          )}

          {/* Results Table */}
          {showResults && results.length > 0 && (
            <div className="p-3 rounded-sm bg-th-elevated max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-th-secondary uppercase mb-2">Per-Customer Status</p>
              <div className="space-y-1">
                {results.map((r, i) => (
                  <div key={r.phone || r.name || i} className="flex items-center justify-between text-xs py-1">
                    <span className="text-th-secondary truncate mr-2">{r.name}</span>
                    <span className={`flex items-center gap-1 shrink-0 ${
                      r.status === "sent" ? "text-[#1ed760]" : "text-[#e74c3c]"
                    }`}>
                      {r.status === "sent" ? <CheckCircle size={11} aria-hidden="true" /> : <XCircle size={11} aria-hidden="true" />}
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => setShowConfirm(true)}
            disabled={selectedCount === 0 || sending || !waConnected || (!message.trim() && !mediaFile)}
            aria-label={uiT("Send broadcast to selected customers", "चयनित ग्राहकों को प्रसारण भेजें")}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <><Loader2 size={18} className="animate-spin" aria-hidden="true" /> Sending...</>
            ) : (
              <><Send size={18} aria-hidden="true" /> {uiT("Send to", "भेजें")} {selectedCount > 0 ? `${selectedCount} customer${selectedCount > 1 ? "s" : ""}` : "Selected"}</>
            )}
          </button>

          {!waConnected && selectedCount > 0 && (
            <p className="text-xs text-amber-400 text-center">
              Connect WhatsApp in Settings to send messages
            </p>
          )}
        </div>

        {/* Right: Customer List */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-th-text">{uiT("Customers", "ग्राहक")}</h3>
            <span className="text-xs text-th-secondary">
              {filtered.length} of {customers.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-secondary" aria-hidden="true" />
            <input
              type="text"
              placeholder={uiT("Search by name, mobile, or ID...", "नाम, मोबाइल या ID से खोजें...")}
              aria-label={uiT("Search customers", "ग्राहक खोजें")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-th-elevated border border-th-border rounded-sm text-sm text-th-text placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filter: Phone only */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Filter size={14} className="text-th-muted" aria-hidden="true" />
            <select
              value={filterHasPhone}
              onChange={(e) => setFilterHasPhone(e.target.value as PhoneFilter)}
              aria-label={uiT("Filter by phone number", "फ़ोन नंबर से फ़िल्टर करें")}
              className="text-xs bg-th-elevated border border-th-border rounded-lg px-2.5 py-1.5 text-th-secondary focus:outline-none"
            >
              <option value="all">{uiT("All", "सभी")}</option>
              <option value="yes">{uiT("Has Phone", "फ़ोन है")}</option>
              <option value="no">{uiT("No Phone", "फ़ोन नहीं")}</option>
            </select>
          </div>

          {filtered.length > 0 && (
            <button
              onClick={toggleSelectAll}
              aria-label={selectAll ? uiT("Deselect all customers", "सभी ग्राहक हटाएं") : uiT("Select all customers", "सभी ग्राहक चुनें")}
              className="flex items-center gap-2 text-sm text-th-secondary hover:text-[#1ed760] mb-2"
            >
              {selectAll ? <CheckSquare size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
              {selectAll ? uiT("Deselect All", "सभी हटाएं") : uiT("Select All", "सभी चुनें")}
            </button>
          )}

          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-th-secondary">
                <Users size={32} className="mx-auto mb-2 opacity-50" aria-hidden="true" />
                <p className="text-sm">{uiT("No customers found", "कोई ग्राहक नहीं मिला")}</p>
              </div>
            ) : (
              filtered.map((c) => {
                const isSelected = selectAll || selected.has(c._id);
                const hasPhone = !!c.mobile?.replace(/\D/g, "");
                const alreadySent = sentPhones.has(c.mobile?.replace(/\D/g, "") || "");
                return (
                  <div
                    key={c._id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-sm transition-colors ${
                      isSelected ? "bg-[#1ed760]/10" : "hover:bg-th-elevated"
                    }`}
                  >
                    <button onClick={() => toggleSelect(c._id)} aria-label={uiT(isSelected ? "Deselect" : "Select", isSelected ? "हटाएं" : "चुनें") + " " + (c.name || "")} className="flex-shrink-0 text-th-muted hover:text-[#1ed760]">
                      {isSelected ? <CheckSquare size={18} className="text-[#1ed760]" aria-hidden="true" /> : <Square size={18} aria-hidden="true" />}
                    </button>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${
                      alreadySent
                        ? "bg-[#1ed760]/20 text-[#1ed760]"
                        : "bg-[#1ed760]/20 text-[#1ed760]"
                    }`}>
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-th-text truncate flex items-center gap-1.5">
                        {c.name || "—"}
                        {alreadySent && <CheckCircle size={11} className="text-[#1ed760] shrink-0" aria-hidden="true" />}
                      </p>
                      <p className={`text-xs ${hasPhone ? "text-th-secondary" : "text-red-400"}`}>
                        {c.mobile || "No number"}
                      </p>
                    </div>
                    {hasPhone && (
                      <div className="w-2 h-2 rounded-full bg-[#1ed760] flex-shrink-0" title="Has WhatsApp number" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ──────────────── CONFIRM DRAWER ──────────────── */}
      <AnimatePresence>
        {showConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowConfirm(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-th-surface rounded-t-lg border border-th-border sm:max-w-sm sm:mx-auto sm:bottom-4 sm:rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#333] rounded-lg" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-th-text mb-1">{uiT("Confirm Broadcast", "प्रसारण की पुष्टि करें")}</h3>
                <p className="text-sm text-th-secondary mb-4">
                  Send to <strong>{selectedPhones.length}</strong> customer{selectedPhones.length !== 1 ? "s" : ""}
                </p>

                {selectedCustomers.length > 0 && (
                  <div className="mb-4 max-h-28 overflow-y-auto space-y-1">
                    {selectedCustomers.slice(0, 5).map((c) => (
                      <div key={c._id} className="flex items-center gap-2 text-xs text-th-secondary">
                        <div className="w-5 h-5 rounded-full bg-[#1ed760]/20 flex items-center justify-center text-[#1ed760] font-semibold text-[13px]">
                          {c.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        {c.name} — {c.mobile || "No number"}
                      </div>
                    ))}
                    {selectedCustomers.length > 5 && (
                      <p className="text-xs text-th-muted">...and {selectedCustomers.length - 5} more</p>
                    )}
                  </div>
                )}

                {mediaFile && (
                  <div className="bg-[#1ed760]/10 border border-[#1ed760]/20 rounded-sm px-4 py-3 text-xs text-[#1ed760] mb-4">
                    <p className="font-medium mb-1 flex items-center gap-1.5">
                      <Paperclip size={13} aria-hidden="true" /> Attachment:
                    </p>
                    <p className="opacity-80">{mediaFile.filename} ({mediaFile.mimetype})</p>
                  </div>
                )}

                <div className="bg-amber-500/10 border border-amber-700/50 rounded-sm px-4 py-3 text-xs text-amber-300 mb-4">
                  <p className="font-medium mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={13} aria-hidden="true" /> {uiT("Message preview:", "संदेश पूर्वावलोकन:")}
                  </p>
                  <p className="opacity-80 italic">"{message.slice(0, 100)}{message.length > 100 ? "..." : ""}"</p>
                </div>

                <div className="bg-th-elevated rounded-sm px-4 py-3 text-xs text-th-secondary mb-4">
                  <div className="flex items-center gap-1.5 font-medium mb-1">
                    <Shield size={13} aria-hidden="true" /> {uiT("Anti-Ban Protection", "एंटी-बैन सुरक्षा")}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span>Delay: {antibanPreset.delay.min / 1000}s – {antibanPreset.delay.max / 1000}s</span>
                    <span>Batch: {antibanPreset.batchSize} msgs</span>
                    <span>Pause: {antibanPreset.pause / 1000}s</span>
                    <span>Variations: Enabled</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowConfirm(false)} aria-label={uiT("Cancel broadcast", "प्रसारण रद्द करें")} className="btn-secondary flex-1">{uiT("Cancel", "रद्द करें")}</button>
                  <button onClick={handleSend} aria-label={uiT("Send broadcast now", "अभी प्रसारण भेजें")} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                    <Send size={16} aria-hidden="true" /> {uiT("Send Now", "अभी भेजें")}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import { useToast } from "../context/ToastContext";
import { useTranslate } from "../context/TranslateContext";
import {
  Send, Search, MessageCircle, Users, CheckSquare, Square,
  Smartphone, RefreshCw, CheckCircle, XCircle, Loader2,
  X, Clock, Shield, AlertTriangle, Filter,
  Hourglass, Paperclip, FileText,
} from "lucide-react";

const ANTIBAN_PRESETS = [
  { label: "Slow (Safe)", delay: { min: 4000, max: 8000 }, batchSize: 10, pause: 30000 },
  { label: "Normal", delay: { min: 2000, max: 5000 }, batchSize: 20, pause: 15000 },
  { label: "Fast", delay: { min: 1000, max: 3000 }, batchSize: 30, pause: 5000 },
];

const ANTIBAN_LABEL_HI: Record<string, string> = {
  "Slow (Safe)": "धीमा (सुरक्षित)",
  "Normal": "सामान्य",
  "Fast": "तेज़",
};

interface SendResult {
  phone: string;
  status: "sent" | "failed";
  name?: string;
}

export default function Announcement() {
  const { uiT } = useTranslate();
  const toast = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectAll, setSelectAll] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [waConnected, setWaConnected] = useState<boolean | null>(null);

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; failed: number; total: number } | null>(null);
  const [results, setResults] = useState<SendResult[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [done, setDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [antibanPreset, setAntibanPreset] = useState(ANTIBAN_PRESETS[1]);

  const [mediaFile, setMediaFile] = useState<{ base64: string; filename: string; mimetype: string } | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterHasPhone, setFilterHasPhone] = useState<"all" | "yes" | "no">("all");

  const [allPhones, setAllPhones] = useState<string[]>([]);
  const [sentPhones, setSentPhones] = useState<Set<string>>(new Set());

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get("/api/whatsapp/status");
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
      api.get("/api/customers"),
      api.get("/api/settings"),
    ]).then(([c, s]) => {
      if (c.success) {
        // API returns { data: { data: [...], total, page, pages } }
        const list = c.data?.data || (Array.isArray(c.data) ? c.data : []);
        setCustomers(list);
        setFiltered(list);
        setAllPhones(list.filter((x: any) => x.mobile).map((x: any) => x.mobile.replace(/\D/g, "")));
      }
      if (s.success) setSettings(s.data);
    }).finally(() => setLoading(false));
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  // Filter logic
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
      .map((c) => c.mobile.replace(/\D/g, ""));
  }

  function getSelectedCustomers(): any[] {
    const ids = selectAll ? filtered.map((c) => c._id) : [...selected];
    return ids
      .map((id) => customers.find((c) => c._id === id))
      .filter(Boolean);
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

    const payload: any = {
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
      const res = await api.post("/api/whatsapp/broadcast", payload);
      if (res.success) {
        setProgress({ sent: res.data.sent, failed: res.data.failed, total: phones.length });
        const resultsList: SendResult[] = (res.data.results || []).map((r: any) => ({
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
      <div className={`card ${waConnected ? "border-emerald-200 dark:border-emerald-800" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              waConnected ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
              waConnected === false ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" :
              "bg-slate-50 dark:bg-slate-700 text-slate-400"
            }`}>
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">
                WhatsApp {waConnected ? "Connected" : waConnected === false ? "Not Connected" : "Checking..."}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {waConnected ? "Ready to send messages" :
                 waConnected === false ? "Connect WhatsApp in Settings to send messages" :
                 "Checking connection..."}
              </p>
            </div>
          </div>
          <button onClick={checkStatus} className="btn-secondary btn-sm flex items-center gap-1.5">
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Compose */}
        <div className="lg:col-span-1 card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{uiT("Compose Message", "संदेश लिखें")}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">{uiT("WhatsApp broadcast", "WhatsApp प्रसारण")}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{uiT("Message", "संदेश")}</label>
            <textarea
              className="input-field resize-none"
              rows={8}
              placeholder={uiT("Type your announcement message here...", "यहाँ अपना संदेश लिखें...")}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={5000}
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{message.length} characters</p>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{uiT("Attachment (optional)", "संलग्नक (वैकल्पिक)")}</label>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
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
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl border border-slate-200 dark:border-slate-700">
                {mediaPreview ? (
                  <img src={mediaPreview} alt="Preview" className="w-10 h-10 rounded-lg object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <FileText size={18} />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{mediaFile.filename}</p>
                  <p className="text-xs text-slate-400">{mediaFile.mimetype}</p>
                </div>
                <button
                  onClick={() => { setMediaFile(null); setMediaPreview(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-slate-400 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-sm text-slate-500 dark:text-slate-400 hover:border-primary-400 dark:hover:border-primary-500 hover:text-primary-600 dark:hover:text-primary-400 transition-all"
              >
                <Paperclip size={16} /> {uiT("Attach File (Image, PDF, Document...)", "फ़ाइल संलग्न करें (चित्र, PDF, दस्तावेज़...)")}
              </button>
            )}
          </div>

          {/* Anti-ban Preset */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
              <Shield size={14} /> {uiT("Anti-Ban Speed", "एंटी-बैन स्पीड")}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {ANTIBAN_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setAntibanPreset(p)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                    antibanPreset.label === p.label
                      ? "bg-primary-50 dark:bg-primary-500/10 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="font-semibold mb-0.5">{uiT(p.label, ANTIBAN_LABEL_HI[p.label] || p.label)}</div>
                  <div className="opacity-70">{p.delay.min / 1000}s-{p.delay.max / 1000}s</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5 flex items-center gap-1">
              <Clock size={11} /> {antibanPreset.batchSize} msgs/batch · {antibanPreset.pause / 1000}s pause · Random greetings
            </p>
          </div>

          {/* Stats */}
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl">
              <Users size={18} className="text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{customers.length} {uiT("Total Customers", "कुल ग्राहक")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selectedCount > 0 ? `${selectedCount} ${uiT("selected", "चयनित")} (${selectedPhones.length} ${uiT("with number", "नंबर के साथ")})` : uiT("No customers selected", "कोई ग्राहक चयनित नहीं")}
                </p>
              </div>
            </div>
            {remainingCount > 0 && (
              <div className="flex items-center gap-3 p-3 bg-primary-50 dark:bg-primary-500/10 rounded-xl">
                <Hourglass size={18} className="text-primary-500" />
                <div>
                  <p className="text-sm font-medium text-primary-700 dark:text-primary-300">{uiT("Previously Sent", "पहले भेजे गए")}</p>
                  <p className="text-xs text-primary-500/70">{allPhones.length - remainingCount} {uiT("sent", "भेजा गया")} · {remainingCount} {uiT("remaining", "शेष")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          {progress && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  {sending ? "Sending..." : done ? "Complete" : ""}
                </p>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-1.5 mb-2">
                <div
                  className="bg-primary-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.sent + progress.failed) / progress.total * 100)}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} /> {progress.sent} sent
                </span>
                {progress.failed > 0 && (
                  <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle size={14} /> {progress.failed} failed
                  </span>
                )}
                <span className="text-slate-400">/ {progress.total}</span>
              </div>
            </div>
          )}

          {/* Results Table */}
          {showResults && results.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 max-h-48 overflow-y-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Per-Customer Status</p>
              <div className="space-y-1">
                {results.map((r, i) => (
                  <div key={r.phone || r.name || i} className="flex items-center justify-between text-xs py-1">
                    <span className="text-slate-700 dark:text-slate-300 truncate mr-2">{r.name}</span>
                    <span className={`flex items-center gap-1 shrink-0 ${
                      r.status === "sent" ? "text-emerald-600" : "text-red-600"
                    }`}>
                      {r.status === "sent" ? <CheckCircle size={11} /> : <XCircle size={11} />}
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
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <><Loader2 size={18} className="animate-spin" /> Sending...</>
            ) : (
              <><Send size={18} /> {uiT("Send to", "भेजें")} {selectedCount > 0 ? `${selectedCount} customer${selectedCount > 1 ? "s" : ""}` : "Selected"}</>
            )}
          </button>

          {!waConnected && selectedCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              Connect WhatsApp in Settings to send messages
            </p>
          )}
        </div>

        {/* Right: Customer List */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900 dark:text-white">{uiT("Customers", "ग्राहक")}</h3>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {filtered.length} of {customers.length}
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder={uiT("Search by name, mobile, or ID...", "नाम, मोबाइल या ID से खोजें...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Filter: Phone only */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Filter size={14} className="text-slate-400" />
            <select
              value={filterHasPhone}
              onChange={(e) => setFilterHasPhone(e.target.value as any)}
              className="text-xs bg-slate-100 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none"
            >
              <option value="all">{uiT("All", "सभी")}</option>
              <option value="yes">{uiT("Has Phone", "फ़ोन है")}</option>
              <option value="no">{uiT("No Phone", "फ़ोन नहीं")}</option>
            </select>
          </div>

          {filtered.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 mb-2"
            >
              {selectAll ? <CheckSquare size={16} /> : <Square size={16} />}
              {selectAll ? uiT("Deselect All", "सभी हटाएं") : uiT("Select All", "सभी चुनें")}
            </button>
          )}

          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">{uiT("No customers found", "कोई ग्राहक नहीं मिला")}</p>
              </div>
            ) : (
              filtered.map((c) => {
                const isSelected = selectAll || selected.has(c._id);
                const hasPhone = !!c.mobile?.replace(/\D/g, "");
                const alreadySent = sentPhones.has(c.mobile?.replace(/\D/g, ""));
                return (
                  <div
                    key={c._id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isSelected ? "bg-primary-50 dark:bg-primary-500/10" : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
                    }`}
                  >
                    <button onClick={() => toggleSelect(c._id)} className="flex-shrink-0 text-slate-400 hover:text-primary-600 dark:hover:text-primary-400">
                      {isSelected ? <CheckSquare size={18} className="text-primary-600 dark:text-primary-400" /> : <Square size={18} />}
                    </button>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs flex-shrink-0 ${
                      alreadySent
                        ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400"
                    }`}>
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                        {c.name || "—"}
                        {alreadySent && <CheckCircle size={11} className="text-emerald-500 shrink-0" />}
                      </p>
                      <p className={`text-xs ${hasPhone ? "text-slate-400 dark:text-slate-500" : "text-red-400"}`}>
                        {c.mobile || "No number"}
                      </p>
                    </div>
                    {hasPhone && (
                      <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="Has WhatsApp number" />
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
              className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 rounded-t-2xl shadow-2xl border border-slate-200 dark:border-slate-700/50 sm:max-w-sm sm:mx-auto sm:bottom-4 sm:rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{uiT("Confirm Broadcast", "प्रसारण की पुष्टि करें")}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                  Send to <strong>{selectedPhones.length}</strong> customer{selectedPhones.length !== 1 ? "s" : ""}
                </p>

                {selectedCustomers.length > 0 && (
                  <div className="mb-4 max-h-28 overflow-y-auto space-y-1">
                    {selectedCustomers.slice(0, 5).map((c) => (
                      <div key={c._id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center text-primary-600 font-semibold text-[9px]">
                          {c.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        {c.name} — {c.mobile || "No number"}
                      </div>
                    ))}
                    {selectedCustomers.length > 5 && (
                      <p className="text-xs text-slate-400">...and {selectedCustomers.length - 5} more</p>
                    )}
                  </div>
                )}

                {mediaFile && (
                  <div className="bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-700/50 rounded-xl px-4 py-3 text-xs text-primary-700 dark:text-primary-300 mb-4">
                    <p className="font-medium mb-1 flex items-center gap-1.5">
                      <Paperclip size={13} /> Attachment:
                    </p>
                    <p className="opacity-80">{mediaFile.filename} ({mediaFile.mimetype})</p>
                  </div>
                )}

                <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-700/50 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-300 mb-4">
                  <p className="font-medium mb-1 flex items-center gap-1.5">
                    <AlertTriangle size={13} /> {uiT("Message preview:", "संदेश पूर्वावलोकन:")}
                  </p>
                  <p className="opacity-80 italic">"{message.slice(0, 100)}{message.length > 100 ? "..." : ""}"</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/30 rounded-xl px-4 py-3 text-xs text-slate-600 dark:text-slate-400 mb-4">
                  <div className="flex items-center gap-1.5 font-medium mb-1">
                    <Shield size={13} /> {uiT("Anti-Ban Protection", "एंटी-बैन सुरक्षा")}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    <span>Delay: {antibanPreset.delay.min / 1000}s – {antibanPreset.delay.max / 1000}s</span>
                    <span>Batch: {antibanPreset.batchSize} msgs</span>
                    <span>Pause: {antibanPreset.pause / 1000}s</span>
                    <span>Variations: Enabled</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">{uiT("Cancel", "रद्द करें")}</button>
                  <button onClick={handleSend} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                    <Send size={16} /> {uiT("Send Now", "अभी भेजें")}
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

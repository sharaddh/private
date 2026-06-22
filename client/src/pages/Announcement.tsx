import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import {
  Send, Search, MessageCircle, Users, CheckSquare, Square,
  Smartphone, RefreshCw, CheckCircle, XCircle, Loader2
} from "lucide-react";

export default function Announcement() {
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
  const [done, setDone] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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
      if (c.success) { setCustomers(c.data || []); setFiltered(c.data || []); }
      if (s.success) setSettings(s.data);
    }).finally(() => setLoading(false));
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      setFiltered(customers);
    } else {
      setFiltered(customers.filter((c) =>
        (c.name || "").toLowerCase().includes(q) ||
        (c.mobile || "").includes(q) ||
        (c.customerId || "").toLowerCase().includes(q)
      ));
    }
    setSelectAll(false);
    setSelected(new Set());
  }, [search, customers]);

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

  async function handleSend() {
    setShowConfirm(false);
    const phones = getSelectedPhones();
    if (phones.length === 0 || !message.trim()) return;

    setSending(true);
    setProgress({ sent: 0, failed: 0, total: phones.length });
    setDone(false);

    const shop = settings?.shopName || "KMJ Optical";
    const msg = `*${shop}* 🕶\n\n${message}`;

    try {
      const res = await api.post("/api/whatsapp/broadcast", { numbers: phones, message: msg });
      if (res.success) {
        setProgress({ sent: res.data.sent, failed: res.data.failed, total: phones.length });
      } else {
        setProgress({ sent: 0, failed: phones.length, total: phones.length });
      }
    } catch {
      setProgress({ sent: 0, failed: phones.length, total: phones.length });
    } finally {
      setSending(false);
      setDone(true);
    }
  }

  const selectedCount = selectAll ? filtered.length : selected.size;
  const selectedPhones = getSelectedPhones();

  if (loading) return <PageSkeleton page="announcement" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Announcements</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Send WhatsApp messages to your customers automatically.
          </p>
        </div>
      </div>

      {/* WhatsApp Connection Status */}
      <div className={`card ${waConnected ? "border-emerald-200 dark:border-emerald-800" : ""}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              waConnected ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" :
              waConnected === false ? "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400" :
              "bg-gray-50 dark:bg-dark-700 text-gray-400"
            }`}>
              <Smartphone size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                WhatsApp {waConnected ? "Connected" : waConnected === false ? "Not Connected" : "Checking..."}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
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
        <div className="lg:col-span-1 card space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400">
              <MessageCircle size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Compose Message</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">WhatsApp broadcast</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Message</label>
            <textarea
              className="input-field resize-none"
              rows={8}
              placeholder="Type your announcement message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{message.length} characters</p>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
            <Users size={18} className="text-gray-400" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{customers.length} Total Customers</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedCount > 0 ? `${selectedCount} selected (${selectedPhones.length} with number)` : "No customers selected"}
              </p>
            </div>
          </div>

          {progress && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-dark-700">
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {sending ? "Sending..." : done ? "Complete" : ""}
              </p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={14} /> {progress.sent}
                </span>
                {progress.failed > 0 && (
                  <span className="text-red-600 dark:text-red-400 flex items-center gap-1">
                    <XCircle size={14} /> {progress.failed}
                  </span>
                )}
                <span className="text-gray-400">/ {progress.total}</span>
              </div>
            </div>
          )}

          <button
            onClick={() => setShowConfirm(true)}
            disabled={selectedCount === 0 || !message.trim() || sending || !waConnected}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <><Loader2 size={18} className="animate-spin" /> Sending...</>
            ) : (
              <><Send size={18} /> Send to {selectedCount > 0 ? `${selectedCount} customer${selectedCount > 1 ? "s" : ""}` : "Selected"}</>
            )}
          </button>

          {!waConnected && selectedCount > 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
              Connect WhatsApp in Settings to send messages
            </p>
          )}
        </div>

        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Customers</h3>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {filtered.length} of {customers.length}
            </span>
          </div>

          <div className="relative mb-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, mobile, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-dark-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {filtered.length > 0 && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 mb-2"
            >
              {selectAll ? <CheckSquare size={16} /> : <Square size={16} />}
              {selectAll ? "Deselect All" : "Select All"}
            </button>
          )}

          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No customers found</p>
              </div>
            ) : (
              filtered.map((c) => {
                const isSelected = selectAll || selected.has(c._id);
                const hasPhone = !!c.mobile?.replace(/\D/g, "");
                return (
                  <div
                    key={c._id}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                      isSelected ? "bg-primary-50 dark:bg-primary-900/20" : "hover:bg-gray-50 dark:hover:bg-dark-700"
                    }`}
                  >
                    <button onClick={() => toggleSelect(c._id)} className="flex-shrink-0 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                      {isSelected ? <CheckSquare size={18} className="text-primary-600 dark:text-primary-400" /> : <Square size={18} />}
                    </button>
                    <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-xs flex-shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name || "—"}</p>
                      <p className={`text-xs ${hasPhone ? "text-gray-400 dark:text-gray-500" : "text-red-400"}`}>
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
      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowConfirm(false)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirm Broadcast</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Send this message to <strong>{selectedPhones.length}</strong> customer{selectedPhones.length !== 1 ? "s" : ""}?
            </p>
            {selectedPhones.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-xs text-amber-700 dark:text-amber-300 mb-4">
                <p className="font-medium mb-1">Message preview:</p>
                <p className="truncate">{message.slice(0, 100)}{message.length > 100 ? "..." : ""}</p>
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary">Cancel</button>
              <button onClick={handleSend} className="btn-primary flex items-center gap-1.5">
                <Send size={16} /> Send Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

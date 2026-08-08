import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useDashboard } from "../hooks";
import PageSkeleton from "../components/PageSkeleton";
import CameraScanner from "../components/CameraScanner";
import { useToast } from "../context/ToastContext";
import { useTranslate } from "../context/TranslateContext";
import { useAuth } from "../context/AuthContext";
import { compactRx } from "../utils/rx";
import type { DashboardData, Order } from "../types";
import {
  Truck, ShoppingBag, ClipboardList, ScanLine, PackageCheck,
  Clock, Plus, ArrowUpRight, Send, Calendar, ChevronRight, X,
} from "lucide-react";

const v = <T,>(val: T | null | undefined, fallback: T | string = "—"): T | string => val ?? fallback;

const maskPhone = (p: string): string => {
  if (!p || p.length < 6) return v(p) as string;
  return p;
};

function formatTimeAgo(dateStr: string, t?: (en: string, hi: string) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t ? t("Just now", "अभी") : "Just now";
  if (mins < 60) return t ? `${mins}${t("m ago", " मिनट पहले")}` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t ? `${hrs}${t("h ago", " घंटे पहले")}` : `${hrs}h ago`;
  return t ? `${Math.floor(hrs / 24)}${t("d ago", " दिन पहले")}` : `${Math.floor(hrs / 24)}d ago`;
}

// Sub-components

function UserAvatar({ name, className = "" }: { name: string; className?: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className={`rounded-full bg-[#1ed760] flex items-center justify-center text-black font-bold flex-shrink-0 ${className}`}>
      {initial}
    </div>
  );
}

function SectionHeader({ title, count, action, actionLabel }: { title: string; count?: number; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-3 sm:mb-4">
      <div className="flex items-center gap-2 sm:gap-3">
        <h3 className="text-[17px] sm:text-[20px] font-bold text-th-text uppercase tracking-wider">{title}</h3>
        {count !== undefined && <span className="text-[13px] sm:text-[16px] font-medium text-th-secondary bg-th-elevated px-2 sm:px-2.5 py-0.5 rounded-lg">{count}</span>}
      </div>
      {action && (
        <button onClick={action} aria-label={actionLabel || "View all"} className="flex items-center gap-1 sm:gap-1.5 text-[13px] sm:text-[16px] font-bold text-[#1ed760] hover:text-[#1ed760] px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#1ed760]/10 uppercase tracking-wider transition-all active:scale-95">
          {actionLabel || "View all"}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Delivered: "bg-[#1ed760]/15 text-[#1ed760]",
    Ready: "bg-[#1db954]/15 text-[#1db954]",
    Ordered: "bg-[#6366f1]/15 text-[#a78bfa]",
    Draft: "bg-th-elevated text-th-secondary",
    "In Transit": "bg-[#f59e0b]/15 text-[#fbbf24]",
  };
  return (
    <span className={`text-[11px] sm:text-[13px] font-bold px-1.5 sm:px-2 py-0.5 rounded-md whitespace-nowrap uppercase tracking-wider flex-shrink-0 ${styles[status] || "bg-th-elevated text-th-secondary"}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-14 text-center px-4 sm:px-6">
      <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-lg sm:rounded-xl bg-th-elevated flex items-center justify-center mb-3 sm:mb-4">
        <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-th-muted" />
      </div>
      <p className="text-[16px] sm:text-[20px] font-semibold text-th-text">{title}</p>
      <p className="text-[14px] sm:text-[18px] text-th-secondary mt-1 mb-4 sm:mb-5 max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} aria-label={actionLabel} className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-lg text-[14px] sm:text-[18px] font-bold bg-[#1ed760] text-black hover:scale-105 transition-all active:scale-95 uppercase tracking-wider">
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SegmentedControl({ options, value, onChange, compact }: { options: { label: string; value: string; color?: string }[]; value: string; onChange: (v: string) => void; compact?: boolean }) {
  return (
    <div className={`flex rounded-lg bg-th-elevated gap-0.5 border border-th-border ${compact ? "p-0.5" : "p-1"}`}>
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button key={opt.value} onClick={(e) => { e.stopPropagation(); onChange(isActive ? "pending" : opt.value); }}
            aria-label={opt.label}
            className={`${compact ? "px-1.5 sm:px-2 py-0.5 sm:py-1 text-[11px] sm:text-[14px]" : "px-2.5 sm:px-3 py-1 sm:py-1.5 text-[13px] sm:text-[15px]"} rounded-md font-bold transition-all leading-tight uppercase tracking-wider ${isActive
              ? `${opt.color || "bg-[#1ed760] text-black"} shadow-sm`
              : "text-th-secondary hover:text-th-text hover:bg-th-card/50"
              }`}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Main Dashboard

export default function Dashboard() {
  const { dashboard, loading, refetch } = useDashboard();
  const [showScanner, setShowScanner] = useState(false);
  const [hasDataOnce, setHasDataOnce] = useState(false);
  const [deliveriesTab, setDeliveriesTab] = useState<"pending" | "today" | "delivered">("pending");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [sendingDemand, setSendingDemand] = useState<"buy" | "order" | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { uiT } = useTranslate();
  const { user, currentBranch } = useAuth();

  useEffect(() => { if (dashboard) setHasDataOnce(true); }, [dashboard]);

  const classifyEye = useCallback(async (id: string, eye: "right" | "left", status: string) => {
    const res = await api.patch(`/api/orders/${id}/classify-eye`, { eye, status });
    if (res.success) refetch();
  }, [refetch]);

  const toggleOrderSelection = useCallback((id: string) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAllOrders = useCallback((ids: string[]) => {
    setSelectedOrders((prev) => {
      if (prev.size === ids.length) return new Set();
      return new Set(ids);
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedOrders(new Set()), []);

  const sendDemand = useCallback(async (type: "buy" | "order") => {
    const selected = Array.from(selectedOrders);
    if (selected.length === 0) return;
    setSendingDemand(type);
    const res = await api.post("/api/orders/demand-send", { type, orderIds: selected });
    setSendingDemand(null);
    if (res.success) {
      const d = (res.data ?? res) as { sent?: boolean; waConnected?: boolean; queued?: boolean; sendError?: string };
      if (d.sent) {
        toast.success(type === "buy" ? "Purchase list sent to WhatsApp!" : "Lab order list sent to WhatsApp!");
      } else if (d.waConnected === false) {
        toast.error("WhatsApp not connected. Scan QR code on WhatsApp page.");
      } else if (d.queued) {
        toast.info(`${type === "buy" ? "Purchase" : "Lab Order"} list queued — will send when connected`);
      } else {
        toast.error(`PDF generated but send failed${d.sendError ? `: ${d.sendError}` : ""}`);
      }
    } else {
      toast.error(res.message || "Failed to send");
    }
  }, [selectedOrders, toast]);

  useEffect(() => {
    if (showScanner) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [showScanner]);

  if (loading && !hasDataOnce) return <PageSkeleton page="dashboard" />;
  if (!dashboard) return null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? uiT("Good morning", "शुभ प्रभात") : hour < 17 ? uiT("Good afternoon", "नमस्ते") : uiT("Good evening", "शुभ संध्या");
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  const d = dashboard;

  const draftOrders = d.incompleteOrders.filter((o) => o.status === "Draft");

  const totalStock = (ss: { shop?: number; warehouse?: number } | null | undefined) => (ss?.shop ?? 0) + (ss?.warehouse ?? 0);

  // Header

  const renderHeader = () => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-[20px] sm:text-[28px] font-bold text-th-text tracking-tight truncate">
          {greeting}, <span className="text-[#1ed760]">{"Mr " + (currentBranch?.settings?.ownerName || user?.name || user?.username || "")}</span>
        </h1>
        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1 text-[12px] sm:text-[15px] text-th-secondary">
          <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>{dateStr}</span>
          <span className="text-th-muted">·</span>
          <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>{timeStr}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        <button onClick={() => navigate("/workspace")} aria-label={uiT("New Sale", "नई बिक्री")}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 bg-[#1ed760] text-black rounded-lg text-[13px] sm:text-[15px] font-bold transition-all duration-200 active:scale-95 uppercase tracking-wider">
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {uiT("New Sale", "नई बिक्री")}
        </button>
        <button onClick={() => setShowScanner(true)} aria-label={uiT("Scan", "स्कैन")}
          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2.5 bg-th-elevated text-th-text rounded-lg text-[13px] sm:text-[15px] font-bold transition-all duration-200 active:scale-95 hover:bg-th-card uppercase tracking-wider">
          <ScanLine className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          {uiT("Scan", "स्कैन")}
        </button>
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1ed760] flex items-center justify-center text-black font-bold text-[11px] sm:text-xs flex-shrink-0">S</div>
      </div>
    </div>
  );

  // Lens Demand

  const renderLensDemand = () => {
    const allIds = draftOrders.map((o) => o._id);

    return (
      <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg h-full flex flex-col">
        <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-th-card">
    <div className="flex items-center justify-between mb-2 sm:mb-2.5">
            <div className="flex items-center gap-2 sm:gap-3">
              <h3 className="text-[17px] sm:text-[20px] font-bold text-th-text uppercase tracking-wider">{uiT("Lens Demand", "लेंस मांग")}</h3>
              <span className="text-[13px] sm:text-[16px] font-medium text-th-secondary bg-th-elevated px-2 sm:px-2.5 py-0.5 rounded-lg">{draftOrders.length}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {selectedOrders.size > 0 && (
                <span className="text-[13px] sm:text-[16px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg">{selectedOrders.size} {uiT("selected", "चयनित")}</span>
              )}
              <button onClick={() => sendDemand("buy")} disabled={sendingDemand !== null || selectedOrders.size === 0} aria-label={uiT("Buy lenses", "लेंस खरीदें")}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[13px] sm:text-[16px] font-bold text-[#f59e0b] bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 uppercase tracking-wider">
                <ShoppingBag className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {sendingDemand === "buy" ? "..." : uiT("Buy", "खरीदें")}
              </button>
              <button onClick={() => sendDemand("order")} disabled={sendingDemand !== null || selectedOrders.size === 0} aria-label={uiT("Order lenses", "लेंस ऑर्डर करें")}
                className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[13px] sm:text-[16px] font-bold text-[#6366f1] bg-[#6366f1]/10 hover:bg-[#6366f1]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 uppercase tracking-wider">
                <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                {sendingDemand === "order" ? "..." : uiT("Order", "ऑर्डर")}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-[13px] sm:text-[16px] font-medium text-th-secondary hover:text-th-text transition-colors">
            <input type="checkbox" checked={selectedOrders.size === draftOrders.length && draftOrders.length > 0}
              onChange={() => toggleAllOrders(allIds)}
              aria-label={uiT("Select all", "सभी चुनें")}
              className="w-3.5 h-3.5 rounded accent-[#1ed760]" />
            {uiT("Select all", "सभी चुनें")} ({draftOrders.length})
          </label>
        </div>

        {draftOrders.length === 0 ? (
          <EmptyState icon={PackageCheck} title={uiT("All clear!", "सब साफ!")} description={uiT("No draft orders pending lens classification.", "लेंस वर्गीकरण के लिए कोई ड्राफ्ट ऑर्डर लंबित नहीं।")} actionLabel={uiT("Create New Order", "नया ऑर्डर बनाएं")} onAction={() => navigate("/workspace")} />
        ) : (
          <div className="divide-y divide-th-border max-h-[440px] overflow-y-auto scrollbar-none">
            {draftOrders.map((o) => {
              const id = o._id;
              const custObj = typeof o.customerId === "object" && o.customerId ? o.customerId : null;
              const cName = custObj?.name ?? "";
              const cMobile = custObj?.mobile ?? "";
              const isSelected = selectedOrders.has(id);
              const rx = o.prescription;
              const rightEye = rx?.rightEye;
              const leftEye = rx?.leftEye;
              const rDV = rightEye?.dv;
              const lDV = leftEye?.dv;
              const rNV = rightEye?.nv;
              const lNV = leftEye?.nv;
              const rStatus = o.rightLensStatus || "pending";
              const lStatus = o.leftLensStatus || "pending";
              const rRx = compactRx(rDV as Record<string, unknown> | undefined, rNV as Record<string, unknown> | undefined);
              const lRx = compactRx(lDV as Record<string, unknown> | undefined, lNV as Record<string, unknown> | undefined);
              const stockTotal = totalStock(o.stockStatus?.lensBrand ?? null);
              const inStock = stockTotal > 0;

              const goToCustomer = (e?: React.MouseEvent) => {
                e?.stopPropagation();
                const cId = custObj?._id ?? null;
                if (cId) navigate(`/customers/${cId}?visitId=${o.visitId || ""}`);
              };

              return (
                <div key={id}
                  className={`px-3 sm:px-5 py-3 sm:py-4 transition-all duration-150 cursor-pointer group ${isSelected ? "bg-[#1ed760]/5 border-l-2 border-l-[#1ed760]" : "hover:bg-th-card border-l-2 border-l-transparent"}`}
                  onClick={goToCustomer}>

                  {/* Line 1: Avatar + Name + Meta */}
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOrderSelection(id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={cName || uiT("Select order", "ऑर्डर चुनें")}
                      className="w-4 h-4 rounded accent-[#1ed760] cursor-pointer flex-shrink-0" />
                    <div className="relative flex-shrink-0">
                      <UserAvatar name={cName} className="w-8 h-8 sm:w-10 sm:h-10 text-[10px] sm:text-xs" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-th-surface flex items-center justify-center">
                        <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-[#f59e0b]" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <p className="text-[15px] sm:text-[18px] font-bold text-th-text truncate">{cName || "—"}</p>
                        {!!(cMobile) && <span className="text-[13px] sm:text-[16px] text-th-muted hidden sm:inline">{maskPhone(cMobile)}</span>}
                        <span className="text-[13px] sm:text-[16px] text-th-muted hidden sm:inline">·</span>
                        <span className="text-[13px] sm:text-[16px] text-th-muted">{o.createdAt ? formatTimeAgo(o.createdAt, uiT) : ""}</span>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5 mt-0.5 flex-wrap">
                        {!!(o.frameBrand) && <span className="text-[13px] sm:text-[15px] text-th-secondary bg-th-elevated px-1.5 sm:px-2 py-0.5 rounded-md">{o.frameBrand?.trim()}</span>}
                        {!!(o.lensBrand) && <span className="text-[13px] sm:text-[15px] text-th-secondary bg-th-elevated px-1.5 sm:px-2 py-0.5 rounded-md">{o.lensBrand}</span>}
                        {!!(o.lensType) && <span className="text-[13px] sm:text-[15px] text-th-muted bg-th-elevated px-1.5 sm:px-2 py-0.5 rounded-md">{o.lensType}</span>}
                        {!!(o.lensIndex) && <span className="text-[13px] sm:text-[15px] text-th-muted bg-th-elevated px-1.5 sm:px-2 py-0.5 rounded-md">{o.lensIndex}</span>}
                      </div>
                    </div>
                    <button onClick={goToCustomer} aria-label={uiT("Open", "खोलें")}
                      className="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[13px] sm:text-[15px] font-bold bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-all active:scale-95 uppercase tracking-wider flex-shrink-0 opacity-0 group-hover:opacity-100">
                      {uiT("Open", "खोलें")} <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line 2 & 3: Eye classifiers */}
                  <div className=" mt-2 sm:mt-3 space-y-1.5 sm:space-y-2">
                    {/* R Eye */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#1ed760]/10 text-[#1ed760] text-[13px] sm:text-[15px] font-extrabold flex items-center justify-center flex-shrink-0">R</span>
                      <span className="text-[14px] sm:text-[17px] font-mono font-semibold text-th-text min-w-[80px] sm:min-w-[120px] truncate">{rRx || uiT("plain", "plain")}</span>
                      {inStock ? (
                        <span className="ml-auto text-[11px] sm:text-[14px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0">
                          {uiT("In Stock", "स्टॉक में")}
                        </span>
                      ) : (
                        <span className="ml-auto text-[11px] sm:text-[14px] font-bold text-[#e74c3c] bg-[#e74c3c]/10 px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0">
                          {uiT("Out", "बाहर")}
                        </span>
                      )}

                      <SegmentedControl
                        compact
                        options={[
                          { label: uiT("Stock", "स्टॉक"), value: "stock", color: "bg-[#1ed760] text-black " },
                          { label: uiT("Buy", "खरೀदें"), value: "buy", color: "bg-[#f59e0b] text-black" },
                          { label: uiT("Order", "ऑर्डर"), value: "order", color: "bg-[#6366f1] text-white" },
                        ]}
                        value={rStatus}
                        onChange={(s) => classifyEye(id, "right", s)}
                      />
                    </div>
                    {/* L Eye */}
                    <div className="flex items-center gap-2 sm:gap-3">
                      {/* Left Side: Icon and Label */}
                      <span className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#f59e0b]/10 text-[#f59e0b] text-[13px] sm:text-[15px] font-extrabold flex items-center justify-center flex-shrink-0">
                        L
                      </span>
                      <span className="text-[14px] sm:text-[17px] font-mono font-semibold text-th-text min-w-[80px] sm:min-w-[120px] truncate">
                        {lRx || "—"}
                      </span>

                      {/* Right Side: Status Badge and Segmented Control */}
                      {/* Adding 'ml-auto' pushes this element and everything after it to the right */}
                      {inStock ? (
                        <span className="ml-auto text-[11px] sm:text-[14px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0">
                          {uiT("In Stock", "स्टॉक में")}
                        </span>
                      ) : (
                        <span className="ml-auto text-[11px] sm:text-[14px] font-bold text-[#e74c3c] bg-[#e74c3c]/10 px-1 sm:px-1.5 py-0.5 rounded flex-shrink-0">
                          {uiT("Out", "बाहर")}
                        </span>
                      )}

                      <SegmentedControl
                        compact
                        options={[
                          { label: uiT("Stock", "स्टॉक"), value: "stock", color: "bg-[#1ed760] text-black " },
                          { label: uiT("Buy", "खरೀदें"), value: "buy", color: "bg-[#f59e0b] text-black" },
                          { label: uiT("Order", "ऑर्डर"), value: "order", color: "bg-[#6366f1] text-white" },
                        ]}
                        value={lStatus}
                        onChange={(s) => classifyEye(id, "left", s)}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // Recent Orders

  const renderRecentOrders = () => (
    <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg h-full flex flex-col">
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-th-border">
        <SectionHeader title={uiT("Today's Orders", "आज के ऑर्डर")} count={d.todayOrders} action={() => navigate("/orders")} actionLabel={uiT("View all", "सभी देखें")} />
      </div>
      <div className="divide-y divide-th-border max-h-[465px] overflow-y-auto scrollbar-none flex-1">
        {d.recentOrders.length === 0 ? (
          <EmptyState icon={ClipboardList} title={uiT("No orders today", "आज कोई ऑर्डर नहीं")} description={uiT("Today's orders will appear here.", "आज के ऑर्डर यहां दिखाई देंगे।")} actionLabel={uiT("New Order", "नया ऑर्डर")} onAction={() => navigate("/workspace")} />
        ) : d.recentOrders.map((o, idx) => {
          const custObj = typeof o.customerId === "object" && o.customerId ? o.customerId : null;
          const cName = custObj?.name ?? "—";
          const cMobile = custObj?.mobile ?? "";
          const rx = (o as any).prescription;
          const rxParts: string[] = [];
          if (rx?.rightEye?.dv) {
            const r = rx.rightEye.dv;
            const parts = [r.sph != null ? `SPH ${r.sph}` : "", r.cyl != null ? `CYL ${r.cyl}` : "", r.axis != null ? `AX ${r.axis}` : ""].filter(Boolean);
            if (parts.length) rxParts.push(`R: ${parts.join(" ")}`);
          }
          if (rx?.leftEye?.dv) {
            const l = rx.leftEye.dv;
            const parts = [l.sph != null ? `SPH ${l.sph}` : "", l.cyl != null ? `CYL ${l.cyl}` : "", l.axis != null ? `AX ${l.axis}` : ""].filter(Boolean);
            if (parts.length) rxParts.push(`L: ${parts.join(" ")}`);
          }
          return (
            <div key={o._id || idx} className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-5 py-3 sm:py-3.5 hover:bg-th-card transition-all cursor-pointer" onClick={() => navigate(`/workspace?order=${o._id}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/workspace?order=${o._id}`)}>
              <div className="relative flex-shrink-0">
                <UserAvatar name={cName} className="w-8 h-8 sm:w-10 sm:h-10 text-[10px] sm:text-sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-th-surface flex items-center justify-center">
                  <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${o.status === "Delivered" ? "bg-[#1ed760]" : o.status === "Draft" ? "bg-th-muted" : o.status === "Ordered" ? "bg-[#a78bfa]" : o.status === "Ready" ? "bg-[#3498db]" : "bg-[#f59e0b]"}`} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] sm:text-[17px] font-semibold text-th-text truncate">{cName}</p>
                <p className="text-[12px] sm:text-[14px] text-th-secondary mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                  {o.createdAt ? formatTimeAgo(o.createdAt, uiT) : ""}
                  {!!(o.frameBrand) ? ` · ${o.frameBrand}` : ""}
                  {!!(o.lensBrand) ? ` · ${o.lensBrand}` : ""}
                </p>
                {rxParts.length > 0 && (
                  <p className="text-[11px] sm:text-[12px] text-[#1ed760] font-medium mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                    {rxParts.join(" · ")}
                  </p>
                )}
              </div>
              <StatusBadge status={o.status || "—"} />
            </div>
          );
        })}
      </div>
    </div>
  );

  // Deliveries (tabbed: Pending / Today / Delivered)

  const renderDeliveries = () => {
    const pendingList = d.pendingDeliveries || [];
    const todayList = d.todayDeliveries;
    const deliveredList = d.todayDeliveredOrders || [];
    const tab = deliveriesTab;
    const list = tab === "pending" ? pendingList : tab === "today" ? todayList : deliveredList;

    const emptyState = {
      pending: {
        icon: PackageCheck,
        title: uiT("No pending deliveries", "कोई लंबित डिलीवरी नहीं"),
        desc: uiT("All orders are delivered or cancelled.", "सभी ऑर्डर डिलीवर या रद्द हो गए हैं।"),
      },
      today: {
        icon: Truck,
        title: uiT("No deliveries today", "आज कोई डिलीवरी नहीं"),
        desc: uiT("All deliveries for today are completed.", "आज की सभी डिलीवरी पूर्ण हो गई हैं।"),
      },
      delivered: {
        icon: PackageCheck,
        title: uiT("Nothing delivered today", "आज कुछ भी डिलीवर नहीं हुआ"),
        desc: uiT("Delivered orders will appear here.", "डिलीवर ऑर्डर यहां दिखाई देंगे।"),
      },
    }[tab];

    const renderRow = (item: Order, idx: number) => {
      const custObj = typeof item.customerId === "object" && item.customerId ? item.customerId : null;
      const cName = custObj?.name ?? "—";
      const cMobile = custObj?.mobile ?? "";

      if (tab === "delivered") {
        const o = item;
        return (
          <div key={o._id || idx} className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-th-card transition-all cursor-pointer" onClick={() => navigate(`/customers/${custObj?._id ?? ""}?visitId=${o.visitId || ""}`)}>
            <div className="relative flex-shrink-0">
              <UserAvatar name={cName} className="w-8 h-8 sm:w-10 sm:h-10 text-[10px] sm:text-sm" />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-th-surface flex items-center justify-center">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#1ed760]" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] sm:text-[17px] font-semibold text-th-text truncate">{cName}</p>
              <p className="text-[12px] sm:text-[14px] text-th-secondary mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
                {!!(o.frameBrand) ? o.frameBrand : ""}
                {!!(o.frameBrand) && !!(o.lensBrand) ? " · " : ""}
                {!!(o.lensBrand) ? o.lensBrand : ""}
                {!o.frameBrand && !o.lensBrand ? (o.createdAt ? formatTimeAgo(o.createdAt, uiT) : "") : ""}
              </p>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <span className="text-[14px] sm:text-[17px] font-bold text-th-text whitespace-nowrap">₹{(o.billInfo?.totalAmount ?? 0).toLocaleString()}</span>
              <StatusBadge status="Delivered" />
            </div>
          </div>
        );
      }

      const due = tab === "pending" ? item.deliveryDate : undefined;
      return (
        <div key={item._id || idx} className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 hover:bg-th-card transition-all">
          <div className="relative flex-shrink-0">
            <UserAvatar name={cName} className="w-8 h-8 sm:w-10 sm:h-10 text-[10px] sm:text-sm" />
            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-th-surface flex items-center justify-center">
              <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${String(item.status) === "In Transit" ? "bg-[#f59e0b]" : item.status === "Ready" ? "bg-[#3498db]" : item.status === "Delivered" ? "bg-[#1ed760]" : item.status === "Ordered" ? "bg-[#a78bfa]" : "bg-[#e74c3c]"}`} />
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] sm:text-[17px] font-semibold text-th-text truncate">{cName}</p>
            <p className="text-[12px] sm:text-[14px] text-th-secondary mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
              {!!(cMobile) ? maskPhone(cMobile) : ""}
              {!!(cMobile) && due ? " · " : ""}
              {due ? uiT("Due", "तिथि") + " " + new Date(due).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <StatusBadge status={item.status || "—"} />
            <button onClick={() => navigate(`/delivery?order=${item._id}`)} aria-label={uiT("Deliver", "डिलीवर")}
              className="p-1.5 sm:p-2 rounded-lg text-[14px] sm:text-[16px] font-bold bg-[#1ed760]/10 text-[#1ed760] hover:bg-[#1ed760]/20 transition-all duration-200 active:scale-95">
              <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      );
    };

    const tabs = [
      { label: uiT("Pending", "बाकी"), value: "pending" as const, count: pendingList.length },
      { label: uiT("Today", "आज"), value: "today" as const, count: todayList.length },
      { label: uiT("Delivered", "डिलीवर"), value: "delivered" as const, count: deliveredList.length },
    ];

    return (
      <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg border border-th-border flex flex-col h-full">
        <div className="px-3 sm:px-5 pt-3 sm:pt-3.5 pb-0 border-b border-th-card">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-2.5">
            <h3 className="text-[16px] sm:text-[18px] font-bold text-th-text uppercase tracking-wider flex items-center gap-2">
              <Truck className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-[#2dd4bf]" />
              {uiT("Deliveries", "डिलीवरी")}
            </h3>
            <div className="flex items-center gap-1 sm:gap-1.5">
              {tabs.map((t) => (
                <button key={t.value} onClick={() => setDeliveriesTab(t.value)} aria-label={t.label}
                  className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-[13px] font-bold uppercase tracking-wider transition-all active:scale-95 flex items-center gap-1 ${deliveriesTab === t.value
                    ? "bg-[#1ed760] text-black shadow-sm"
                    : "bg-th-elevated text-th-secondary hover:text-th-text hover:bg-th-card"}`}>
                  {t.label}
                  <span className={`px-1.5 rounded-md text-[10px] sm:text-[11px] ${deliveriesTab === t.value ? "bg-black/20" : "bg-th-card"}`}>{t.count}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end pb-2 sm:pb-2.5">
            <button onClick={() => navigate("/delivery")} aria-label={uiT("View all", "सभी देखें")}
              className="flex items-center gap-1 text-[12px] sm:text-[13px] font-bold text-[#1ed760] hover:text-[#1ed760] px-2 py-1 rounded-lg bg-[#1ed760]/10 uppercase tracking-wider transition-all active:scale-95">
              {uiT("View all", "सभी देखें")}
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="divide-y divide-th-card max-h-[380px] overflow-y-auto scrollbar-none flex-1">
          {list.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 sm:py-8 text-center px-4">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-th-elevated flex items-center justify-center mb-2">
                <emptyState.icon className="w-4 h-4 sm:w-5 sm:h-5 text-th-muted" />
              </div>
              <p className="text-[14px] sm:text-[16px] font-semibold text-th-text">{emptyState.title}</p>
              <p className="text-[12px] sm:text-[13px] text-th-secondary mt-0.5 max-w-xs">{emptyState.desc}</p>
            </div>
          ) : list.map((item, idx) => renderRow(item, idx))}
        </div>
      </div>
    );
  };

  // Main Render

  return (
    <div className="bg-th-base min-h-screen" role="main">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 px-3 sm:px-4 md:px-6 py-3 sm:py-5 md:py-6">
        {renderHeader()}

        {/* Deliveries */}
        {renderDeliveries()}

        {/* Lens Demand + Today's Orders side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {renderLensDemand()}
          {renderRecentOrders()}
        </div>
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowScanner(false)}>
          <div className="relative w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowScanner(false)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-th-card flex items-center justify-center text-th-secondary hover:text-th-text z-10 transition-all active:scale-95" aria-label="Close scanner">
              <X className="w-4 h-4" />
            </button>
            <CameraScanner
              onScan={(code) => {
                setShowScanner(false);
                navigate(`/inventory/scan/${encodeURIComponent(code)}`);
              }}
              onClose={() => setShowScanner(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

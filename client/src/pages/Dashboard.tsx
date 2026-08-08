import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApi, useDashboard } from "../hooks";
import PageSkeleton from "../components/PageSkeleton";
import ShineCard from "../components/ShineCard";
import CameraScanner from "../components/CameraScanner";
import { SalesTrendChart, OrderStatusDonut, PaymentModeBarChart, SalesVsCollectionChart, WeeklyOrdersChart, CategoryPieChart } from "../components/DashboardCharts";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import { useTranslate } from "../context/TranslateContext";
import { useAuth } from "../context/AuthContext";
import { formatFullRx, compactRx } from "../utils/rx";
import type { DashboardData, Customer, Order, Bill, Todo } from "../types";
import {
  Users, Package, Wallet, Receipt, Truck, ShoppingBag, ClipboardList,
  TrendingUp, IndianRupee, ScanLine, Boxes, PackageCheck,
  Clock, Activity, Plus, Check, Trash2, ArrowUpRight, UserPlus, FileText,
  BarChart3, AlertTriangle, AlertCircle, CreditCard, Smartphone, Building2,
  X, ChevronRight, ShoppingCart, CheckSquare, Send, Eye, MessageSquare,
  Calendar, LayoutDashboard, Warehouse, Pencil, Save,
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

const paymentModeIcon: Record<string, typeof CreditCard> = {
  Cash: IndianRupee, UPI: Smartphone, Card: CreditCard, "Bank Transfer": Building2,
  "नकद": IndianRupee, "कार्ड": CreditCard, "बैंक": Building2, "बीमा": Building2, Insurance: Building2,
};

const paymentModeColors: Record<string, string> = {
  Cash: "#10b981", UPI: "#6366f1", Card: "#f59e0b", "Bank Transfer": "#06b6d4",
  "नकद": "#10b981", "कार्ड": "#f59e0b", "बैंक": "#06b6d4", "बीमा": "#8b5cf6", Insurance: "#8b5cf6",
};

// Sub-components

function UserAvatar({ name, className = "" }: { name: string; className?: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className={`rounded-full bg-[#1ed760] flex items-center justify-center text-black font-bold flex-shrink-0 ${className}`}>
      {initial}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, trend, subtitle }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; trend?: string; subtitle?: string }) {
  return (
    <ShineCard className="flex flex-col items-center text-center bg-th-surface rounded-xl px-2 sm:px-3 py-3 sm:py-4 h-full active:scale-95 shadow-md cursor-default">
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 mb-1.5 sm:mb-2.5" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color }} />
      </div>
      <span className="text-base sm:text-lg font-bold text-th-text tracking-tight leading-tight" style={{ color }}>{value}</span>
      {trend && (
        <span className="inline-flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-1 sm:px-1.5 py-0.5 rounded-md mt-0.5 sm:mt-1 whitespace-nowrap">
          <TrendingUp className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
          {trend}
        </span>
      )}
      <p className="text-[11px] sm:text-[12px] font-semibold text-th-secondary mt-1 sm:mt-1.5 leading-tight line-clamp-2">{label}</p>
      {subtitle && <p className="text-[10px] sm:text-[11px] text-th-muted mt-0.5 leading-tight line-clamp-1">{subtitle}</p>}
    </ShineCard>
  );
}

function QuickActionCard({ icon: Icon, label, subtitle, onClick, color }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; subtitle: string; onClick: () => void; color?: string }) {
  return (
    <ShineCard onClick={onClick} aria-label={label} className="h-[62px] sm:h-[70px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 bg-th-surface rounded-lg p-1.5 sm:p-2 w-full group active:scale-95 hover:bg-th-card shadow-md hover:shadow-lg cursor-pointer">
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg flex items-center justify-center transition-transform duration-200" style={{ backgroundColor: `${color || "#1ed760"}15` }}>
        <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: color || "#1ed760" }} />
      </div>
      <span className="text-[13px] sm:text-[15px] font-semibold text-th-text truncate max-w-full leading-tight uppercase tracking-wider">{label}</span>
      <span className="text-[11px] sm:text-[14px] text-th-secondary truncate max-w-full leading-tight hidden sm:block">{subtitle}</span>
    </ShineCard>
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

function AlertCard({ icon: Icon, label, value, action, actionLabel, color, onClick }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string | number; action?: () => void; actionLabel?: string; color: string; onClick?: () => void }) {
  const bgMap: Record<string, string> = {
    red: "bg-[#e74c3c]/10",
    orange: "bg-[#f39c12]/10",
    yellow: "bg-[#f1c40f]/10",
    blue: "bg-[#3498db]/10",
  };
  const textMap: Record<string, string> = {
    red: "text-[#e74c3c]",
    orange: "text-[#f39c12]",
    yellow: "text-[#f1c40f]",
    blue: "text-[#3498db]",
  };
  const iconMap: Record<string, string> = {
    red: "text-[#e74c3c]",
    orange: "text-[#f39c12]",
    yellow: "text-[#f1c40f]",
    blue: "text-[#3498db]",
  };
  return (
    <ShineCard className={`relative ${bgMap[color] || bgMap.blue} rounded-lg p-3 sm:p-4 active:scale-95 shadow-md hover:shadow-lg w-full h-full ${onClick ? "cursor-pointer hover:bg-th-card" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}>
      <div className="flex items-center gap-2.5 sm:gap-3 h-full">
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${bgMap[color] || bgMap.blue}`}>
          <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${iconMap[color] || iconMap.blue}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[14px] sm:text-[17px] font-medium ${textMap[color] || textMap.blue} uppercase tracking-wider leading-tight truncate`}>{label}</p>
          <p className={`text-lg sm:text-xl font-bold ${textMap[color] || textMap.blue} mt-0.5 leading-tight`}>{value}</p>
        </div>
        {action && (
          <button onClick={(e) => { e.stopPropagation(); action(); }} aria-label={actionLabel || "View"} className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[13px] sm:text-[16px] font-bold transition-all active:scale-95 ${textMap[color] || textMap.blue} bg-th-card hover:bg-th-elevated uppercase tracking-wider flex-shrink-0 whitespace-nowrap`}>
            {actionLabel || "View"}
          </button>
        )}
      </div>
    </ShineCard>
  );
}

// Main Dashboard

function AutoGrowTextarea({ value, onChange, className = "", ...rest }: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      rows={1}
      onChange={(e) => onChange(e.target.value)}
      className={`${className} resize-none overflow-y-auto scrollbar-none caret-[#1ed760]`}
      {...rest}
    />
  );
}

export default function Dashboard() {
  const { dashboard, loading, error, refetch } = useDashboard();
  const { data: todosData, refetch: refetchTodos } = useApi<Todo[]>(
    () => api.get<Todo[]>("/api/workspace/todos"),
    [],
    { cacheKey: "/api/workspace/todos" }
  );
  const [todos, setTodos] = useState<Todo[]>([]);
  useEffect(() => { setTodos(todosData || []); }, [todosData]);
  const [newTodo, setNewTodo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [hasDataOnce, setHasDataOnce] = useState(false);
  const [deliveriesTab, setDeliveriesTab] = useState<"pending" | "today" | "delivered">("pending");
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [sendingDemand, setSendingDemand] = useState<"buy" | "order" | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { dark, toggle } = useTheme();
  const { uiT } = useTranslate();
  const { user, currentBranch, isStaff } = useAuth();

  useEffect(() => { if (dashboard) setHasDataOnce(true); }, [dashboard]);

  const splitTodoText = useCallback((text: string) => {
    const firstLineEnd = text.indexOf("\n");
    const task = (firstLineEnd === -1 ? text : text.slice(0, firstLineEnd)).trim();
    const notes = (firstLineEnd === -1 ? "" : text.slice(firstLineEnd + 1)).trim();
    return { task, notes };
  }, []);

  const addTodo = useCallback(async () => {
    const { task, notes } = splitTodoText(newTodo);
    if (!task) return;
    const temp: Todo = { _id: `tmp-${Date.now()}`, task, notes, done: false, createdAt: new Date().toISOString() };
    setTodos((prev) => [temp, ...prev]);
    setNewTodo("");
    const res = await api.post<Todo>("/api/workspace/todos", { task, notes: notes || undefined });
    if (res.success && res.data) {
      setTodos((prev) => prev.map((t) => (t._id === temp._id ? res.data! : t)));
      refetchTodos();
    } else {
      setTodos((prev) => prev.filter((t) => t._id !== temp._id));
      toast.error(res.message || "Failed to add task");
    }
  }, [newTodo, splitTodoText, refetchTodos, toast]);

  const toggleTodo = useCallback(async (id: string, done: boolean) => {
    const prev = todos.find((t) => t._id === id);
    if (!prev) return;
    const nextDone = !done;
    setTodos((p) => p.map((t) => (t._id === id ? { ...t, done: nextDone } : t)));
    const res = await api.patch(`/api/workspace/todos/${id}`, { done: nextDone });
    if (res.success) {
      refetchTodos();
    } else {
      setTodos((p) => p.map((t) => (t._id === id ? prev : t)));
      toast.error(res.message || "Failed to update task");
    }
  }, [todos, refetchTodos, toast]);

  const deleteTodo = useCallback(async (id: string) => {
    const prev = todos.find((t) => t._id === id);
    if (!prev) return;
    setTodos((p) => p.filter((t) => t._id !== id));
    const res = await api.del(`/api/workspace/todos/${id}`);
    if (res.success) {
      refetchTodos();
    } else {
      setTodos((p) => [prev, ...p]);
      toast.error(res.message || "Failed to delete task");
    }
  }, [todos, refetchTodos, toast]);

  const startEdit = useCallback((t: Todo) => {
    setEditingId(t._id);
    setEditText(t.notes ? `${t.task}\n${t.notes}` : t.task);
  }, []);

  const saveEdit = useCallback(async (id: string) => {
    const prev = todos.find((t) => t._id === id);
    setEditingId(null);
    if (!prev) return;
    const { task, notes } = splitTodoText(editText);
    if (!task) { toast.error("Task text is required"); setEditText(prev.notes ? `${prev.task}\n${prev.notes}` : prev.task); return; }
    const updated: Todo = { ...prev, task, notes };
    setTodos((p) => p.map((t) => (t._id === id ? updated : t)));
    const res = await api.patch<Todo>(`/api/workspace/todos/${id}`, { task, notes: notes || undefined });
    if (res.success) {
      refetchTodos();
    } else {
      setTodos((p) => p.map((t) => (t._id === id ? prev : t)));
      toast.error(res.message || "Failed to save task");
    }
  }, [todos, editText, splitTodoText, refetchTodos, toast]);

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
  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

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

  // Hero Section

  const renderHero = () => (
    <div className="bg-th-surface rounded-xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-lg border border-th-border">
      <div className="flex items-center justify-between gap-3 sm:gap-4 flex-wrap">
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          <div>
            <p className="text-[11px] sm:text-[15px] font-bold text-th-muted uppercase tracking-widest">{uiT("Today's Sales", "आज की बिक्री")}</p>
            <p className="text-[20px] sm:text-[26px] font-bold text-th-text tracking-tight">₹{(d.todaySales || 0).toLocaleString()}</p>
          </div>
          <div className="w-px h-6 sm:h-8 bg-th-border hidden sm:block" />
          <div>
            <p className="text-[11px] sm:text-[15px] font-bold text-th-muted uppercase tracking-widest">{uiT("Collection", "संग्रह")}</p>
            <p className="text-[20px] sm:text-[26px] font-bold text-th-text tracking-tight">₹{(d.todayCollection || 0).toLocaleString()}</p>
          </div>
          <div className="w-px h-6 sm:h-8 bg-th-border hidden sm:block" />
          <div>
            <p className="text-[11px] sm:text-[15px] font-bold text-th-muted uppercase tracking-widest">{uiT("Orders", "ऑर्डर")}</p>
            <p className="text-[20px] sm:text-[26px] font-bold text-th-text tracking-tight">{d.todayOrders}</p>
          </div>
          <div className="w-px h-6 sm:h-8 bg-th-border hidden sm:block" />
          <div>
            <p className="text-[11px] sm:text-[15px] font-bold text-th-muted uppercase tracking-widest">{uiT("Pending", "बाकी")}</p>
            <p className="text-[20px] sm:text-[26px] font-bold text-th-text tracking-tight">{d.pendingBills.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[12px] sm:text-[16px] text-th-muted">
          <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#1ed760]" />
          {d.salesTrend === "N/A" ? "NEW" : `${Number(d.salesTrend) >= 0 ? "+" : ""}${d.salesTrend}%`} {uiT("vs last week", "पिछले सप्ताह")}
        </div>
      </div>
    </div>
  );

  // Quick Actions

  const renderQuickActions = () => (
    <div>
      <SectionHeader title={uiT("Quick Actions", "त्वरित कार्य")} />
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-1.5 sm:gap-2">
        <QuickActionCard icon={ShoppingCart} label={uiT("New Sale", "नई बिक्री")} subtitle={uiT("Create a new order", "नया ऑर्डर बनाएं")} onClick={() => navigate("/workspace")} color="#6366f1" />
        <QuickActionCard icon={UserPlus} label={uiT("Customers", "ग्राहक")} subtitle={uiT("Manage your clients", "अपने ग्राहकों का प्रबंधन करें")} onClick={() => navigate("/customers")} color="#10b981" />
        <QuickActionCard icon={Boxes} label={uiT("Inventory", "इन्वेंट्री")} subtitle={uiT("Track stock & lenses", "स्टॉक और लेंस ट्रैक करें")} onClick={() => navigate("/inventory")} color="#f59e0b" />
        <QuickActionCard icon={BarChart3} label={uiT("Reports", "रिपोर्ट")} subtitle={uiT("View business insights", "व्यापार जानकारी देखें")} onClick={() => navigate("/reports")} color="#8b5cf6" />
        <QuickActionCard icon={Receipt} label={uiT("Bills", "बिल")} subtitle={uiT("Manage pending payments", "लंबित भुगतान प्रबंधित करें")} onClick={() => navigate("/bills")} color="#ef4444" />
        <QuickActionCard icon={ClipboardList} label={uiT("Orders", "ऑर्डर")} subtitle={uiT("View all orders", "सभी ऑर्डर देखें")} onClick={() => navigate("/orders")} color="#06b6d4" />
        <QuickActionCard icon={ScanLine} label={uiT("Scanner", "स्कैनर")} subtitle={uiT("Scan product barcodes", "उत्पाद बारकोड स्कैन करें")} onClick={() => setShowScanner(true)} color="#f97316" />
        <QuickActionCard icon={MessageSquare} label="WhatsApp" subtitle={uiT("Send messages & PDFs", "संदेश और PDF भेजें")} onClick={() => navigate("/whatsapp")} color="#22c55e" />
        <QuickActionCard icon={Warehouse} label={uiT("Warehouse", "वेयरहाउस")} subtitle={uiT("Manage central stock", "केंद्रीय स्टॉक प्रबंधित करें")} onClick={() => window.open("https://kmj-m9aq.onrender.com/#/", "_blank", "noopener,noreferrer")} color="#0ea5e9" />
      </div>
    </div>
  );

  // KPI Metrics

  const renderKPIs = () => (
    <div>
      <SectionHeader title={uiT("Key Metrics", "मुख्य मापदंड")} />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 sm:gap-3">
        <MetricCard label={uiT("Today's Sales", "आज की बिक्री")} value={`₹${(d.todaySales || 0).toLocaleString()}`} icon={IndianRupee} color="#10b981" trend={d.salesTrend === "N/A" ? "NEW" : `${Number(d.salesTrend) >= 0 ? "+" : ""}${d.salesTrend}%`} subtitle={uiT("vs last week", "पिछले सप्ताह की तुलना में")} />
        <MetricCard label={uiT("Today's Collection", "आज का संग्रह")} value={`₹${(d.todayCollection || 0).toLocaleString()}`} icon={IndianRupee} color="#6366f1" subtitle={uiT("today", "आज")} />
        <MetricCard label={uiT("Today's Orders", "आज के ऑर्डर")} value={d.todayOrders} icon={ShoppingBag} color="#8b5cf6" subtitle={d.weekOrders ? `${d.weekOrders} ${uiT("this week", "इस सप्ताह")}` : undefined} />
        <MetricCard label={uiT("Pending Bill Amount", "लंबित बिल राशि")} value={d.pendingBills.length} icon={Receipt} color="#ef4444" subtitle={`₹${(d.pendingPayments || 0).toLocaleString()} due`} />
        <MetricCard label={uiT("Ready for Pickup", "पिकअप के लिए तैयार")} value={d.readyDeliveries ?? 0} icon={PackageCheck} color="#06b6d4" subtitle={uiT("awaiting collection", "संग्रह की प्रतीक्षा में")} />
        <MetricCard label={uiT("New Customers", "नए ग्राहक")} value={d.newCustomersToday ?? 0} icon={Users} color="#10b981" subtitle={uiT("joined today", "आज जुड़े")} />
        <MetricCard label={uiT("Low Stock Items", "कम स्टॉक आइटम")} value={d.lowStock ?? 0} icon={AlertTriangle} color="#f59e0b" subtitle={uiT("items need restock", "आइटम को रीस्टॉक की आवश्यकता")} />
        <MetricCard label={uiT("Total Inventory", "कुल इन्वेंट्री")} value={d.counts.inventory} icon={Boxes} color="#f472b6" subtitle={uiT("total SKUs", "कुल SKU")} />
      </div>
    </div>
  );

  // Charts

  const renderCharts = () => {
    const hasSales = d.dailySales && d.dailySales.length > 0;
    const hasOrders = d.orderStatusCounts && d.orderStatusCounts.length > 0;
    const hasPayments = d.paymentModeSplit && d.paymentModeSplit.length > 0;
    const hasCollections = d.dailyCollections && d.dailyCollections.length > 0;
    const hasOrdersTrend = d.weeklyOrderTrend && d.weeklyOrderTrend.length > 0;
    const hasCategories = d.categoryBreakdown && d.categoryBreakdown.length > 0;

    if (!hasSales && !hasOrders && !hasPayments) return null;

    return (
      <div className="space-y-4 sm:space-y-5">
        {/* Row 1: Sales Trend (large) + Order Status Donut */}
        {(hasSales || hasOrders) && (
          <div>
            <SectionHeader title={uiT("Analytics Overview", "विश्लेषण अवलोकन")} />
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
              {hasSales && (
                <div className="lg:col-span-3">
                  <SalesTrendChart data={d.dailySales || []} dark={dark} />
                </div>
              )}
              {hasOrders && (
                <div className={hasSales ? "lg:col-span-2" : "lg:col-span-5"}>
                  <OrderStatusDonut data={d.orderStatusCounts || []} dark={dark} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Row 2: Sales vs Collection + Payment Modes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {hasSales && hasCollections && (
            <div className={(hasSales && hasCollections && hasPayments) ? "" : "md:col-span-2"}>
              <SalesVsCollectionChart
                salesData={d.dailySales || []}
                collectionData={d.dailyCollections || []}
                dark={dark}
              />
            </div>
          )}
          {hasPayments && (
            <div className={(hasSales && hasCollections && hasPayments) ? "" : "md:col-span-2"}>
              <PaymentModeBarChart data={d.paymentModeSplit || []} dark={dark} />
            </div>
          )}
        </div>

        {/* Row 3: Daily Orders + Inventory Category Breakdown */}
        {(hasOrdersTrend || hasCategories) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
            {hasOrdersTrend && (
              <div className={hasCategories ? "" : "md:col-span-2"}>
                <WeeklyOrdersChart data={d.weeklyOrderTrend || []} dark={dark} />
              </div>
            )}
            {hasCategories && (
              <div className={hasOrdersTrend ? "" : "md:col-span-2"}>
                <CategoryPieChart data={d.categoryBreakdown || []} dark={dark} />
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Needs Attention

  const renderNeedsAttention = () => {
    interface AlertItem { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string | number; color: string; action?: () => void; actionLabel?: string; onClick?: () => void }
    const items: AlertItem[] = [];
    if (d.pendingBills.length > 0) items.push({ icon: AlertCircle, label: uiT("Pending Bill Amount", "लंबित बिल राशि"), value: d.pendingBills.length, color: "red", action: () => navigate("/bills"), actionLabel: uiT("Collect", "वसूलें"), onClick: () => navigate("/bills") });
    if ((d.lowStock ?? 0) > 0) items.push({ icon: AlertTriangle, label: uiT("Low Stock Items", "कम स्टॉक आइटम"), value: d.lowStock ?? 0, color: "orange", action: () => navigate("/inventory"), actionLabel: "Restock", onClick: () => navigate("/inventory") });
    if (draftOrders.length > 0) items.push({ icon: FileText, label: uiT("Draft Orders", "ड्राफ्ट ऑर्डर"), value: draftOrders.length, color: "yellow", action: undefined, onClick: undefined });
    if (d.todayDeliveries.length > 0) items.push({ icon: Truck, label: uiT("Today's Deliveries", "आज की डिलीवरी"), value: d.todayDeliveries.length, color: "blue", action: () => navigate("/delivery"), actionLabel: "Deliver", onClick: () => navigate("/delivery") });
    if (items.length === 0) return null;
    return (
      <div className="space-y-3 sm:space-y-4">
        <SectionHeader title={uiT("Needs Attention", "ध्यान दें")} count={items.length} />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          {items.map((item) => (
            <AlertCard key={item.label} icon={item.icon} label={item.label} value={item.value} color={item.color} action={item.action} actionLabel={item.actionLabel} onClick={item.onClick} />
          ))}
        </div>
      </div>
    );
  };

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

  // Pending Bills

  const renderPendingBills = () => (
    <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg flex flex-col h-full">
      <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-th-card">
        <SectionHeader title={uiT("Pending Bill Amount", "लंबित बिल राशि")} count={d.pendingBills.length} action={() => navigate("/bills")} actionLabel={uiT("View all", "सभी देखें")} />
      </div>
      <div className="divide-y divide-th-card max-h-[380px] overflow-y-auto scrollbar-none flex-1">
        {d.pendingBills.length === 0 ? (
          <EmptyState icon={IndianRupee} title={uiT("All bills cleared", "सभी बिल चुकता")} description={uiT("No pending bills to collect.", "कोई लंबित बिल नहीं।")} />
        ) : d.pendingBills.map((b, idx) => {
          const custObj = typeof b.customerId === "object" && b.customerId ? b.customerId : null;
          const cName = custObj?.name ?? "—";
          const cMobile = custObj?.mobile ?? "";
          return (
            <div key={b._id || idx} className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-5 py-3 sm:py-4 hover:bg-th-card transition-all">
              <UserAvatar name={cName} className="w-8 h-8 sm:w-10 sm:h-10 text-[10px] sm:text-sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] sm:text-[17px] font-semibold text-th-text truncate">{cName}</p>
                {!!(cMobile) && <p className="text-[12px] sm:text-[14px] text-th-secondary mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{maskPhone(cMobile)}</p>}
              </div>
              <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
                <p className="text-[14px] sm:text-[17px] font-bold text-[#e74c3c] whitespace-nowrap">₹{(b.pendingAmount || 0).toLocaleString()}</p>
                <button onClick={() => navigate(`/collect?billId=${b._id}`)} aria-label={uiT("Collect payment", "भुगतान वसूलें")}
                  className="inline-flex items-center px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[12px] sm:text-[14px] font-bold bg-[#e74c3c]/10 text-[#e74c3c] hover:bg-[#e74c3c]/20 transition-all duration-200 active:scale-95 uppercase tracking-wider whitespace-nowrap">
                  {uiT("Collect", "वसूलें")}
                </button>
              </div>
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

  // Recent Customers
  // (removed)

  // Todo

  const renderTodo = () => (
    <div className="bg-th-surface rounded-xl p-3 sm:p-5 shadow-lg flex flex-col">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-[#1ed760]/10 flex items-center justify-center">
            <CheckSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1ed760]" />
          </div>
          <h3 className="text-[17px] sm:text-[20px] font-bold text-th-text uppercase tracking-wider">{uiT("To-Do", "कार्य सूची")}</h3>
        </div>
        <span className="text-[13px] sm:text-[16px] font-bold text-th-secondary bg-th-elevated px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg">{activeTodos.length} {uiT("pending", "बाकी")}</span>
      </div>

      {/* Add area */}
      <div className="mb-3 sm:mb-4">
        <AutoGrowTextarea value={newTodo} onChange={setNewTodo} autoFocus={false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addTodo(); }
          }}
          placeholder={`${uiT("Add a task...", "कार्य जोड़ें...")}\n${uiT("Second line for details (name, phone, notes...)", "दूसरी लाइन में विवरण (नाम, नंबर, नोट्स...)")}`}
          aria-label={uiT("Add a task", "कार्य जोड़ें")}
          className="w-full px-3 sm:px-4 py-2 sm:py-2.5 bg-th-elevated border border-th-border rounded-lg text-[15px] sm:text-[18px] text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all leading-snug" />
        <div className="flex items-center justify-between gap-2 mt-1.5 sm:mt-2">
          <span className="text-[11px] sm:text-[12px] text-th-muted">{uiT("Enter = add · Shift+Enter = new line", "Enter = जोड़ें · Shift+Enter = नई लाइन")}</span>
          <button onClick={addTodo} disabled={!newTodo.trim()} aria-label={uiT("Add task", "कार्य जोड़ें")}
            className="inline-flex items-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-[#1ed760]/10 hover:bg-[#1ed760]/20 disabled:opacity-40 disabled:cursor-not-allowed text-[#1ed760] transition-all active:scale-95 text-[13px] sm:text-[15px] font-bold uppercase tracking-wider">
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            {uiT("Add", "जोड़ें")}
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-[260px] overflow-y-auto scrollbar-none pr-1 flex-1">
        {todos.length === 0 ? (
          <EmptyState icon={CheckSquare} title={uiT("No tasks yet", "अभी तक कोई कार्य नहीं")} description={uiT("Add a task above to get started.", "शुरू करने के लिए ऊपर एक कार्य जोड़ें।")} />
        ) : (
          [...activeTodos, ...doneTodos].map((t) => (
            editingId === t._id ? (
              <div key={t._id} className="bg-th-elevated border border-[#1ed760]/30 rounded-xl p-2.5 sm:p-3">
                <AutoGrowTextarea value={editText} onChange={setEditText} autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(t._id); }
                  }}
                  aria-label={uiT("Edit task", "कार्य संपादित करें")}
                  className="w-full px-3 py-2 bg-th-surface border border-th-border rounded-lg text-[15px] sm:text-[18px] text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all leading-snug" />
                <div className="flex items-center justify-end gap-2 mt-2">
                  <button onClick={() => setEditingId(null)} aria-label={uiT("Cancel", "रद्द करें")}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[13px] sm:text-[15px] font-bold text-th-secondary bg-th-elevated hover:bg-th-card transition-all active:scale-95 uppercase tracking-wider">
                    {uiT("Cancel", "रद्द करें")}
                  </button>
                  <button onClick={() => saveEdit(t._id)} aria-label={uiT("Save", "सेव करें")}
                    className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-[13px] sm:text-[15px] font-bold bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-all active:scale-95 uppercase tracking-wider">
                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    {uiT("Save", "सेव करें")}
                  </button>
                </div>
              </div>
            ) : (
              <div key={t._id} className={`flex items-start gap-2.5 sm:gap-3 py-2 sm:py-2.5 px-2 sm:px-3 rounded-lg hover:bg-th-card group transition-all ${t.done ? "opacity-40" : ""}`}>
                <button onClick={() => toggleTodo(t._id, t.done)} aria-label={t.done ? uiT("Mark incomplete", "अपूर्ण चिह्नित करें") : uiT("Mark complete", "पूर्ण चिह्नित करें")}
                  className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${t.done ? "bg-[#1ed760] border-[#1ed760]" : "border-th-muted hover:border-[#1ed760]"}`}>
                  {t.done && <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-th-text" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-[15px] sm:text-[18px] leading-snug break-words ${t.done ? "line-through text-th-muted" : "text-th-secondary"}`}>{t.task}</p>
                  {t.notes && (
                    <p className="text-[13px] sm:text-[15px] text-th-muted whitespace-pre-wrap break-words mt-0.5 leading-relaxed">{t.notes}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(t)} aria-label={uiT("Edit task", "कार्य संपादित करें")}
                    className="p-1 sm:p-1.5 rounded-lg hover:bg-[#1ed760]/10 text-th-muted hover:text-[#1ed760] transition-all">
                    <Pencil className="w-3 sm:w-3.5 sm:h-3.5 h-3" />
                  </button>
                  <button onClick={() => deleteTodo(t._id)} aria-label="Delete task"
                    className="p-1 sm:p-1.5 rounded-lg hover:bg-[#e74c3c]/10 text-th-muted hover:text-[#e74c3c] transition-all">
                    <Trash2 className="w-3 sm:w-3.5 sm:h-3.5 h-3" />
                  </button>
                </div>
              </div>
            )
          ))
        )}
      </div>
    </div>
  );

  // Payments

  const renderPayments = () => {
    const todayPayments = d.todayPaymentModeSplit;
    if (!todayPayments?.length) return null;
    return (
      <div className="bg-th-surface rounded-xl p-3 sm:p-5 shadow-lg flex flex-col h-full">
        <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-[#1ed760]/10 flex items-center justify-center">
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#1ed760]" />
          </div>
          <h3 className="text-[17px] sm:text-[20px] font-bold text-th-text uppercase tracking-wider">{uiT("Today's Payments", "आज का भुगतान")}</h3>
        </div>
        <div className="space-y-2 sm:space-y-2.5">
          {todayPayments.map((p, idx) => {
            const Icon = paymentModeIcon[p.mode] || IndianRupee;
            return (
              <div key={`${p.mode}-${idx}`} className="flex items-center gap-2.5 sm:gap-3 bg-th-elevated rounded-lg px-3 sm:px-4 py-2.5 sm:py-3 transition-all hover:bg-th-card">
                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-md sm:rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${paymentModeColors[p.mode] || "#1ed760"}15` }}>
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: paymentModeColors[p.mode] || "#1ed760" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] sm:text-[18px] font-semibold text-th-text">{p.mode}</p>
                  <p className="text-[12px] sm:text-[16px] text-th-secondary">{p.count} transaction{p.count !== 1 ? "s" : ""}</p>
                </div>
                <p className="text-[15px] sm:text-[20px] font-bold text-th-text flex-shrink-0">₹{p.total.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Summary Accordion

  const renderSummary = () => {
    const rows: { label: string; value: string | number; color?: string }[] = [
      { label: uiT("Total Customers", "कुल ग्राहक"), value: d.counts.customers, color: "#60a5fa" },
      { label: uiT("Total Orders", "कुल ऑर्डर"), value: d.counts.orders, color: "#a78bfa" },
      { label: uiT("Total Bills", "कुल बिल"), value: d.counts.bills, color: "#34d399" },
      { label: uiT("Total Payments", "कुल भुगतान"), value: d.counts.payments, color: "#fbbf24" },
      { label: uiT("Total Inventory", "कुल इन्वेंट्री"), value: d.counts.inventory, color: "#f472b6" },
      { label: uiT("Total Deliveries", "कुल डिलीवरी"), value: d.counts.deliveries, color: "#2dd4bf" },
      { label: uiT("Total Visits", "कुल विज़िट"), value: d.counts.visits, color: "#fb923c" },
      { label: uiT("Today Sales", "आज की बिक्री"), value: `₹${(d.todaySales || 0).toLocaleString()}`, color: "#34d399" },
      { label: uiT("Week Sales", "सप्ताह की बिक्री"), value: `₹${(d.weekSales || 0).toLocaleString()}`, color: "#34d399" },
      { label: uiT("Month Sales", "महीने की बिक्री"), value: `₹${(d.monthSales || 0).toLocaleString()}`, color: "#34d399" },
      { label: uiT("Today Collection", "आज का संग्रह"), value: `₹${(d.todayCollection || 0).toLocaleString()}`, color: "#60a5fa" },
      { label: uiT("Pending Payments", "बाकी भुगतान"), value: `₹${(d.pendingPayments || 0).toLocaleString()}`, color: "#fbbf24" },
      { label: uiT("Today Orders", "आज के ऑर्डर"), value: d.todayOrders, color: "#a78bfa" },
      { label: uiT("Week Orders", "सप्ताह के ऑर्डर"), value: d.weekOrders, color: "#a78bfa" },
      { label: uiT("Month Orders", "महीने के ऑर्डर"), value: d.monthOrders, color: "#a78bfa" },
      { label: uiT("Today Bills", "आज के बिल"), value: d.todayBills, color: "#34d399" },
      { label: uiT("Week Bills", "सप्ताह के बिल"), value: d.weekBills, color: "#34d399" },
      { label: uiT("Month Bills", "महीने के बिल"), value: d.monthBills, color: "#34d399" },
      { label: uiT("Ready for Pickup", "पिकअप के लिए तैयार"), value: d.readyDeliveries ?? 0, color: "#2dd4bf" },
      { label: uiT("New Customers Today", "आज नए ग्राहक"), value: d.newCustomersToday ?? 0, color: "#60a5fa" },
      { label: uiT("Low Stock Items", "कम स्टॉक आइटम"), value: d.lowStock ?? 0, color: "#f87171" },
      { label: uiT("Draft Orders", "ड्राफ्ट ऑर्डर"), value: draftOrders.length, color: "#fb923c" },
      { label: uiT("Pending Bill Amount", "लंबित बिल राशि"), value: d.pendingBills.length, color: "#f87171" },
      { label: uiT("Today Deliveries", "आज की डिलीवरी"), value: d.todayDeliveries.length, color: "#2dd4bf" },
    ];

    return (
      <details className="group bg-th-surface rounded-xl overflow-hidden shadow-lg">
        <summary className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-3 sm:py-4 cursor-pointer list-none hover:bg-th-card transition-colors">
          <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-th-muted transition-transform duration-300 group-open:rotate-90" />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-th-secondary" />
            <span className="text-[15px] sm:text-[18px] font-bold text-th-text uppercase tracking-wider">{uiT("Summary", "सारांश")}</span>
          </div>
          <span className="text-[13px] sm:text-[16px] text-th-muted">({rows.length} metrics)</span>
        </summary>
        <div className="px-4 sm:px-6 pb-4 sm:pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-0.5 pt-3 border-t border-th-card">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-th-elevated last:border-0">
                <span className="text-[14px] sm:text-[18px] text-th-secondary">{r.label}</span>
                <span className="text-[14px] sm:text-[18px] font-bold text-th-text" style={r.color ? { color: r.color } : undefined}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    );
  };

  // Main Render

  return (
    <div className="bg-th-base min-h-screen" role="main">
      <div className="max-w-7xl mx-auto space-y-3 sm:space-y-4 px-3 sm:px-4 md:px-6 py-3 sm:py-5 md:py-6">
        {renderHeader()}
        {!isStaff && (
          <>
            {renderHero()}
            {renderQuickActions()}
            {renderKPIs()}
            {renderCharts()}
            {renderNeedsAttention()}
          </>
        )}

        {/* Pending Bills + Deliveries (tabbed) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {renderPendingBills()}
          {renderDeliveries()}
        </div>

        {/* Lens Demand + Recent Orders side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
          {renderLensDemand()}
          {renderRecentOrders()}
        </div>

        {/* Todo + Payments */}
        {(() => {
          const payments = renderPayments();
          return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
              <div className={payments ? "" : "lg:col-span-2"}>{renderTodo()}</div>
              {!isStaff && payments}
            </div>
          );
        })()}

        {!isStaff && renderSummary()}
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

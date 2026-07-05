import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApiGet } from "../hooks/useApi";
import PageSkeleton from "../components/PageSkeleton";
import CameraScanner from "../components/CameraScanner";
import { SalesTrendChart, OrderStatusDonut } from "../components/DashboardCharts";
import { useToast } from "../context/ToastContext";
import { useTheme } from "../context/ThemeContext";
import {
  Users, Package, Wallet, Receipt, Truck, ShoppingBag, ClipboardList,
  TrendingUp, IndianRupee, ScanLine, Boxes, CircleDollarSign, PackageCheck,
  Clock, Activity, Plus, Check, Trash2, ArrowUpRight, UserPlus, FileText,
  BarChart3, AlertTriangle, AlertCircle, CreditCard, Smartphone, Building2,
  X, ChevronRight, ShoppingCart, CheckSquare, Send, Eye, MessageSquare,
  Calendar, LayoutDashboard, CircleUserRound, AlertOctagon,
} from "lucide-react";

interface DashboardData {
  counts: { customers: number; orders: number; bills: number; payments: number; inventory: number; deliveries: number; visits: number };
  todaySales: number; todayCollection: number; weekSales: number; monthSales: number;
  readyDeliveries: number; newCustomersToday: number;
  lowStock: number; pendingPayments: number; recentCustomers: Record<string, unknown>[]; recentOrders: Record<string, unknown>[]; todayDeliveries: Record<string, unknown>[]; pendingBills: Record<string, unknown>[];
  incompleteOrders: (Record<string, unknown> & { stockStatus?: { lensBrand?: { shop: number; warehouse: number } | null; frameBrand?: { shop: number; warehouse: number } | null } | null })[];
  todayOrders: number; weekOrders: number; monthOrders: number;
  todayBills: number; weekBills: number; monthBills: number;
  dailySales: { date: string; total: number }[];
  paymentModeSplit: { mode: string; total: number; count: number }[];
  orderStatusCounts: { status: string; count: number }[];
}

const v = <T,>(val: T | null | undefined, fallback: T | string = "ΓÇö"): T | string => val ?? fallback;

const maskPhone = (p: string): string => {
  if (!p || p.length < 6) return v(p) as string;
  return p.slice(0, 2) + "****" + p.slice(-2);
};

function formatRx(sph?: number, cyl?: number, axis?: number): string {
  const s = sph != null ? (sph > 0 ? `+${sph}` : `${sph}`) : "";
  const c = cyl != null ? (cyl > 0 ? `+${cyl}` : `${cyl}`) : "";
  const a = axis != null ? `├ù${axis}` : "";
  if (!s && !c) return "ΓÇö";
  return `${s}${c ? ` / ${c}` : ""}${a ? ` ${a}` : ""}`;
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const paymentModeIcon: Record<string, typeof CreditCard> = {
  Cash: IndianRupee, UPI: Smartphone, Card: CreditCard, "Bank Transfer": Building2,
};

const paymentModeColors: Record<string, string> = {
  Cash: "#10b981", UPI: "#6366f1", Card: "#f59e0b", "Bank Transfer": "#06b6d4",
};

// ΓöÇΓöÇΓöÇ Sub-components ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

function UserAvatar({ name, className = "" }: { name: string; className?: string }) {
  const initial = (name || "?").charAt(0).toUpperCase();
  return (
    <div className={`rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold ring-2 ring-white/20 dark:ring-slate-700 flex-shrink-0 ${className}`}>
      {initial}
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, trend, subtitle }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; trend?: string; subtitle?: string }) {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl p-5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}18` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-lg whitespace-nowrap flex-shrink-0">
            <TrendingUp className="w-3 h-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-1 line-clamp-1" style={{ color }}>{value}</div>
      <div className="mt-auto">
        <div className="text-sm font-medium text-slate-500 dark:text-slate-400 line-clamp-1">{label}</div>
        {subtitle && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{subtitle}</div>}
      </div>
    </div>
  );
}

function QuickActionCard({ icon: Icon, label, subtitle, onClick, color }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; subtitle: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} className="h-20 flex flex-col items-center justify-center gap-1 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-xl p-2 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 w-full group">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300" style={{ backgroundColor: `${color || "#6366f1"}15` }}>
        <Icon className="w-4 h-4" style={{ color: color || "#6366f1" }} />
      </div>
      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-full leading-tight">{label}</span>
      <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-full leading-tight hidden sm:block">{subtitle}</span>
    </button>
  );
}

function SectionHeader({ title, count, action, actionLabel }: { title: string; count?: number; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
        {count !== undefined && <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-lg">{count}</span>}
      </div>
      {action && (
        <button onClick={action} className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 px-3 py-1.5 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 transition-all hover:shadow-md hover:-translate-y-0.5">
          {actionLabel || "View all"}
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Delivered: "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/20",
    Ready: "bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/20",
    Ordered: "bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/20",
    Draft: "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600/50",
    "In Transit": "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/20",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap ${styles[status] || "bg-slate-100 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600/50"}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-slate-400 dark:text-slate-500" />
      </div>
      <p className="text-base font-semibold text-slate-900 dark:text-white">{title}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-5 max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-500/20 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-all hover:shadow-md hover:-translate-y-0.5">
          <Plus className="w-4 h-4" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }: { options: { label: string; value: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-lg bg-slate-100 dark:bg-slate-700/50 p-0.5 gap-0.5">
      {options.map((opt) => {
        const isActive = value === opt.value;
        const activeColor = opt.value === "stock" ? "emerald" : opt.value === "order" ? "blue" : "amber";
        return (
          <button key={opt.value} onClick={() => onChange(isActive ? "pending" : opt.value)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all leading-tight ${
              isActive
                ? `bg-white dark:bg-slate-600 shadow-sm text-${activeColor}-700 dark:text-${activeColor}-300 ring-1 ring-${activeColor}-400/30`
                : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-600/30"
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
    red: "bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/15",
    orange: "bg-orange-50 dark:bg-orange-500/5 border-orange-200 dark:border-orange-500/15",
    yellow: "bg-amber-50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/15",
    blue: "bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/15",
  };
  const textMap: Record<string, string> = {
    red: "text-red-700 dark:text-red-300",
    orange: "text-orange-700 dark:text-orange-300",
    yellow: "text-amber-700 dark:text-amber-300",
    blue: "text-blue-700 dark:text-blue-300",
  };
  const iconMap: Record<string, string> = {
    red: "text-red-500",
    orange: "text-orange-500",
    yellow: "text-amber-500",
    blue: "text-blue-500",
  };
  return (
    <div className={`relative ${bgMap[color] || bgMap.blue} border rounded-2xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${onClick ? "cursor-pointer" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${iconMap[color] || iconMap.blue} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${textMap[color] || textMap.blue}`}>{label}</p>
          <p className={`text-xl font-bold ${textMap[color] || textMap.blue} mt-0.5`}>{value}</p>
        </div>
        {action && (
          <button onClick={(e) => { e.stopPropagation(); action(); }} className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all hover:-translate-y-0.5 hover:shadow-md ${bgMap[color] || bgMap.blue} ${textMap[color] || textMap.blue} hover:opacity-80 flex-shrink-0`}>
            {actionLabel || "View"}
          </button>
        )}
      </div>
    </div>
  );
}

// ΓöÇΓöÇΓöÇ Main Dashboard ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

export default function Dashboard() {
  const { data, loading, refetch } = useApiGet<DashboardData>("/api/dashboard/stats");
  const [todos, setTodos] = useState<Record<string, unknown>[]>([]);
  const [newTask, setNewTask] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [hasDataOnce, setHasDataOnce] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [sendingDemand, setSendingDemand] = useState<"buy" | "order" | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { dark, toggle } = useTheme();

  useEffect(() => { if (data) setHasDataOnce(true); }, [data]);

  useEffect(() => {
    api.get<Record<string, unknown>[]>("/api/todos").then((d) => { if (d.success) setTodos(d.data || []); });
  }, []);

  const fetchTodos = useCallback(() => {
    api.get<Record<string, unknown>[]>("/api/todos").then((d) => { if (d.success) setTodos(d.data || []); });
  }, []);

  const addTodo = useCallback(async () => {
    if (!newTask.trim()) return;
    const res = await api.post("/api/todos", { task: newTask.trim() });
    if (res.success) { setNewTask(""); fetchTodos(); }
  }, [newTask, fetchTodos]);

  const toggleTodo = useCallback(async (id: string, done: boolean) => {
    await api.patch(`/api/todos/${id}`, { done: !done });
    fetchTodos();
  }, [fetchTodos]);

  const deleteTodo = useCallback(async (id: string) => {
    await api.del(`/api/todos/${id}`);
    fetchTodos();
  }, [fetchTodos]);

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
      const d = (res.data as Record<string, unknown>) || res;
      if (d.sent) {
        toast.success(type === "buy" ? "Purchase list sent to WhatsApp!" : "Lab order list sent to WhatsApp!");
      } else if (d.waConnected === false) {
        toast.error("WhatsApp not connected. Scan QR code on WhatsApp page.");
      } else if (d.queued) {
        toast.info(`${type === "buy" ? "Purchase" : "Lab Order"} list queued ΓÇö will send when connected`);
      } else {
        toast.error(`PDF generated but send failed${d.sendError ? `: ${d.sendError as string}` : ""}`);
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
  if (!data) return null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  const d = data;
  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  const draftOrders = d.incompleteOrders.filter((o) => (o.status as string) === "Draft");

  const totalStock = (ss: { shop?: number; warehouse?: number } | null | undefined) => (ss?.shop ?? 0) + (ss?.warehouse ?? 0);

  // ΓöÇΓöÇ Header ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderHeader = () => (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}, <span className="text-primary-600 dark:text-primary-400">Sharad</span>
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-sm text-slate-500 dark:text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateStr}</span>
            <span className="text-slate-300 dark:text-slate-600">┬╖</span>
            <Clock className="w-3.5 h-3.5" />
            <span>{timeStr}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/workspace")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-primary-600 to-primary-500 text-white rounded-xl text-xs font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 shadow-md">
          <Plus className="w-3.5 h-3.5" />
          New Sale
        </button>
        <button onClick={() => setShowScanner(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">
          <ScanLine className="w-3.5 h-3.5" />
          Scan
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-xs ring-2 ring-white/20 dark:ring-slate-700 flex-shrink-0">S</div>
      </div>
    </div>
  );

  // ΓöÇΓöÇ Hero Section ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderHero = () => (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-500 to-indigo-600 dark:from-primary-700 dark:via-primary-600 dark:to-indigo-700 rounded-3xl p-6 md:p-8 shadow-xl shadow-primary-500/20 dark:shadow-primary-900/30">
      <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-indigo-300/10 rounded-full blur-2xl" />
      <div className="relative">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div>
            <p className="text-white/60 text-xs font-medium tracking-wide uppercase">Today's Sales</p>
            <p className="text-3xl md:text-4xl font-bold text-white mt-1.5 tracking-tight">Γé╣{(d.todaySales || 0).toLocaleString()}</p>
            <p className="text-white/50 text-xs mt-1.5 flex items-center gap-1"><TrendingUp className="w-3 h-3" /> +12% vs last week</p>
          </div>
          <div>
            <p className="text-white/60 text-xs font-medium tracking-wide uppercase">Collection</p>
            <p className="text-3xl md:text-4xl font-bold text-white mt-1.5 tracking-tight">Γé╣{(d.todayCollection || 0).toLocaleString()}</p>
            <p className="text-white/50 text-xs mt-1.5">{d.newCustomersToday ?? 0} new customers today</p>
          </div>
          <div>
            <p className="text-white/60 text-xs font-medium tracking-wide uppercase">Today's Orders</p>
            <p className="text-3xl md:text-4xl font-bold text-white mt-1.5 tracking-tight">{d.todayOrders}</p>
            <p className="text-white/50 text-xs mt-1.5">{d.readyDeliveries ?? 0} ready for pickup</p>
          </div>
          <div>
            <p className="text-white/60 text-xs font-medium tracking-wide uppercase">Performance</p>
            <p className="text-sm font-semibold text-white mt-3 leading-relaxed">
              Business is performing{Number(d.todaySales) > 0 ? " well today" : " steady today"}.
            </p>
            <p className="text-white/50 text-xs mt-1">Γé╣{(d.weekSales || 0).toLocaleString()} this week</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ΓöÇΓöÇ Quick Actions ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderQuickActions = () => (
    <div>
      <SectionHeader title="Quick Actions" />
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
        <QuickActionCard icon={ShoppingCart} label="New Sale" subtitle="Create a new order" onClick={() => navigate("/workspace")} color="#6366f1" />
        <QuickActionCard icon={UserPlus} label="Customers" subtitle="Manage your clients" onClick={() => navigate("/customers")} color="#10b981" />
        <QuickActionCard icon={Boxes} label="Inventory" subtitle="Track stock & lenses" onClick={() => navigate("/inventory")} color="#f59e0b" />
        <QuickActionCard icon={BarChart3} label="Reports" subtitle="View business insights" onClick={() => navigate("/reports")} color="#8b5cf6" />
        <QuickActionCard icon={Receipt} label="Bills" subtitle="Manage pending payments" onClick={() => navigate("/bills")} color="#ef4444" />
        <QuickActionCard icon={ClipboardList} label="Orders" subtitle="View all orders" onClick={() => navigate("/orders")} color="#06b6d4" />
        <QuickActionCard icon={ScanLine} label="Scanner" subtitle="Scan product barcodes" onClick={() => setShowScanner(true)} color="#f97316" />
        <QuickActionCard icon={MessageSquare} label="WhatsApp" subtitle="Send messages & PDFs" onClick={() => navigate("/whatsapp")} color="#22c55e" />
      </div>
    </div>
  );

  // ΓöÇΓöÇ KPI Metrics ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderKPIs = () => (
    <div>
      <SectionHeader title="Key Metrics" />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3">
        <MetricCard label="Today's Sales" value={`Γé╣${(d.todaySales || 0).toLocaleString()}`} icon={IndianRupee} color="#10b981" trend="+12.4%" subtitle="vs last week" />
        <MetricCard label="Today's Collection" value={`Γé╣${(d.todayCollection || 0).toLocaleString()}`} icon={CircleDollarSign} color="#6366f1" subtitle="today" />
        <MetricCard label="Today's Orders" value={d.todayOrders} icon={ShoppingBag} color="#8b5cf6" subtitle={d.weekOrders ? `${d.weekOrders} this week` : undefined} />
        <MetricCard label="Pending Bills" value={d.pendingBills.length} icon={Receipt} color="#ef4444" subtitle={`Γé╣${(d.pendingPayments || 0).toLocaleString()} due`} />
        <MetricCard label="Ready for Pickup" value={d.readyDeliveries ?? 0} icon={PackageCheck} color="#06b6d4" subtitle="awaiting collection" />
        <MetricCard label="New Customers" value={d.newCustomersToday ?? 0} icon={Users} color="#10b981" subtitle="joined today" />
        <MetricCard label="Low Stock Items" value={d.lowStock ?? 0} icon={AlertTriangle} color="#f59e0b" subtitle="items need restock" />
        <MetricCard label="Total Inventory" value={d.counts.inventory} icon={Boxes} color="#f472b6" subtitle="total SKUs" />
      </div>
    </div>
  );

  // ΓöÇΓöÇ Charts ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderCharts = () => {
    if (d.dailySales?.length === 0 && d.orderStatusCounts?.length === 0) return null;
    return (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3">
          <SalesTrendChart data={d.dailySales || []} dark={dark} />
        </div>
        <div className="lg:col-span-2">
          <OrderStatusDonut data={d.orderStatusCounts || []} dark={dark} />
        </div>
      </div>
    );
  };

  // ΓöÇΓöÇ Needs Attention ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderNeedsAttention = () => {
    interface AlertItem { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string | number; color: string; action?: () => void; actionLabel?: string; onClick?: () => void }
    const items: AlertItem[] = [];
    if (d.pendingBills.length > 0) items.push({ icon: AlertCircle, label: "Pending Bills", value: d.pendingBills.length, color: "red", action: () => navigate("/bills"), actionLabel: "Collect", onClick: () => navigate("/bills") });
    if ((d.lowStock ?? 0) > 0) items.push({ icon: AlertTriangle, label: "Low Stock Items", value: d.lowStock ?? 0, color: "orange", action: () => navigate("/inventory"), actionLabel: "Restock", onClick: () => navigate("/inventory") });
    if (draftOrders.length > 0) items.push({ icon: FileText, label: "Draft Orders", value: draftOrders.length, color: "yellow", action: undefined, onClick: undefined });
    if (d.todayDeliveries.length > 0) items.push({ icon: Truck, label: "Today's Deliveries", value: d.todayDeliveries.length, color: "blue", action: () => navigate("/delivery"), actionLabel: "Deliver", onClick: () => navigate("/delivery") });
    if (items.length === 0) return null;
    return (
      <div>
        <SectionHeader title="Needs Attention" count={items.length} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {items.map((item) => (
            <AlertCard key={item.label} icon={item.icon} label={item.label} value={item.value} color={item.color} action={item.action} actionLabel={item.actionLabel} onClick={item.onClick} />
          ))}
        </div>
      </div>
    );
  };

  // ΓöÇΓöÇ Lens Demand ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderLensDemand = () => {
    const allIds = draftOrders.map((o) => o._id as string);

    return (
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
              <Eye className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Lens Demand</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{draftOrders.length} draft{draftOrders.length !== 1 ? "s" : ""} pending classification</p>
            </div>
          </div>
          {selectedOrders.size > 0 && (
            <button onClick={clearSelection} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all">
              <X className="w-3.5 h-3.5" /> Clear selection
            </button>
          )}
        </div>

        {draftOrders.length === 0 ? (
          <EmptyState icon={PackageCheck} title="All clear!" description="No draft orders pending lens classification." actionLabel="Create New Order" onAction={() => navigate("/workspace")} />
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-3 px-6 py-3 border-b border-slate-200 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-900/30 flex-wrap">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
                <input type="checkbox" checked={selectedOrders.size === draftOrders.length && draftOrders.length > 0}
                  onChange={() => toggleAllOrders(allIds)}
                  className="w-4 h-4 rounded accent-primary-600" />
                Select all ({draftOrders.length})
              </label>
              {selectedOrders.size > 0 && (
                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-500/10 px-3 py-1 rounded-lg">{selectedOrders.size} selected</span>
              )}
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <button onClick={() => sendDemand("buy")} disabled={sendingDemand !== null || selectedOrders.size === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 hover:bg-amber-100 dark:hover:bg-amber-500/20 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                  <ShoppingBag className="w-4 h-4" />
                  {sendingDemand === "buy" ? "Sending..." : "Buy List"}
                </button>
                <button onClick={() => sendDemand("order")} disabled={sendingDemand !== null || selectedOrders.size === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-100 dark:hover:bg-blue-500/20 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                  <Send className="w-4 h-4" />
                  {sendingDemand === "order" ? "Sending..." : "Lab Order"}
                </button>
              </div>
            </div>

            {/* Cards */}
            <div className="max-h-[800px] overflow-y-auto scrollbar-thin p-5 space-y-4">
              {draftOrders.map((o) => {
                const id = o._id as string;
                const cName = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).name as string : "";
                const cMobile = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).mobile as string : "";
                const ss = o.stockStatus?.lensBrand;
                const isSelected = selectedOrders.has(id);
                const rx = o.prescription as Record<string, unknown> | undefined;
                const rightEye = rx?.rightEye as Record<string, unknown> | undefined;
                const leftEye = rx?.leftEye as Record<string, unknown> | undefined;
                const rDV = rightEye?.dv as Record<string, unknown> | undefined;
                const lDV = leftEye?.dv as Record<string, unknown> | undefined;
                const rNV = rightEye?.nv as Record<string, unknown> | undefined;
                const lNV = leftEye?.nv as Record<string, unknown> | undefined;
                const rStatus = (o.rightLensStatus as string) || "pending";
                const lStatus = (o.leftLensStatus as string) || "pending";

                function formatEyeRx(dv: Record<string, unknown> | undefined, nv: Record<string, unknown> | undefined, pd: unknown): string | null {
                  const parts: string[] = [];
                  if (dv?.sph != null) {
                    parts.push(formatRx(dv.sph as number, dv.cyl as number, dv.axis as number));
                    if (nv?.sph != null) parts.push(`Add ${((nv.sph as number) - (dv.sph as number)).toFixed(2)}`);
                    if (dv.va) parts.push(`VA:${dv.va}`);
                  }
                  if (nv?.sph != null && dv?.sph == null) {
                    parts.push(formatRx(nv.sph as number, nv.cyl as number, nv.axis as number));
                  }
                  if (pd) parts.push(`PD ${pd}`);
                  return parts.length ? parts.join("  ") : null;
                }

                const rRx = formatEyeRx(rDV, rNV, rx?.pd);
                const lRx = formatEyeRx(lDV, lNV, rx?.pd);
                const lensLabel = [o.lensBrand, o.lensType, o.lensIndex].filter(Boolean).join(" ");

                const stockTotal = totalStock(ss);
                const stockColor = stockTotal > 5 ? "emerald" : stockTotal > 0 ? "amber" : "red";
                const stockLabel = stockTotal > 5 ? "In Stock" : stockTotal > 0 ? "Limited" : "Out of Stock";

                function StockBadge({ color, label }: { color: string; label: string }) {
                  const colors: Record<string, string> = {
                    emerald: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/15",
                    amber: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/15",
                    red: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/15",
                  };
                  return <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border whitespace-nowrap ${colors[color] || colors.red}`}>{label}</span>;
                }

                return (
                  <div
                    key={id}
                    className={`bg-white dark:bg-slate-900/50 border rounded-2xl p-5 shadow-sm transition-all duration-300 ${
                      isSelected
                        ? "border-primary-300 dark:border-primary-500/40 shadow-md ring-1 ring-primary-200 dark:ring-primary-500/20"
                        : "border-slate-200 dark:border-slate-700/50 hover:shadow-xl hover:-translate-y-0.5"
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-3 mb-4">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOrderSelection(id)}
                        className="w-4 h-4 mt-1 rounded accent-primary-600 cursor-pointer flex-shrink-0" />
                      <UserAvatar name={cName} className="w-10 h-10 text-sm" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base font-bold text-slate-900 dark:text-white truncate">{cName || "ΓÇö"}</span>
                              {!!(cMobile) && <span className="text-sm text-slate-400 dark:text-slate-500 hidden sm:inline">{maskPhone(cMobile)}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-sm text-slate-400 dark:text-slate-500">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{o.createdAt ? formatTimeAgo(o.createdAt as string) : ""}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <StatusBadge status={(o.status as string) || "Draft"} />
                            <button onClick={() => navigate(`/workspace?order=${id}`)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-gradient-to-r from-primary-600 to-primary-500 text-white hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 shadow-sm">
                              Open <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lens details */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-4 px-1">
                      {!!(o.frameBrand) && <span className="text-sm text-slate-600 dark:text-slate-400"><span className="font-medium text-slate-500 dark:text-slate-500">Frame:</span> {o.frameBrand as string}</span>}
                      {!!(o.lensBrand) && <span className="text-sm text-slate-600 dark:text-slate-400"><span className="font-medium text-slate-500 dark:text-slate-500">Lens:</span> {o.lensBrand as string}</span>}
                      {!!(o.lensType) && <span className="text-sm text-slate-600 dark:text-slate-400"><span className="font-medium text-slate-500 dark:text-slate-500">Type:</span> {o.lensType as string}</span>}
                      {!!(o.lensIndex) && <span className="text-sm text-slate-600 dark:text-slate-400"><span className="font-medium text-slate-500 dark:text-slate-500">Index:</span> {o.lensIndex as string}</span>}
                      {!!(lensLabel) && !o.frameBrand && !o.lensBrand && <span className="text-sm text-slate-500 dark:text-slate-400">{lensLabel}</span>}
                    </div>

                    {/* Eye panels */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {[
                        { eye: "right" as const, label: "RIGHT EYE", rxStr: rRx, status: rStatus, panelBg: "bg-cyan-50/50 dark:bg-cyan-500/5 border-cyan-100 dark:border-cyan-500/10", labelColor: "text-cyan-700 dark:text-cyan-300" },
                        { eye: "left" as const, label: "LEFT EYE", rxStr: lRx, status: lStatus, panelBg: "bg-amber-50/50 dark:bg-amber-500/5 border-amber-100 dark:border-amber-500/10", labelColor: "text-amber-700 dark:text-amber-300" },
                      ].map((e) => (
                        <div key={e.eye} className={`${e.panelBg} border rounded-xl p-4`}>
                          <div className="flex items-center justify-between mb-3">
                            <span className={`text-xs font-extrabold tracking-wider ${e.labelColor}`}>{e.label}</span>
                            <StockBadge color={stockColor} label={stockLabel} />
                          </div>
                          <div className="mb-3">
                            {e.rxStr ? (
                              <span className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200 break-all">{e.rxStr}</span>
                            ) : (
                              <span className="text-sm text-slate-400 dark:text-slate-600">No prescription</span>
                            )}
                          </div>
                          <SegmentedControl
                            options={[
                              { label: "Stock", value: "stock" },
                              { label: "Buy", value: "buy" },
                              { label: "Order", value: "order" },
                            ]}
                            value={e.status}
                            onChange={(s) => classifyEye(id, e.eye, s)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  // ΓöÇΓöÇ Recent Orders ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderRecentOrders = () => (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <SectionHeader title="Recent Orders" count={d.recentOrders.length} action={() => navigate("/orders")} actionLabel="View all" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[340px] overflow-y-auto scrollbar-thin">
        {d.recentOrders.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No orders yet" description="Create your first order to get started." actionLabel="New Order" onAction={() => navigate("/workspace")} />
        ) : d.recentOrders.map((o, idx) => {
          const cName = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).name as string : "ΓÇö";
          const cMobile = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).mobile as string : "";
          return (
            <div key={o._id as string || idx} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all cursor-pointer" onClick={() => navigate(`/workspace?order=${o._id as string}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/workspace?order=${o._id as string}`)}>
              <div className="relative flex-shrink-0">
                <UserAvatar name={cName} className="w-10 h-10 text-sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full ${o.status === "Delivered" ? "bg-emerald-500" : o.status === "Draft" ? "bg-slate-400" : o.status === "Ordered" ? "bg-purple-500" : o.status === "Ready" ? "bg-blue-500" : "bg-amber-500"}`} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{cName}</p>
                  {!!(cMobile) && <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">{maskPhone(cMobile)}</span>}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {o.createdAt ? formatTimeAgo(o.createdAt as string) : ""}
                  {!!(o.frameBrand) ? ` ┬╖ ${o.frameBrand as string}` : ""}
                  {!!(o.lensBrand) ? ` ┬╖ ${o.lensBrand as string}` : ""}
                </p>
              </div>
              <StatusBadge status={(o.status as string) || "ΓÇö"} />
            </div>
          );
        })}
      </div>
    </div>
  );

  // ΓöÇΓöÇ Pending Bills ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderPendingBills = () => (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <SectionHeader title="Pending Bills" count={d.pendingBills.length} action={() => navigate("/bills")} actionLabel="View all" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[340px] overflow-y-auto scrollbar-thin">
        {d.pendingBills.length === 0 ? (
          <EmptyState icon={CircleDollarSign} title="All bills cleared" description="No pending bills to collect." />
        ) : d.pendingBills.slice(0, 6).map((b, idx) => {
          const cName = typeof b.customerId === "object" && b.customerId ? (b.customerId as Record<string, unknown>).name as string : "ΓÇö";
          const cMobile = typeof b.customerId === "object" && b.customerId ? (b.customerId as Record<string, unknown>).mobile as string : "";
          return (
            <div key={b._id as string || idx} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
              <UserAvatar name={cName} className="w-10 h-10 text-sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{cName}</p>
                {!!(cMobile) && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{maskPhone(cMobile)}</p>}
              </div>
              <div className="text-right flex items-center gap-3 flex-shrink-0">
                <p className="text-base font-bold text-red-600 dark:text-red-400 whitespace-nowrap">Γé╣{((b.pendingAmount as number) || 0).toLocaleString()}</p>
                <button onClick={() => navigate(`/bills?id=${b._id as string}`)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/20 hover:bg-red-100 dark:hover:bg-red-500/20 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">
                  Collect
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ΓöÇΓöÇ Today's Deliveries ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderDeliveries = () => (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <SectionHeader title="Today's Deliveries" count={d.todayDeliveries.length} action={() => navigate("/delivery")} actionLabel="View all" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[340px] overflow-y-auto scrollbar-thin">
        {d.todayDeliveries.length === 0 ? (
          <EmptyState icon={Truck} title="No deliveries today" description="All deliveries for today are completed." />
        ) : d.todayDeliveries.map((dl, idx) => {
          const cName = typeof dl.customerId === "object" && dl.customerId ? (dl.customerId as Record<string, unknown>).name as string : "ΓÇö";
          const cMobile = typeof dl.customerId === "object" && dl.customerId ? (dl.customerId as Record<string, unknown>).mobile as string : "";
          return (
            <div key={dl._id as string || idx} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all">
              <div className="relative flex-shrink-0">
                <UserAvatar name={cName} className="w-10 h-10 text-sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full ${dl.status === "Delivered" ? "bg-emerald-500" : dl.status === "Ready" ? "bg-blue-500" : dl.status === "In Transit" ? "bg-purple-500" : "bg-amber-500"}`} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{cName}</p>
                {!!(cMobile) && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{maskPhone(cMobile)}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={(dl.status as string) || "ΓÇö"} />
                <button onClick={() => navigate(`/delivery?order=${dl._id as string}`)}
                  className="p-2.5 rounded-xl text-sm font-semibold bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/20 hover:bg-primary-100 dark:hover:bg-primary-500/20 hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300">
                  <PackageCheck className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ΓöÇΓöÇ Recent Customers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderRecentCustomers = () => (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700/50">
        <SectionHeader title="Recent Customers" count={d.recentCustomers.length} action={() => navigate("/customers")} actionLabel="View all" />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700/30 max-h-[340px] overflow-y-auto scrollbar-thin">
        {d.recentCustomers.length === 0 ? (
          <EmptyState icon={Users} title="No customers yet" description="Start by adding your first customer." actionLabel="Add Customer" onAction={() => navigate("/customers")} />
        ) : d.recentCustomers.map((c, idx) => (
          <div key={c._id as string || idx} className="flex items-center gap-3 px-5 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-all cursor-pointer" onClick={() => navigate(`/customers/${c._id as string}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/customers/${c._id as string}`)}>
            <UserAvatar name={(c.name as string) || "?"} className="w-10 h-10 text-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{v(c.name as string)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{c.mobile ? maskPhone(c.mobile as string) : "ΓÇö"}</span>
                <span className="text-slate-300 dark:text-slate-600">┬╖</span>
                <span>{c.createdAt ? formatTimeAgo(c.createdAt as string) : ""}</span>
                <span className="text-slate-300 dark:text-slate-600">┬╖</span>
                <span>{(c.totalVisits as number) ?? 0} visits</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-base font-bold text-slate-900 dark:text-white">Γé╣{((c.totalSpent as number) || 0).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ΓöÇΓöÇ Todo ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderTodo = () => (
    <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center">
            <CheckSquare className="w-4 h-4 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">To-Do</h3>
        </div>
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700/50 px-2.5 py-1 rounded-lg">{activeTodos.length} pending</span>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <input type="text" placeholder="Add a task..." value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all" />
        <button onClick={addTodo} disabled={!newTask.trim()}
          className="p-2.5 rounded-xl bg-primary-50 dark:bg-primary-500/10 hover:bg-primary-100 dark:hover:bg-primary-500/20 disabled:opacity-40 text-primary-600 dark:text-primary-300 border border-primary-200 dark:border-primary-500/20 transition-all hover:shadow-md hover:-translate-y-0.5">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1 max-h-[260px] overflow-y-auto scrollbar-thin pr-1">
        {todos.length === 0 ? (
          <EmptyState icon={CheckSquare} title="No tasks yet" description="Add a task above to get started." />
        ) : (
          [...activeTodos, ...doneTodos].map((t) => (
            <div key={t._id as string} className={`flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] group transition-all ${t.done ? "opacity-40" : ""}`}>
              <button onClick={() => toggleTodo(t._id as string, !!(t.done))}
                className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-all ${t.done ? "bg-emerald-500 border-emerald-500" : "border-slate-300 dark:border-slate-600 hover:border-primary-400"}`}>
                {!!(t.done) && <Check className="w-3 h-3 text-white" />}
              </button>
              <span className={`flex-1 text-sm truncate ${t.done ? "line-through text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"}`}>{t.task as string}</span>
              <button onClick={() => deleteTodo(t._id as string)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // ΓöÇΓöÇ Payments ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderPayments = () => {
    if (!d.paymentModeSplit?.length) return null;
    return (
      <div className="bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Today's Payments</h3>
        </div>
        <div className="space-y-2.5">
          {d.paymentModeSplit.map((p) => {
            const Icon = paymentModeIcon[p.mode] || CircleDollarSign;
            return (
              <div key={p.mode} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl px-4 py-3 border border-slate-100 dark:border-slate-700/30 hover:shadow-sm transition-all">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${paymentModeColors[p.mode] || "#6366f1"}15` }}>
                  <Icon className="w-4 h-4" style={{ color: paymentModeColors[p.mode] || "#6366f1" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.mode}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{p.count} transaction{p.count !== 1 ? "s" : ""}</p>
                </div>
                <p className="text-base font-bold text-slate-900 dark:text-white flex-shrink-0">Γé╣{p.total.toLocaleString()}</p>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ΓöÇΓöÇ Summary Accordion ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  const renderSummary = () => {
    const rows: { label: string; value: string | number; color?: string }[] = [
      { label: "Total Customers", value: d.counts.customers, color: "#60a5fa" },
      { label: "Total Orders", value: d.counts.orders, color: "#a78bfa" },
      { label: "Total Bills", value: d.counts.bills, color: "#34d399" },
      { label: "Total Payments", value: d.counts.payments, color: "#fbbf24" },
      { label: "Total Inventory", value: d.counts.inventory, color: "#f472b6" },
      { label: "Total Deliveries", value: d.counts.deliveries, color: "#2dd4bf" },
      { label: "Total Visits", value: d.counts.visits, color: "#fb923c" },
      { label: "Today Sales", value: `Γé╣${(d.todaySales || 0).toLocaleString()}`, color: "#34d399" },
      { label: "Week Sales", value: `Γé╣${(d.weekSales || 0).toLocaleString()}`, color: "#34d399" },
      { label: "Month Sales", value: `Γé╣${(d.monthSales || 0).toLocaleString()}`, color: "#34d399" },
      { label: "Today Collection", value: `Γé╣${(d.todayCollection || 0).toLocaleString()}`, color: "#60a5fa" },
      { label: "Pending Payments", value: `Γé╣${(d.pendingPayments || 0).toLocaleString()}`, color: "#fbbf24" },
      { label: "Today Orders", value: d.todayOrders, color: "#a78bfa" },
      { label: "Week Orders", value: d.weekOrders, color: "#a78bfa" },
      { label: "Month Orders", value: d.monthOrders, color: "#a78bfa" },
      { label: "Today Bills", value: d.todayBills, color: "#34d399" },
      { label: "Week Bills", value: d.weekBills, color: "#34d399" },
      { label: "Month Bills", value: d.monthBills, color: "#34d399" },
      { label: "Ready for Pickup", value: d.readyDeliveries ?? 0, color: "#2dd4bf" },
      { label: "New Customers Today", value: d.newCustomersToday ?? 0, color: "#60a5fa" },
      { label: "Low Stock Items", value: d.lowStock ?? 0, color: "#f87171" },
      { label: "Draft Orders", value: draftOrders.length, color: "#fb923c" },
      { label: "Pending Bills", value: d.pendingBills.length, color: "#f87171" },
      { label: "Today Deliveries", value: d.todayDeliveries.length, color: "#2dd4bf" },
    ];

    return (
      <details className="group bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm overflow-hidden">
        <summary className="flex items-center gap-3 px-6 py-4 cursor-pointer list-none hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 group-open:rotate-90" />
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Summary ΓÇö All Metrics</span>
          </div>
          <span className="text-xs text-slate-400 dark:text-slate-500">({rows.length} metrics)</span>
        </summary>
        <div className="px-6 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-0.5 pt-3 border-t border-slate-200 dark:border-slate-700/50">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-700/20 last:border-0">
                <span className="text-sm text-slate-500 dark:text-slate-400">{r.label}</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white" style={r.color ? { color: r.color } : undefined}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </details>
    );
  };

  // ΓöÇΓöÇ Main Render ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ

  return (
    <div className="bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6 px-4 md:px-6 py-6 md:py-8">
        {renderHeader()}
        {renderHero()}
        {renderQuickActions()}
        {renderKPIs()}
        {renderCharts()}
        {renderNeedsAttention()}
        {renderLensDemand()}

        {/* Bottom grid: Recent Orders, Pending Bills, Today's Deliveries */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {renderRecentOrders()}
          {renderPendingBills()}
          {renderDeliveries()}
        </div>

        {/* Bottom grid: Recent Customers, Todo, Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {renderRecentCustomers()}
          {renderTodo()}
          {renderPayments()}
        </div>

        {renderSummary()}
      </div>

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowScanner(false)}>
          <div className="relative w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowScanner(false)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 shadow-lg z-10 transition-all hover:-translate-y-0.5" aria-label="Close scanner">
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

// Dashboard component
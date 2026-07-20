import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApi, useDashboard } from "../hooks";
import PageSkeleton from "../components/PageSkeleton";
import ShineCard from "../components/ShineCard";
import CameraScanner from "../components/CameraScanner";
import { SalesTrendChart, OrderStatusDonut } from "../components/DashboardCharts";
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
  Calendar, LayoutDashboard,
} from "lucide-react";

const v = <T,>(val: T | null | undefined, fallback: T | string = "—"): T | string => val ?? fallback;

const maskPhone = (p: string): string => {
  if (!p || p.length < 6) return v(p) as string;
  return p.slice(0, 2) + "****" + p.slice(-2);
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
};

const paymentModeColors: Record<string, string> = {
  Cash: "#10b981", UPI: "#6366f1", Card: "#f59e0b", "Bank Transfer": "#06b6d4",
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
    <ShineCard className="flex flex-col bg-th-surface rounded-lg p-4 md:p-5 h-full active:scale-95 shadow-md cursor-default">
      <div className="flex items-start justify-between gap-2 mb-2 md:mb-3">
        <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
          <Icon className="w-4 h-4 md:w-5 md:h-5" style={{ color }} />
        </div>
        {trend && (
          <span className="flex items-center gap-0.5 text-[14px] md:text-xs font-semibold text-[#1ed760] bg-[#1ed760]/10 px-1.5 md:px-2 py-0.5 md:py-1 rounded-lg whitespace-nowrap flex-shrink-0">
            <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" />
            {trend}
          </span>
        )}
      </div>
      <div className="text-lg sm:text-xl md:text-2xl font-bold text-th-text tracking-tight mb-0.5 md:mb-1 break-words" style={{ color }}>{value}</div>
      <div className="mt-auto">
        <div className="text-[17px] font-medium text-th-secondary break-words">{label}</div>
        {subtitle && <div className="text-[16px] text-th-muted mt-0.5 break-words">{subtitle}</div>}
      </div>
    </ShineCard>
  );
}

function QuickActionCard({ icon: Icon, label, subtitle, onClick, color }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; subtitle: string; onClick: () => void; color?: string }) {
  return (
    <ShineCard onClick={onClick} aria-label={label} className="h-20 flex flex-col items-center justify-center gap-1 bg-th-surface rounded-lg p-2 w-full group active:scale-95 hover:bg-th-card shadow-md hover:shadow-lg cursor-pointer">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200" style={{ backgroundColor: `${color || "#1ed760"}15` }}>
        <Icon className="w-4 h-4" style={{ color: color || "#1ed760" }} />
      </div>
      <span className="text-[15px] font-semibold text-th-text truncate max-w-full leading-tight uppercase tracking-wider">{label}</span>
      <span className="text-[14px] text-th-secondary truncate max-w-full leading-tight hidden sm:block">{subtitle}</span>
    </ShineCard>
  );
}

function SectionHeader({ title, count, action, actionLabel }: { title: string; count?: number; action?: () => void; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <h3 className="text-[20px] font-bold text-th-text uppercase tracking-wider">{title}</h3>
        {count !== undefined && <span className="text-[16px] font-medium text-th-secondary bg-th-elevated px-2.5 py-0.5 rounded-lg">{count}</span>}
      </div>
      {action && (
        <button onClick={action} aria-label={actionLabel || "View all"} className="flex items-center gap-1.5 text-[16px] font-bold text-[#1ed760] hover:text-[#1ed760] px-3 py-1.5 rounded-lg bg-[#1ed760]/10 uppercase tracking-wider transition-all active:scale-95">
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
    <span className={`text-[15px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap uppercase tracking-wider ${styles[status] || "bg-th-elevated text-th-secondary"}`}>
      {status}
    </span>
  );
}

function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="w-14 h-14 rounded-xl bg-th-elevated flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-th-muted" />
      </div>
      <p className="text-[20px] font-semibold text-th-text">{title}</p>
      <p className="text-[18px] text-th-secondary mt-1 mb-5 max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <button onClick={onAction} aria-label={actionLabel} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[18px] font-bold bg-[#1ed760] text-black hover:scale-105 transition-all active:scale-95 uppercase tracking-wider">
          <Plus className="w-4 h-4" />
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
            className={`${compact ? "px-2 py-1 text-[14px]" : "px-3 py-1.5 text-[15px]"} rounded-md font-bold transition-all leading-tight uppercase tracking-wider ${
              isActive
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
    <ShineCard className={`relative ${bgMap[color] || bgMap.blue} rounded-lg p-4 active:scale-95 shadow-md hover:shadow-lg ${onClick ? "cursor-pointer hover:bg-th-card" : ""}`} onClick={onClick} role={onClick ? "button" : undefined} tabIndex={onClick ? 0 : undefined} onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${iconMap[color] || iconMap.blue} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-[17px] font-medium ${textMap[color] || textMap.blue} uppercase tracking-wider`}>{label}</p>
          <p className={`text-xl font-bold ${textMap[color] || textMap.blue} mt-0.5`}>{value}</p>
        </div>
        {action && (
          <button onClick={(e) => { e.stopPropagation(); action(); }} aria-label={actionLabel || "View"} className={`px-4 py-2 rounded-lg text-[16px] font-bold transition-all active:scale-95 ${textMap[color] || textMap.blue} bg-th-card hover:bg-th-elevated uppercase tracking-wider flex-shrink-0`}>
            {actionLabel || "View"}
          </button>
        )}
      </div>
    </ShineCard>
  );
}

// Main Dashboard

export default function Dashboard() {
  const { dashboard, loading, error, refetch } = useDashboard();
  const { data: todosData, refetch: refetchTodos } = useApi<Todo[]>(
    () => api.get<Todo[]>("/api/workspace/todos"),
    [],
    { cacheKey: "/api/workspace/todos" }
  );
  const todos = todosData || [];
  const [newTask, setNewTask] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [hasDataOnce, setHasDataOnce] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [sendingDemand, setSendingDemand] = useState<"buy" | "order" | null>(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { dark, toggle } = useTheme();
  const { uiT } = useTranslate();
  const { user, currentBranch } = useAuth();

  useEffect(() => { if (dashboard) setHasDataOnce(true); }, [dashboard]);

  const addTodo = useCallback(async () => {
    if (!newTask.trim()) return;
    const res = await api.post("/api/workspace/todos", { task: newTask.trim() });
    if (res.success) { setNewTask(""); refetchTodos(); }
  }, [newTask, refetchTodos]);

  const toggleTodo = useCallback(async (id: string, done: boolean) => {
    await api.patch(`/api/workspace/todos/${id}`, { done: !done });
    refetchTodos();
  }, [refetchTodos]);

  const deleteTodo = useCallback(async (id: string) => {
    await api.del(`/api/workspace/todos/${id}`);
    refetchTodos();
  }, [refetchTodos]);

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
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-th-text tracking-tight">
            {greeting}, <span className="text-[#1ed760]">{"Mr "+currentBranch?.settings?.shopName || user?.name || user?.username || ""}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1.5 text-[18px] text-th-secondary">
            <Calendar className="w-3.5 h-3.5" />
            <span>{dateStr}</span>
            <span className="text-th-muted">·</span>
            <Clock className="w-3.5 h-3.5" />
            <span>{timeStr}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => navigate("/workspace")} aria-label={uiT("New Sale", "नई बिक्री")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#1ed760] text-black rounded-lg text-[18px] font-bold transition-all duration-200 active:scale-95 uppercase tracking-wider">
          <Plus className="w-3.5 h-3.5" />
          {uiT("New Sale", "नई बिक्री")}
        </button>
        <button onClick={() => setShowScanner(true)} aria-label={uiT("Scan", "स्कैन")}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-th-elevated text-th-text rounded-lg text-[18px] font-bold transition-all duration-200 active:scale-95 hover:bg-th-card uppercase tracking-wider">
          <ScanLine className="w-3.5 h-3.5" />
          {uiT("Scan", "स्कैन")}
        </button>
        <div className="w-8 h-8 rounded-full bg-[#1ed760] flex items-center justify-center text-black font-bold text-xs flex-shrink-0">S</div>
      </div>
    </div>
  );

  // Hero Section

  const renderHero = () => (
    <div className="bg-th-surface rounded-xl p-5 md:p-6 shadow-lg border border-th-border">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-[15px] font-bold text-th-muted uppercase tracking-widest">{uiT("Today's Sales", "आज की बिक्री")}</p>
            <p className="text-[26px] font-bold text-th-text tracking-tight">₹{(d.todaySales || 0).toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-th-border hidden sm:block" />
          <div>
            <p className="text-[15px] font-bold text-th-muted uppercase tracking-widest">{uiT("Collection", "संग्रह")}</p>
            <p className="text-[26px] font-bold text-th-text tracking-tight">₹{(d.todayCollection || 0).toLocaleString()}</p>
          </div>
          <div className="w-px h-8 bg-th-border hidden sm:block" />
          <div>
            <p className="text-[15px] font-bold text-th-muted uppercase tracking-widest">{uiT("Orders", "ऑर्डर")}</p>
            <p className="text-[26px] font-bold text-th-text tracking-tight">{d.todayOrders}</p>
          </div>
          <div className="w-px h-8 bg-th-border hidden sm:block" />
          <div>
            <p className="text-[15px] font-bold text-th-muted uppercase tracking-widest">{uiT("Pending", "बाकी")}</p>
            <p className="text-[26px] font-bold text-th-text tracking-tight">{d.pendingBills.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[16px] text-th-muted">
          <TrendingUp className="w-3.5 h-3.5 text-[#1ed760]" />
          {d.salesTrend === "N/A" ? "NEW" : `${Number(d.salesTrend) >= 0 ? "+" : ""}${d.salesTrend}%`} {uiT("vs last week", "पिछले सप्ताह")}
        </div>
      </div>
    </div>
  );

  // Quick Actions

  const renderQuickActions = () => (
    <div>
      <SectionHeader title={uiT("Quick Actions", "त्वरित कार्य")} />
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2">
        <QuickActionCard icon={ShoppingCart} label={uiT("New Sale", "नई बिक्री")} subtitle={uiT("Create a new order", "नया ऑर्डर बनाएं")} onClick={() => navigate("/workspace")} color="#6366f1" />
        <QuickActionCard icon={UserPlus} label={uiT("Customers", "ग्राहक")} subtitle={uiT("Manage your clients", "अपने ग्राहकों का प्रबंधन करें")} onClick={() => navigate("/customers")} color="#10b981" />
        <QuickActionCard icon={Boxes} label={uiT("Inventory", "इन्वेंट्री")} subtitle={uiT("Track stock & lenses", "स्टॉक और लेंस ट्रैक करें")} onClick={() => navigate("/inventory")} color="#f59e0b" />
        <QuickActionCard icon={BarChart3} label={uiT("Reports", "रिपोर्ट")} subtitle={uiT("View business insights", "व्यापार जानकारी देखें")} onClick={() => navigate("/reports")} color="#8b5cf6" />
        <QuickActionCard icon={Receipt} label={uiT("Bills", "बिल")} subtitle={uiT("Manage pending payments", "लंबित भुगतान प्रबंधित करें")} onClick={() => navigate("/bills")} color="#ef4444" />
        <QuickActionCard icon={ClipboardList} label={uiT("Orders", "ऑर्डर")} subtitle={uiT("View all orders", "सभी ऑर्डर देखें")} onClick={() => navigate("/orders")} color="#06b6d4" />
        <QuickActionCard icon={ScanLine} label={uiT("Scanner", "स्कैनर")} subtitle={uiT("Scan product barcodes", "उत्पाद बारकोड स्कैन करें")} onClick={() => setShowScanner(true)} color="#f97316" />
        <QuickActionCard icon={MessageSquare} label="WhatsApp" subtitle={uiT("Send messages & PDFs", "संदेश और PDF भेजें")} onClick={() => navigate("/whatsapp")} color="#22c55e" />
      </div>
    </div>
  );

  // KPI Metrics

  const renderKPIs = () => (
    <div>
      <SectionHeader title={uiT("Key Metrics", "मुख्य मापदंड")} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard label={uiT("Today's Sales", "आज की बिक्री")} value={`₹${(d.todaySales || 0).toLocaleString()}`} icon={IndianRupee} color="#10b981" trend={d.salesTrend === "N/A" ? "NEW" : `${Number(d.salesTrend) >= 0 ? "+" : ""}${d.salesTrend}%`} subtitle={uiT("vs last week", "पिछले सप्ताह की तुलना में")} />
        <MetricCard label={uiT("Today's Collection", "आज का संग्रह")} value={`₹${(d.todayCollection || 0).toLocaleString()}`} icon={IndianRupee} color="#6366f1" subtitle={uiT("today", "आज")} />
        <MetricCard label={uiT("Today's Orders", "आज के ऑर्डर")} value={d.todayOrders} icon={ShoppingBag} color="#8b5cf6" subtitle={d.weekOrders ? `${d.weekOrders} ${uiT("this week", "इस सप्ताह")}` : undefined} />
        <MetricCard label={uiT("Pending Bills", "लंबित बिल")} value={d.pendingBills.length} icon={Receipt} color="#ef4444" subtitle={`₹${(d.pendingPayments || 0).toLocaleString()} due`} />
        <MetricCard label={uiT("Ready for Pickup", "पिकअप के लिए तैयार")} value={d.readyDeliveries ?? 0} icon={PackageCheck} color="#06b6d4" subtitle={uiT("awaiting collection", "संग्रह की प्रतीक्षा में")} />
        <MetricCard label={uiT("New Customers", "नए ग्राहक")} value={d.newCustomersToday ?? 0} icon={Users} color="#10b981" subtitle={uiT("joined today", "आज जुड़े")} />
        <MetricCard label={uiT("Low Stock Items", "कम स्टॉक आइटम")} value={d.lowStock ?? 0} icon={AlertTriangle} color="#f59e0b" subtitle={uiT("items need restock", "आइटम को रीस्टॉक की आवश्यकता")} />
        <MetricCard label={uiT("Total Inventory", "कुल इन्वेंट्री")} value={d.counts.inventory} icon={Boxes} color="#f472b6" subtitle={uiT("total SKUs", "कुल SKU")} />
      </div>
    </div>
  );

  // Charts

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

  // Needs Attention

  const renderNeedsAttention = () => {
    interface AlertItem { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; label: string; value: string | number; color: string; action?: () => void; actionLabel?: string; onClick?: () => void }
    const items: AlertItem[] = [];
    if (d.pendingBills.length > 0) items.push({ icon: AlertCircle, label: uiT("Pending Bills", "लंबित बिल"), value: d.pendingBills.length, color: "red", action: () => navigate("/bills"), actionLabel: uiT("Collect", "वसूलें"), onClick: () => navigate("/bills") });
    if ((d.lowStock ?? 0) > 0) items.push({ icon: AlertTriangle, label: uiT("Low Stock Items", "कम स्टॉक आइटम"), value: d.lowStock ?? 0, color: "orange", action: () => navigate("/inventory"), actionLabel: "Restock", onClick: () => navigate("/inventory") });
    if (draftOrders.length > 0) items.push({ icon: FileText, label: uiT("Draft Orders", "ड्राफ्ट ऑर्डर"), value: draftOrders.length, color: "yellow", action: undefined, onClick: undefined });
    if (d.todayDeliveries.length > 0) items.push({ icon: Truck, label: uiT("Today's Deliveries", "आज की डिलीवरी"), value: d.todayDeliveries.length, color: "blue", action: () => navigate("/delivery"), actionLabel: "Deliver", onClick: () => navigate("/delivery") });
    if (items.length === 0) return null;
    return (
      <div>
        <SectionHeader title={uiT("Needs Attention", "ध्यान दें")} count={items.length} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
      <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg">
        <div className="px-5 py-4 border-b border-th-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-[20px] font-bold text-th-text uppercase tracking-wider">{uiT("Lens Demand", "लेंस मांग")}</h3>
              <span className="text-[16px] font-medium text-th-secondary bg-th-elevated px-2.5 py-0.5 rounded-lg">{draftOrders.length}</span>
            </div>
            <div className="flex items-center gap-2">
              {selectedOrders.size > 0 && (
                <span className="text-[16px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-2.5 py-1 rounded-lg">{selectedOrders.size} {uiT("selected", "चयनित")}</span>
              )}
              <button onClick={() => sendDemand("buy")} disabled={sendingDemand !== null || selectedOrders.size === 0} aria-label={uiT("Buy lenses", "लेंस खरीदें")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[16px] font-bold text-[#f59e0b] bg-[#f59e0b]/10 hover:bg-[#f59e0b]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 uppercase tracking-wider">
                <ShoppingBag className="w-3.5 h-3.5" />
                {sendingDemand === "buy" ? "..." : uiT("Buy", "खरीदें")}
              </button>
              <button onClick={() => sendDemand("order")} disabled={sendingDemand !== null || selectedOrders.size === 0} aria-label={uiT("Order lenses", "लेंस ऑर्डर करें")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[16px] font-bold text-[#6366f1] bg-[#6366f1]/10 hover:bg-[#6366f1]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 uppercase tracking-wider">
                <Send className="w-3.5 h-3.5" />
                {sendingDemand === "order" ? "..." : uiT("Order", "ऑर्डर")}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-[16px] font-medium text-th-secondary hover:text-th-text transition-colors">
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
                  className={`px-5 py-4 transition-all duration-150 cursor-pointer group ${isSelected ? "bg-[#1ed760]/5 border-l-2 border-l-[#1ed760]" : "hover:bg-th-card border-l-2 border-l-transparent"}`}
                  onClick={goToCustomer}>

                  {/* Line 1: Avatar + Name + Meta */}
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleOrderSelection(id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={cName || uiT("Select order", "ऑर्डर चुनें")}
                      className="w-4 h-4 rounded accent-[#1ed760] cursor-pointer flex-shrink-0" />
                    <div className="relative flex-shrink-0">
                      <UserAvatar name={cName} className="w-10 h-10 text-xs" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-th-surface flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[18px] font-bold text-th-text truncate">{cName || "—"}</p>
                        {!!(cMobile) && <span className="text-[16px] text-th-muted hidden sm:inline">{maskPhone(cMobile)}</span>}
                        <span className="text-[16px] text-th-muted hidden sm:inline">·</span>
                        <span className="text-[16px] text-th-muted">{o.createdAt ? formatTimeAgo(o.createdAt, uiT) : ""}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {!!(o.frameBrand) && <span className="text-[15px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md">{o.frameBrand?.trim()}</span>}
                        {!!(o.lensBrand) && <span className="text-[15px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md">{o.lensBrand}</span>}
                        {!!(o.lensType) && <span className="text-[15px] text-th-muted bg-th-elevated px-2 py-0.5 rounded-md">{o.lensType}</span>}
                        {!!(o.lensIndex) && <span className="text-[15px] text-th-muted bg-th-elevated px-2 py-0.5 rounded-md">{o.lensIndex}</span>}
                      </div>
                    </div>
                    <button onClick={goToCustomer} aria-label={uiT("Open", "खोलें")}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[15px] font-bold bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-all active:scale-95 uppercase tracking-wider flex-shrink-0 opacity-0 group-hover:opacity-100">
                      {uiT("Open", "खोलें")} <ArrowUpRight className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Line 2 & 3: Eye classifiers */}
                  <div className="ml-[52px] mt-3 space-y-2">
                    {/* R Eye */}
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-[#1ed760]/10 text-[#1ed760] text-[15px] font-extrabold flex items-center justify-center flex-shrink-0">R</span>
                      <span className="text-[17px] font-mono font-semibold text-th-text min-w-[120px]">{rRx || "—"}</span>
                      {inStock ? (
                        <span className="text-[14px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-1.5 py-0.5 rounded flex-shrink-0">{uiT("In Stock", "स्टॉक में")}</span>
                      ) : (
                        <span className="text-[14px] font-bold text-[#e74c3c] bg-[#e74c3c]/10 px-1.5 py-0.5 rounded flex-shrink-0">{uiT("Out", "बाहर")}</span>
                      )}
                      <SegmentedControl compact
                        options={[
                          { label: uiT("Stock", "स्टॉक"), value: "stock", color: "bg-[#1ed760] text-black" },
                          { label: uiT("Buy", "खरीदें"), value: "buy", color: "bg-[#f59e0b] text-black" },
                          { label: uiT("Order", "ऑर्डर"), value: "order", color: "bg-[#6366f1] text-white" },
                        ]}
                        value={rStatus}
                        onChange={(s) => classifyEye(id, "right", s)}
                      />
                    </div>
                    {/* L Eye */}
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-md bg-[#f59e0b]/10 text-[#f59e0b] text-[15px] font-extrabold flex items-center justify-center flex-shrink-0">L</span>
                      <span className="text-[17px] font-mono font-semibold text-th-text min-w-[120px]">{lRx || "—"}</span>
                      {inStock ? (
                        <span className="text-[14px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-1.5 py-0.5 rounded flex-shrink-0">{uiT("In Stock", "स्टॉक में")}</span>
                      ) : (
                        <span className="text-[14px] font-bold text-[#e74c3c] bg-[#e74c3c]/10 px-1.5 py-0.5 rounded flex-shrink-0">{uiT("Out", "बाहर")}</span>
                      )}
                      <SegmentedControl compact
                        options={[
                          { label: uiT("Stock", "स्टॉक"), value: "stock", color: "bg-[#1ed760] text-black" },
                          { label: uiT("Buy", "खरीदें"), value: "buy", color: "bg-[#f59e0b] text-black" },
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
    <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-th-border">
        <SectionHeader title={uiT("Recent Orders", "हाल के ऑर्डर")} count={d.recentOrders.length} action={() => navigate("/orders")} actionLabel={uiT("View all", "सभी देखें")} />
      </div>
      <div className="divide-y divide-th-border max-h-[340px] overflow-y-auto scrollbar-none">
        {d.recentOrders.length === 0 ? (
          <EmptyState icon={ClipboardList} title={uiT("No orders yet", "अभी तक कोई ऑर्डर नहीं")} description={uiT("Create your first order to get started.", "शुरू करने के लिए अपना पहला ऑर्डर बनाएं।")} actionLabel={uiT("New Order", "नया ऑर्डर")} onAction={() => navigate("/workspace")} />
        ) : d.recentOrders.map((o, idx) => {
          const custObj = typeof o.customerId === "object" && o.customerId ? o.customerId : null;
          const cName = custObj?.name ?? "—";
          const cMobile = custObj?.mobile ?? "";
          return (
            <div key={o._id || idx} className="flex items-center gap-3 px-5 py-3.5 hover:bg-th-card transition-all cursor-pointer" onClick={() => navigate(`/workspace?order=${o._id}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/workspace?order=${o._id}`)}>
              <div className="relative flex-shrink-0">
                <UserAvatar name={cName} className="w-10 h-10 text-sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-th-surface flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full ${o.status === "Delivered" ? "bg-[#1ed760]" : o.status === "Draft" ? "bg-th-muted" : o.status === "Ordered" ? "bg-[#a78bfa]" : o.status === "Ready" ? "bg-[#3498db]" : "bg-[#f59e0b]"}`} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[18px] font-semibold text-th-text truncate">{cName}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[16px] text-th-secondary">{o.createdAt ? formatTimeAgo(o.createdAt, uiT) : ""}</span>
                  {!!(o.frameBrand) && <span className="text-[15px] text-th-muted bg-th-elevated px-1.5 py-0.5 rounded">{o.frameBrand}</span>}
                  {!!(o.lensBrand) && <span className="text-[15px] text-th-muted bg-th-elevated px-1.5 py-0.5 rounded">{o.lensBrand}</span>}
                </div>
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
    <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-th-card">
        <SectionHeader title={uiT("Pending Bills", "लंबित बिल")} count={d.pendingBills.length} action={() => navigate("/bills")} actionLabel={uiT("View all", "सभी देखें")} />
      </div>
      <div className="divide-y divide-th-card max-h-[340px] overflow-y-auto scrollbar-none">
        {d.pendingBills.length === 0 ? (
          <EmptyState icon={IndianRupee} title={uiT("All bills cleared", "सभी बिल चुकता")} description={uiT("No pending bills to collect.", "कोई लंबित बिल नहीं।")} />
        ) : d.pendingBills.slice(0, 6).map((b, idx) => {
          const custObj = typeof b.customerId === "object" && b.customerId ? b.customerId : null;
          const cName = custObj?.name ?? "—";
          const cMobile = custObj?.mobile ?? "";
          return (
            <div key={b._id || idx} className="flex items-center gap-3 px-5 py-4 hover:bg-th-card transition-all">
              <UserAvatar name={cName} className="w-10 h-10 text-sm" />
              <div className="flex-1 min-w-0">
                <p className="text-[18px] font-semibold text-th-text truncate">{cName}</p>
                {!!(cMobile) && <p className="text-[16px] text-th-secondary mt-0.5">{maskPhone(cMobile)}</p>}
              </div>
              <div className="text-right flex items-center gap-3 flex-shrink-0">
                <p className="text-[20px] font-bold text-[#e74c3c] whitespace-nowrap">₹{(b.pendingAmount || 0).toLocaleString()}</p>
                <button onClick={() => navigate(`/bills?id=${b._id}`)} aria-label={uiT("Collect payment", "भुगतान वसूलें")}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[18px] font-bold bg-[#e74c3c]/10 text-[#e74c3c] hover:bg-[#e74c3c]/20 transition-all duration-200 active:scale-95 uppercase tracking-wider">
                  {uiT("Collect", "वसूलें")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Today's Deliveries

  const renderDeliveries = () => (
    <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-th-card">
        <SectionHeader title={uiT("Today's Deliveries", "आज की डिलीवरी")} count={d.todayDeliveries.length} action={() => navigate("/delivery")} actionLabel={uiT("View all", "सभी देखें")} />
      </div>
      <div className="divide-y divide-th-card max-h-[340px] overflow-y-auto scrollbar-none">
        {d.todayDeliveries.length === 0 ? (
          <EmptyState icon={Truck} title={uiT("No deliveries today", "आज कोई डिलीवरी नहीं")} description={uiT("All deliveries for today are completed.", "आज की सभी डिलीवरी पूर्ण हो गई हैं।")} />
        ) : d.todayDeliveries.map((dl, idx) => {
          const custObj = typeof dl.customerId === "object" && dl.customerId ? dl.customerId : null;
          const cName = custObj?.name ?? "—";
          const cMobile = custObj?.mobile ?? "";
          return (
            <div key={dl._id || idx} className="flex items-center gap-3 px-5 py-4 hover:bg-th-card transition-all">
              <div className="relative flex-shrink-0">
                <UserAvatar name={cName} className="w-10 h-10 text-sm" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-th-surface flex items-center justify-center">
                  <div className={`w-2 h-2 rounded-full ${dl.status === "Delivered" ? "bg-[#1ed760]" : dl.status === "Ready" ? "bg-[#3498db]" : "bg-[#f59e0b]"}`} />
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[18px] font-semibold text-th-text truncate">{cName}</p>
                {!!(cMobile) && <p className="text-[16px] text-th-secondary mt-0.5">{maskPhone(cMobile)}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge status={dl.status || "—"} />
                <button onClick={() => navigate(`/delivery?order=${dl._id}`)} aria-label={uiT("Deliver", "डिलीवर")}
                  className="p-2.5 rounded-lg text-[18px] font-bold bg-[#1ed760]/10 text-[#1ed760] hover:bg-[#1ed760]/20 transition-all duration-200 active:scale-95">
                  <PackageCheck className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Today's Delivered

  const renderTodayDelivered = () => {
    const delivered = d.todayDeliveredOrders || [];
    if (delivered.length === 0) return null;
    return (
      <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg border border-[#1ed760]/20">
        <div className="px-5 py-4 border-b border-[#1ed760]/15 bg-gradient-to-r from-[#1ed760]/5 to-transparent">
          <SectionHeader title={uiT("Today's Delivered", "आज डिलीवर हुए")} count={delivered.length} action={() => navigate("/delivery")} actionLabel={uiT("View all", "सभी देखें")} />
        </div>
        <div className="divide-y divide-th-card max-h-[340px] overflow-y-auto scrollbar-none">
          {delivered.map((o, idx) => {
            const custObj = typeof o.customerId === "object" && o.customerId ? o.customerId : null;
            const cName = custObj?.name ?? "—";
            const cMobile = custObj?.mobile ?? "";
            return (
              <div key={o._id || idx} className="flex items-center gap-3 px-5 py-4 hover:bg-th-card transition-all cursor-pointer" onClick={() => navigate(`/customers/${custObj?._id ?? ""}?visitId=${o.visitId || ""}`)}>
                <div className="relative flex-shrink-0">
                  <UserAvatar name={cName} className="w-10 h-10 text-sm" />
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-th-surface flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-[#1ed760]" />
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-[18px] font-semibold text-th-text truncate">{cName}</p>
                    {!!(cMobile) && <span className="text-[16px] text-th-muted hidden sm:inline">{maskPhone(cMobile)}</span>}
                  </div>
                  <p className="text-[16px] text-th-secondary mt-0.5">
                    {!!(o.frameBrand) ? `${o.frameBrand}` : ""}
                    {!!(o.frameBrand) && !!(o.lensBrand) ? " · " : ""}
                    {!!(o.lensBrand) ? `${o.lensBrand}` : ""}
                    {!o.frameBrand && !o.lensBrand ? (o.createdAt ? formatTimeAgo(o.createdAt, uiT) : "") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[20px] font-bold text-th-text">₹{(o.billInfo?.totalAmount ?? 0).toLocaleString()}</span>
                  <StatusBadge status="Delivered" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Recent Customers

  const renderRecentCustomers = () => (
    <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg">
      <div className="px-5 py-4 border-b border-th-card">
        <SectionHeader title={uiT("Recent Customers", "हाल के ग्राहक")} count={d.recentCustomers.length} action={() => navigate("/customers")} actionLabel={uiT("View all", "सभी देखें")} />
      </div>
      <div className="divide-y divide-th-card max-h-[340px] overflow-y-auto scrollbar-none">
        {d.recentCustomers.length === 0 ? (
          <EmptyState icon={Users} title={uiT("No customers yet", "अभी तक कोई ग्राहक नहीं")} description={uiT("Start by adding your first customer.", "अपना पहला ग्राहक जोड़कर शुरू करें।")} actionLabel={uiT("Add Customer", "ग्राहक जोड़ें")} onAction={() => navigate("/customers")} />
        ) : d.recentCustomers.map((c, idx) => (
          <div key={c._id || idx} className="flex items-center gap-3 px-5 py-4 hover:bg-th-card transition-all cursor-pointer" onClick={() => navigate(`/customers/${c._id}`)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(`/customers/${c._id}`)}>
            <UserAvatar name={c.name || "?"} className="w-10 h-10 text-sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[18px] font-semibold text-th-text truncate">{v(c.name)}</p>
              <p className="text-[16px] text-th-secondary mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{c.mobile ? maskPhone(c.mobile) : "—"}</span>
                <span className="text-th-muted">·</span>
                <span>{c.createdAt ? formatTimeAgo(c.createdAt, uiT) : ""}</span>
                <span className="text-th-muted">·</span>
                <span>{c.totalVisits ?? 0} {uiT("visits", "विज़िट")}</span>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-[20px] font-bold text-th-text">₹{(c.totalSpent || 0).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Todo

  const renderTodo = () => (
    <div className="bg-th-surface rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1ed760]/10 flex items-center justify-center">
            <CheckSquare className="w-4 h-4 text-[#1ed760]" />
          </div>
          <h3 className="text-[20px] font-bold text-th-text uppercase tracking-wider">{uiT("To-Do", "कार्य सूची")}</h3>
        </div>
        <span className="text-[16px] font-bold text-th-secondary bg-th-elevated px-2.5 py-1 rounded-lg">{activeTodos.length} {uiT("pending", "बाकी")}</span>
      </div>
      <div className="flex items-center gap-2 mb-4">
        <input type="text" placeholder={uiT("Add a task...", "कार्य जोड़ें...")} value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          aria-label={uiT("Add a task", "कार्य जोड़ें")}
          className="flex-1 px-4 py-2.5 bg-th-elevated border border-th-card rounded-lg text-[18px] text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" />
        <button onClick={addTodo} disabled={!newTask.trim()} aria-label={uiT("Add task", "कार्य जोड़ें")}
          className="p-2.5 rounded-lg bg-[#1ed760]/10 hover:bg-[#1ed760]/20 disabled:opacity-40 text-[#1ed760] transition-all active:scale-95">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="space-y-1 max-h-[260px] overflow-y-auto scrollbar-none pr-1">
        {todos.length === 0 ? (
          <EmptyState icon={CheckSquare} title={uiT("No tasks yet", "अभी तक कोई कार्य नहीं")} description={uiT("Add a task above to get started.", "शुरू करने के लिए ऊपर एक कार्य जोड़ें।")} />
        ) : (
          [...activeTodos, ...doneTodos].map((t) => (
            <div key={t._id} className={`flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-th-card group transition-all ${t.done ? "opacity-40" : ""}`}>
              <button onClick={() => toggleTodo(t._id, t.done)} aria-label={t.done ? uiT("Mark incomplete", "अपूर्ण चिह्नित करें") : uiT("Mark complete", "पूर्ण चिह्नित करें")}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${t.done ? "bg-[#1ed760] border-[#1ed760]" : "border-th-muted hover:border-[#1ed760]"}`}>
                {t.done && <Check className="w-3 h-3 text-th-text" />}
              </button>
              <span className={`flex-1 text-[18px] truncate ${t.done ? "line-through text-th-muted" : "text-th-secondary"}`}>{t.task}</span>
              <button onClick={() => deleteTodo(t._id)} aria-label="Delete task" className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[#e74c3c]/10 text-th-muted hover:text-[#e74c3c] transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Payments

  const renderPayments = () => {
    if (!d.paymentModeSplit?.length) return null;
    return (
      <div className="bg-th-surface rounded-xl p-5 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#1ed760]/10 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-[#1ed760]" />
          </div>
          <h3 className="text-[20px] font-bold text-th-text uppercase tracking-wider">{uiT("Today's Payments", "आज का भुगतान")}</h3>
        </div>
        <div className="space-y-2.5">
          {d.paymentModeSplit.map((p, idx) => {
            const Icon = paymentModeIcon[p.mode] || IndianRupee;
            return (
              <div key={`${p.mode}-${idx}`} className="flex items-center gap-3 bg-th-elevated rounded-lg px-4 py-3 transition-all hover:bg-th-card">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${paymentModeColors[p.mode] || "#1ed760"}15` }}>
                  <Icon className="w-4 h-4" style={{ color: paymentModeColors[p.mode] || "#1ed760" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[18px] font-semibold text-th-text">{p.mode}</p>
                  <p className="text-[16px] text-th-secondary">{p.count} transaction{p.count !== 1 ? "s" : ""}</p>
                </div>
                <p className="text-[20px] font-bold text-th-text flex-shrink-0">₹{p.total.toLocaleString()}</p>
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
      { label: uiT("Pending Bills", "बाकी बिल"), value: d.pendingBills.length, color: "#f87171" },
      { label: uiT("Today Deliveries", "आज की डिलीवरी"), value: d.todayDeliveries.length, color: "#2dd4bf" },
    ];

    return (
      <details className="group bg-th-surface rounded-xl overflow-hidden shadow-lg">
        <summary className="flex items-center gap-3 px-6 py-4 cursor-pointer list-none hover:bg-th-card transition-colors">
          <ChevronRight className="w-4 h-4 text-th-muted transition-transform duration-300 group-open:rotate-90" />
          <div className="flex items-center gap-2">
            <LayoutDashboard className="w-4 h-4 text-th-secondary" />
            <span className="text-[18px] font-bold text-th-text uppercase tracking-wider">{uiT("Summary", "सारांश")}</span>
          </div>
          <span className="text-[16px] text-th-muted">({rows.length} metrics)</span>
        </summary>
        <div className="px-6 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-0.5 pt-3 border-t border-th-card">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between py-1.5 border-b border-th-elevated last:border-0">
                <span className="text-[18px] text-th-secondary">{r.label}</span>
                <span className="text-[18px] font-bold text-th-text" style={r.color ? { color: r.color } : undefined}>{r.value}</span>
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
      <div className="max-w-7xl mx-auto space-y-6 px-4 md:px-6 py-6 md:py-8">
        {renderHeader()}
        {renderHero()}
        {renderQuickActions()}
        {renderKPIs()}
        {renderCharts()}
        {renderNeedsAttention()}

        {/* Lens Demand + Recent Orders side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {renderLensDemand()}
          {renderRecentOrders()}
        </div>

        {/* Bottom grid: Pending Bills, Today's Deliveries */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {renderPendingBills()}
          {renderDeliveries()}
        </div>

        {/* Today's Delivered */}
        {renderTodayDelivered()}

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

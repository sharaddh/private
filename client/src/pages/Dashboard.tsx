import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApiGet } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import PageSkeleton from "../components/PageSkeleton";
import CameraScanner from "../components/CameraScanner";
import { SalesTrendChart, OrderStatusDonut } from "../components/DashboardCharts";
import { useToast } from "../context/ToastContext";
import {
  TrendingUp, ArrowRight, AlertTriangle, Wallet,
  Glasses, Eye, ChevronDown, ChevronUp, Send,
  Bell, ShoppingCart, Plus, Check, Trash2,
  ScanLine, Package, Printer,
} from "lucide-react";

const v = <T,>(val: T | null | undefined, fallback: T | string = "—"): T | string => val ?? fallback;
const maskPhone = (p: string): string => {
  if (!p || p.length < 6) return v(p);
  return p.slice(0, 3) + "****" + p.slice(-3);
};

interface DashboardData {
  counts: { customers: number; orders: number; bills: number; payments: number; inventory: number; deliveries: number; visits: number; };
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

export default function Dashboard() {
  const { data, loading, refetch } = useApiGet<DashboardData>("/api/dashboard/stats");
  const [todos, setTodos] = useState<Record<string, unknown>[]>([]);
  const [newTask, setNewTask] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [sendingDemand, setSendingDemand] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [hasDataOnce, setHasDataOnce] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { isStaff } = useAuth();
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

  const toggleExpand = useCallback((id: string) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const classifyOrder = useCallback(async (id: string, classification: string) => {
    const res = await api.patch(`/api/orders/${id}/classify`, { classification });
    if (res.success) refetch();
  }, [refetch]);

  const sendDemand = useCallback(async (type: "buy" | "order") => {
    setSendingDemand(type);
    const res = await api.post("/api/orders/demand-send", { type });
    setSendingDemand(null);
    if (res.success) {
      const d = res.data as Record<string, unknown> || res;
      if (d.sent) toast.success(`${type === "buy" ? "Purchase" : "Lab Order"} list sent to your WhatsApp!`);
      else if (d.waConnected === false) toast.error("WhatsApp not connected. Scan QR code on WhatsApp page.");
      else if (d.queued) toast.info(`${type === "buy" ? "Purchase" : "Lab Order"} list queued — will send when connected`);
      else toast.error(`PDF generated but send failed${d.sendError ? `: ${d.sendError}` : ""}`);
    } else toast.error(res.message || "Failed to send");
  }, [toast]);

  if (loading && !hasDataOnce) return <PageSkeleton page="dashboard" />;
  if (!data) return null;

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  const incompleteCount = data.incompleteOrders.length;
  const pendingBillsCount = data.pendingBills.length;
  const pickupCount = data.readyDeliveries ?? 0;
  const notificationCount = incompleteCount + pendingBillsCount;

  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  const formatTimeAgo = (dateStr: string): string => {
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="min-h-screen" style={{ background: "#121212" }}>
      <div className="max-w-6xl mx-auto space-y-8 px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">{greeting}, Store Manager</h1>
            <p className="text-sm text-white/50 mt-0.5">{dateStr} &bull; {timeStr}</p>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative">
              <Bell size={22} className="text-white/70 hover:text-white transition-all" />
              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center shadow-lg shadow-red-500/30">{notificationCount > 9 ? "9+" : notificationCount}</span>
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white font-bold text-sm ring-2 ring-white/20 shadow-lg cursor-pointer hover:ring-white/40 transition-all">
              SM
            </div>
          </div>
        </div>

        {!isStaff && (
          <>
            {/* Hero Metric Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="hero-card-sales rounded-2xl p-6" style={{ boxShadow: "0 0 40px rgba(0, 230, 118, 0.15)" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium tracking-wider text-white/60 uppercase">Total Sales</span>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                    <TrendingUp size={20} className="text-emerald-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight mb-2">₹{(data.todaySales || 0).toLocaleString()}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md">+12% vs last week</span>
                </div>
              </div>

              <div className="hero-card-orders rounded-2xl p-6" style={{ boxShadow: "0 0 40px rgba(255, 171, 0, 0.15)" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium tracking-wider text-white/60 uppercase">Orders in Progress</span>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <ShoppingCart size={20} className="text-amber-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight mb-2">{v(incompleteCount)}</p>
                <div className="flex items-center gap-2">
                  <AlertTriangle size={13} className="text-amber-400" />
                  <span className="text-xs font-medium text-amber-400">Attention Needed</span>
                </div>
              </div>

              <div className="hero-card-payments rounded-2xl p-6" style={{ boxShadow: "0 0 40px rgba(255, 82, 82, 0.15)" }}>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium tracking-wider text-white/60 uppercase">Pending Payments</span>
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <Wallet size={20} className="text-red-400" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white tracking-tight mb-2">₹{(data.pendingPayments || 0).toLocaleString()}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-red-400">Urgent — needs resolution</span>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-3">
                <SalesTrendChart data={data.dailySales} />
              </div>
              <div className="lg:col-span-2">
                <OrderStatusDonut data={data.orderStatusCounts} />
              </div>
            </div>
          </>
        )}

        {/* Split View: Incomplete Orders + Pending Bills */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left Panel — Incomplete Orders */}
          <div className="lg:col-span-3 glass-card p-0 overflow-hidden border-l-4 border-l-amber-500/60">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white">{v(incompleteCount)} Orders Need Attention</h3>
                <p className="text-xs text-white/40 mt-0.5">Resume these orders to keep things moving</p>
              </div>
              <button onClick={() => navigate("/orders")}
                className="text-xs font-medium text-primary-400 hover:text-primary-300 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 transition-all">
                View all <ArrowRight size={13} />
              </button>
            </div>
            {data.incompleteOrders.length > 0 && (
              <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap border-b border-white/[0.06]">
                {(["pending", "stock", "buy", "order"] as const).map((c) => {
                  const count = data.incompleteOrders.filter((o) => (o.classification || "pending") === c).length;
                  const colors: Record<string, string> = {
                    pending: "bg-white/5 text-white/50",
                    stock: "bg-emerald-500/15 text-emerald-300",
                    buy: "bg-amber-500/15 text-amber-300",
                    order: "bg-blue-500/15 text-blue-300",
                  };
                  return (
                    <span key={c} className={`text-[11px] font-medium px-2 py-0.5 rounded ${colors[c]}`}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}: {count}
                    </span>
                  );
                })}
                <div className="flex-1" />
                {(["buy", "order"] as const).map((type) => {
                  const hasItems = data.incompleteOrders.some((o) => (o.classification || "pending") === type);
                  return hasItems ? (
                    <button key={type} onClick={() => sendDemand(type)} disabled={sendingDemand === type}
                      className={`px-3 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${type === "buy" ? "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30" : "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"}`}>
                      <Send size={12} />
                      {sendingDemand === type ? "Sending..." : `Send ${type === "buy" ? "Purchase" : "Lab Order"}`}
                    </button>
                  ) : null;
                })}
              </div>
            )}
            <div className="divide-y divide-white/[0.04] max-h-[420px] overflow-y-auto scrollbar-thin">
              {data.incompleteOrders.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-8">All orders complete</p>
              ) : (
                data.incompleteOrders.map((o) => {
                  const cName = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).name as string : "";
                  const cMobile = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).mobile as string : "";
                  const isExpanded = expandedOrders.has(o._id as string);
                  const demand = o.prescription ? buildDemand(o.prescription, o) : null;
                  const cls = (o.classification as string) || "pending";
                  return (
                    <div key={o._id as string}>
                      <div className="px-5 py-3.5 hover:bg-white/[0.03] transition-all">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-xs font-bold flex-shrink-0">
                              {(cName?.charAt(0) || "?").toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white truncate">{v(cName)}</span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${o.status === "Draft" ? "bg-white/10 text-white/50" : o.status === "Ordered" ? "bg-purple-500/20 text-purple-300" : "bg-amber-500/20 text-amber-300"}`}>{v(o.status as string, "Draft")}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-white/40 mt-0.5">
                                {cMobile && <span>{maskPhone(cMobile)}</span>}
                                {o.createdAt && <span>&bull; {formatTimeAgo(o.createdAt as string)}</span>}
                                {o.frameBrand && <span><Glasses size={10} className="inline mr-0.5" />{o.frameBrand as string}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button onClick={() => navigate(`/workspace?order=${o._id as string}`)}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-primary-500/20 text-primary-300 hover:bg-primary-500/30 border border-primary-500/20 transition-all">
                              Resume Order
                            </button>
                            <button onClick={() => toggleExpand(o._id as string)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-all">
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="mt-3 pt-3 border-t border-white/[0.06] grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
                            {demand && <div className="col-span-full text-xs font-medium text-white/60 mb-1">{demand.heading} — {demand.lines.join(", ")}{demand.footer ? ` (${demand.footer})` : ""}</div>}
                            {!demand && o.lensBrand && <Detail label="Lens" value={o.lensBrand as string} />}
                            {o.frameBrand && <Detail label="Frame" value={`${o.frameBrand as string}${o.frameModel ? ` (${o.frameModel as string})` : ""}`} />}
                            {o.frameColor && <Detail label="Color" value={o.frameColor as string} />}
                            {o.frameSize && <Detail label="Size" value={o.frameSize as string} />}
                            {o.framePrice != null && <Detail label="Frame Price" value={`₹${(o.framePrice as number).toLocaleString()}`} />}
                            {o.lensType && <Detail label="Lens Type" value={o.lensType as string} />}
                            {o.lensIndex && <Detail label="Index" value={o.lensIndex as string} />}
                            {o.lensPrice != null && <Detail label="Lens Price" value={`₹${(o.lensPrice as number).toLocaleString()}`} />}
                            {o.coating && <Detail label="Coating" value={o.coating as string} />}
                            {(o.accessories as string[])?.length > 0 && <Detail label="Accessories" value={(o.accessories as string[]).join(", ")} />}
                            {o.quantity != null && <Detail label="Qty" value={String(o.quantity)} />}
                            {o.labAssigned && <Detail label="Lab" value={o.labAssigned as string} />}
                            {o.labExpectedDate && <Detail label="Lab ETA" value={new Date(o.labExpectedDate as string).toLocaleDateString("en-IN")} />}
                            {o.deliveryDate && <Detail label="Delivery" value={new Date(o.deliveryDate as string).toLocaleDateString("en-IN")} />}
                            <div className="col-span-full flex items-center gap-2 mt-1">
                              {(["stock", "order", "buy"] as const).map((c) => (
                                <button key={c} onClick={() => classifyOrder(o._id as string, cls === c ? "pending" : c)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all duration-150 ${
                                    cls === c
                                      ? c === "stock" ? "bg-emerald-500/30 text-emerald-300"
                                        : c === "order" ? "bg-blue-500/30 text-blue-300"
                                        : "bg-amber-500/30 text-amber-300"
                                      : "bg-white/5 text-white/40 border border-white/10 hover:bg-white/10"
                                  }`}>
                                  {c === "stock" ? "Stock" : c === "order" ? "Order" : "Buy"}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel — Pending Bills + Quick Actions */}
          <div className="lg:col-span-2 space-y-5">
            {/* Pending Bills */}
            <div className="glass-card p-0 overflow-hidden border-l-4 border-l-red-500/60">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
                <div>
                  <h3 className="text-sm font-bold text-white">Outstanding Bills</h3>
                  <p className="text-xs text-white/40 mt-0.5">{v(pendingBillsCount)} bills pending</p>
                </div>
                <button onClick={() => navigate("/bills")}
                  className="text-xs font-medium text-primary-400 hover:text-primary-300 px-3 py-1.5 rounded-lg bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 transition-all">
                  View all
                </button>
              </div>
              <div className="divide-y divide-white/[0.04] max-h-[280px] overflow-y-auto scrollbar-thin">
                {data.pendingBills.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-8">No pending bills</p>
                ) : (
                  data.pendingBills.slice(0, 6).map((b) => {
                    const cName = typeof b.customerId === "object" && b.customerId ? (b.customerId as Record<string, unknown>).name as string : "";
                    const cMobile = typeof b.customerId === "object" && b.customerId ? (b.customerId as Record<string, unknown>).mobile as string : "";
                    return (
                      <div key={v(b._id as string)} className="px-5 py-3.5 hover:bg-white/[0.03] transition-all">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-white">{cName || "—"}</p>
                            {cMobile && <p className="text-xs text-white/40 mt-0.5">{maskPhone(cMobile)}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-red-400">₹{((b.pendingAmount as number) || 0).toLocaleString()}</p>
                            <button
                              className="text-[11px] font-medium text-primary-400 hover:text-primary-300 mt-1 px-2 py-0.5 rounded bg-primary-500/10 hover:bg-primary-500/20 border border-primary-500/20 transition-all">
                              Send Reminder
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Low Stock Alert */}
            {(data.lowStock ?? 0) > 0 && (
              <div className="glass-card border-l-4 border-l-red-500/60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle size={18} className="text-red-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-white">Low Stock Alert</p>
                    <p className="text-xs text-white/50">{v(data.lowStock)} items running low</p>
                  </div>
                  <button onClick={() => navigate("/inventory")}
                    className="text-xs font-medium text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all">
                    View
                  </button>
                </div>
              </div>
            )}

            {/* To-Do */}
            <div className="glass-card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-white">To-Do</h3>
                <span className="text-xs font-medium text-white/50 bg-white/10 px-2 py-0.5 rounded">{activeTodos.length} pending</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <input type="text" placeholder="Add a task..." value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTodo()}
                  className="pos-input flex-1" />
                <button onClick={addTodo} disabled={!newTask.trim()}
                  className="p-2.5 bg-primary-500/20 hover:bg-primary-500/30 disabled:opacity-40 rounded-xl text-primary-300 border border-primary-500/20 transition-all">
                  <Plus size={16} />
                </button>
              </div>
              <div className="space-y-0.5 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
                {todos.length === 0 ? (
                  <p className="text-white/30 text-sm text-center py-4">No tasks yet</p>
                ) : (
                  [...activeTodos, ...doneTodos].map((t) => (
                    <div key={t._id as string} className={`flex items-center gap-2 py-2 px-2.5 rounded-lg hover:bg-white/[0.04] group transition-all ${t.done ? "opacity-40" : ""}`}>
                      <button onClick={() => toggleTodo(t._id as string, t.done as boolean)}
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${t.done ? "bg-emerald-500/50 border-emerald-500/50" : "border-white/20 hover:border-primary-400"}`}>
                        {t.done && <Check size={10} className="text-white" />}
                      </button>
                      <span className={`flex-1 text-sm truncate ${t.done ? "line-through text-white/30" : "text-white/70"}`}>
                        {t.task as string}
                      </span>
                      <button onClick={() => deleteTodo(t._id as string)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Quick Actions */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        <button onClick={() => navigate("/workspace")} title="New Sale"
          className="floating-action-btn bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/20 hover:shadow-primary-500/40">
          <Plus size={22} />
        </button>
        <button onClick={() => setShowScanner(true)} title="Scan Barcode"
          className="floating-action-btn bg-white/10 text-white/80 hover:bg-white/20 hover:text-white">
          <ScanLine size={22} />
        </button>
        <button onClick={() => navigate("/inventory")} title="View Inventory"
          className="floating-action-btn bg-white/10 text-white/80 hover:bg-white/20 hover:text-white">
          <Package size={20} />
        </button>
        <button onClick={() => navigate("/reports")} title="Print Report"
          className="floating-action-btn bg-white/10 text-white/80 hover:bg-white/20 hover:text-white">
          <Printer size={20} />
        </button>
      </div>

      {showScanner && (
        <CameraScanner
          onScan={(code) => {
            setShowScanner(false);
            navigate(`/inventory/scan/${encodeURIComponent(code)}`);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

function formatRx(sph?: number, cyl?: number, axis?: number): string {
  const s = sph != null ? (sph > 0 ? `+${sph}` : `${sph}`) : "";
  const c = cyl != null ? (cyl > 0 ? `+${cyl}` : `${cyl}`) : "";
  const a = axis != null ? `×${axis}` : "";
  if (!s && !c) return "—";
  return `${s}${c ? ` / ${c}` : ""}${a ? ` ${a}` : ""}`;
}

function buildDemand(rx: Record<string, unknown>, order: Record<string, unknown>): { heading: string; lines: string[]; footer: string } | null {
  const right = rx?.rightEye as Record<string, unknown> | undefined;
  const left = rx?.leftEye as Record<string, unknown> | undefined;
  const rDV = right?.dv as Record<string, unknown> | undefined;
  const lDV = left?.dv as Record<string, unknown> | undefined;
  const rNV = right?.nv as Record<string, unknown> | undefined;
  const lNV = left?.nv as Record<string, unknown> | undefined;

  const hasRx = rDV?.sph != null || lDV?.sph != null || rNV?.sph != null || lNV?.sph != null;
  if (!hasRx) return null;

  const lensLabel = [order.lensBrand, order.lensType, order.lensIndex].filter(Boolean).join(" ") || "";

  function rxStr(e: string, dv: Record<string, unknown> | undefined, nv: Record<string, unknown> | undefined): string {
    const parts: string[] = [];
    if (dv?.sph != null) {
      let s = formatRx(dv.sph as number, dv.cyl as number, dv.axis as number);
      if (dv.va) s += ` VA:${dv.va}`;
      parts.push(s);
    }
    if (nv?.sph != null) {
      let s = formatRx(nv.sph as number, nv.cyl as number, nv.axis as number);
      if (dv?.sph != null && nv.sph !== dv.sph) {
        const add = ((nv.sph as number) - (dv.sph as number)).toFixed(2);
        s += ` Add ${add}`;
      }
      if (nv.va) s += ` VA:${nv.va}`;
      parts.push(s);
    }
    return parts.join(" | ");
  }

  function eyeMatch(a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.sph === b.sph && a.cyl === b.cyl && a.axis === b.axis;
  }

  const sameRx = eyeMatch(rDV, lDV) && eyeMatch(rNV, lNV);
  const heading = sameRx ? `1p ${lensLabel}`.trim() : `1/2p ${lensLabel}`.trim();

  const lines: string[] = [];
  if (sameRx) {
    const rxLine = rxStr("R", rDV || lDV, rNV || lNV);
    if (rxLine) lines.push(rxLine);
  } else {
    const rLine = rxStr("R", rDV, rNV);
    const lLine = rxStr("L", lDV, lNV);
    if (rLine) lines.push(`R: ${rLine}`);
    if (lLine) lines.push(`L: ${lLine}`);
  }

  const coating = order.coating ? `Coating: ${order.coating}` : "";
  const pd = rx.pd ? `PD ${rx.pd}` : "";
  const footer = [coating, pd].filter(Boolean).join(" · ");

  return { heading, lines, footer };
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-400">{label}:</span>
      <span className="font-medium text-gray-700 dark:text-gray-300">{value}</span>
    </div>
  );
}

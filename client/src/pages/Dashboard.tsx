import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApiGet } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import PageSkeleton from "../components/PageSkeleton";
import CameraScanner from "../components/CameraScanner";
import { SalesTrendChart, PaymentModeChart, OrderStatusChart } from "../components/DashboardCharts";
import { useToast } from "../context/ToastContext";
import {
  Users, ShoppingCart, FileText, Package, Truck,
  TrendingUp, Clock, AlertTriangle, ArrowRight,
  Glasses, Eye, Plus, Check, Trash2,
  Search, ChevronDown, ChevronUp, Send, FlaskConical, QrCode,
} from "lucide-react";

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
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
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

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const salesValue = period === "today" ? data.todaySales : period === "week" ? data.weekSales : data.monthSales;
  const collectionValue = period === "today" ? data.todayCollection : 0;
  const ordersValue = period === "today" ? data.todayOrders : period === "week" ? data.weekOrders : data.monthOrders;
  const billsValue = period === "today" ? data.todayBills : period === "week" ? data.weekBills : data.monthBills;

  const periodLabel = period === "today" ? "Today" : period === "week" ? "This Week" : "This Month";

  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{greeting}!</h1>
          <p className="page-subtitle">Here's what's happening at your shop.</p>
        </div>
        <button onClick={() => setShowScanner(true)} className="btn-primary flex items-center gap-2.5 px-5 py-2.5 text-sm font-semibold rounded-xl">
          <QrCode size={20} /> Scan Barcode
        </button>
      </div>

      {!isStaff && (
        <>
          {/* Time period selector */}
          <div className="flex items-center gap-2">
            {(["today", "week", "month"] as const).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 ${
                  period === p
                    ? "bg-primary-600 text-white shadow-md"
                    : "bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700"
                }`}>
                {p === "today" ? "Today" : p === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>

          {/* Main stat cards — key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title={`${periodLabel} Sales`} value={`₹${(salesValue || 0).toLocaleString()}`} icon={<TrendingUp size={22} />} color="primary" />
            <StatCard title={`Collection`} value={`₹${(collectionValue || 0).toLocaleString()}`} icon={<TrendingUp size={22} />} color="emerald" />
            <StatCard title="Pending" value={`₹${(data.pendingPayments || 0).toLocaleString()}`} icon={<Clock size={22} />} color="amber" />
            <StatCard title="Low Stock" value={data.lowStock || 0} icon={<AlertTriangle size={22} />} color="red" onClick={() => navigate("/inventory")} />
          </div>

          {/* Navigation stat cards — larger, clickable */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            <button onClick={() => navigate("/customers")}
              className="card text-center py-5 px-3 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="w-12 h-12 bg-primary-50 dark:bg-primary-900/20 rounded-2xl flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform">
                <Users size={22} className="text-primary-600 dark:text-primary-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.counts.customers}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">Customers</p>
              {data.newCustomersToday > 0 && <p className="text-[11px] text-primary-500 font-semibold mt-0.5">+{data.newCustomersToday} today</p>}
            </button>
            <button onClick={() => navigate("/orders")}
              className="card text-center py-5 px-3 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform">
                <ShoppingCart size={22} className="text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.counts.orders}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">Orders</p>
              <p className="text-[11px] text-blue-500 font-semibold mt-0.5">+{ordersValue} {periodLabel.toLowerCase()}</p>
            </button>
            <button onClick={() => navigate("/bills")}
              className="card text-center py-5 px-3 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform">
                <FileText size={22} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.counts.bills}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">Bills</p>
              {data.todaySales > 0 && <p className="text-[11px] text-emerald-500 font-semibold mt-0.5">₹{(data.todaySales / (data.todayBills || 1)).toFixed(0)} avg</p>}
            </button>
            <button onClick={() => navigate("/pickup")}
              className="card text-center py-5 px-3 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform">
                <Truck size={22} className="text-purple-600 dark:text-purple-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.readyDeliveries || 0}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">Ready</p>
              <p className="text-[11px] text-purple-500 font-semibold mt-0.5">for pickup</p>
            </button>
            <button onClick={() => navigate("/inventory")}
              className="card text-center py-5 px-3 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group">
              <div className="w-12 h-12 bg-cyan-50 dark:bg-cyan-900/20 rounded-2xl flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform">
                <Package size={22} className="text-cyan-600 dark:text-cyan-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.counts.inventory}</p>
              <p className="text-sm font-medium text-gray-500 mt-1">Inventory</p>
              <p className="text-[11px] text-red-500 font-semibold mt-0.5">{data.lowStock} low stock</p>
            </button>
          </div>

          {/* Charts section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SalesTrendChart data={data.dailySales} />
            </div>
            <div className="space-y-6">
              <PaymentModeChart data={data.paymentModeSplit} />
              <OrderStatusChart data={data.orderStatusCounts} />
            </div>
          </div>
        </>
      )}

      {/* Two-column layout: To-Do + Incomplete Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* To-Do widget */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">To-Do</h3>
            <span className="text-xs font-semibold text-gray-400 bg-gray-100 dark:bg-dark-700 px-2 py-0.5 rounded-full">{activeTodos.length} pending</span>
          </div>
          <div className="flex items-center gap-2 mb-4">
            <input type="text" placeholder="Add a task..." value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              className="flex-1 text-sm px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-850 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all placeholder-gray-400" />
            <button onClick={addTodo} disabled={!newTask.trim()}
              className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 rounded-xl text-white transition-all">
              <Plus size={18} />
            </button>
          </div>
          <div className="space-y-1 max-h-[320px] overflow-y-auto scrollbar-thin pr-1">
            {todos.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No tasks yet</p>
            ) : (
              [...activeTodos, ...doneTodos].map((t) => (
                <div key={t._id as string} className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-750 group transition-all ${t.done ? "opacity-50" : ""}`}>
                  <button onClick={() => toggleTodo(t._id as string, t.done as boolean)}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${t.done ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-dark-600 hover:border-primary-400"}`}>
                    {t.done && <Check size={11} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-sm truncate ${t.done ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                    {t.task as string}
                  </span>
                  <button onClick={() => deleteTodo(t._id as string)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Incomplete Orders */}
        <div className="card p-5 lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Incomplete Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-semibold inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
              View all <ArrowRight size={15} />
            </button>
          </div>
          {data.incompleteOrders.length > 0 && (
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {(["pending", "stock", "buy", "order"] as const).map((c) => {
                const count = data.incompleteOrders.filter((o) => (o.classification || "pending") === c).length;
                const colors: Record<string, string> = {
                  pending: "bg-gray-100 dark:bg-dark-700 text-gray-500",
                  stock: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300",
                  buy: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300",
                  order: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300",
                };
                return (
                  <span key={c} className={`text-[11px] font-bold px-3 py-1 rounded-full ${colors[c]}`}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}: {count}
                  </span>
                );
              })}
              <div className="flex-1" />
              {(["buy", "order"] as const).map((type) => {
                const hasItems = data.incompleteOrders.some((o) => (o.classification || "pending") === type);
                return hasItems ? (
                  <button key={type} onClick={() => sendDemand(type)} disabled={sendingDemand === type}
                    className={`px-5 py-2.5 rounded-xl text-sm font-bold inline-flex items-center gap-2 shadow-md hover:shadow-lg active:scale-[0.97] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${type === "buy" ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-blue-500 text-white hover:bg-blue-600"}`}>
                    <Send size={16} />
                    {sendingDemand === type ? "Sending..." : `Send ${type === "buy" ? "Purchase" : "Lab Order"}`}
                  </button>
                ) : null;
              })}
            </div>
          )}
          <div className="space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin pr-1">
            {data.incompleteOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">All orders complete</p>
            ) : (
              data.incompleteOrders.map((o) => {
                const cName = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).name as string : "";
                const cMobile = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).mobile as string : "";
                const isExpanded = expandedOrders.has(o._id as string);
                const demand = o.prescription ? buildDemand(o.prescription, o) : null;
                const cls = (o.classification as string) || "pending";
                return (
                  <div key={o._id as string} className={`rounded-xl border transition-all border-gray-100 dark:border-dark-700 hover:border-gray-200 dark:hover:border-dark-600`}>
                    <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 dark:border-dark-700/50">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${o.status === "Draft" ? "bg-gray-100 dark:bg-dark-700 text-gray-500" : o.status === "Ordered" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300"}`}>{o.status as string}</span>
                        {!demand && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 dark:bg-dark-700 text-gray-500">Plain</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(["stock", "order", "buy"] as const).map((c) => (
                          <button key={c} onClick={() => classifyOrder(o._id as string, cls === c ? "pending" : c)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                              cls === c
                                ? c === "stock" ? "bg-emerald-500 text-white shadow-sm"
                                  : c === "order" ? "bg-blue-500 text-white shadow-sm"
                                  : "bg-amber-500 text-white shadow-sm"
                                : "bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700 hover:text-gray-700 dark:hover:text-gray-300"
                            }`}>
                            {c === "stock" ? "Stock" : c === "order" ? "Order" : "Purchase"}
                          </button>
                        ))}
                        <button onClick={() => toggleExpand(o._id as string)}
                          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row">
                      <div className="flex-1 px-4 py-2.5">
                        {demand ? (
                          <div className="space-y-0.5">
                            <div className="text-sm font-bold text-gray-900 dark:text-white">{demand.heading}</div>
                            {demand.lines.map((line, i) => (
                              <div key={i} className="text-xs font-mono text-gray-700 dark:text-gray-300">{line}</div>
                            ))}
                            {demand.footer && <div className="text-xs text-gray-400 pt-0.5">{demand.footer}</div>}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-1">
                            <span className="font-semibold text-gray-900 dark:text-white">{o.lensBrand || o.lens || "Lens"}</span>
                            <span className="text-xs">·</span>
                            <span>Plain (no power)</span>
                          </div>
                        )}
                      </div>

                      <div className="sm:w-48 px-4 py-2.5 sm:border-l border-gray-100 dark:border-dark-700 sm:text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">{cName || "—"}</div>
                        {cMobile && <div className="text-xs text-gray-400">{cMobile}</div>}
                        {o.frameBrand && (
                          <button onClick={() => navigate(`/inventory?q=${encodeURIComponent(o.frameBrand as string)}`)}
                            className="flex sm:justify-end items-center gap-1 mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:underline transition-all w-full sm:text-right">
                            <Glasses size={12} /> {o.frameBrand as string}{o.frameModel ? ` (${o.frameModel as string})` : ""}
                          </button>
                        )}
                        {o.frameColor && <div className="text-[10px] text-gray-400">{o.frameColor as string}{o.frameSize ? ` / ${o.frameSize as string}` : ""}</div>}
                        {(o.stockStatus?.frameBrand || o.stockStatus?.lensBrand) && (
                          <div className="flex sm:justify-end gap-1.5 mt-2 flex-wrap">
                            {(() => {
                              const fs = o.stockStatus?.frameBrand;
                              if (fs) {
                                const total = fs.shop + fs.warehouse;
                                if (total > 0) return (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300">
                                    Frame: {fs.shop} shop / {fs.warehouse} warehouse
                                  </span>
                                );
                                if (o.frameBrand) return (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">Frame: out of stock</span>
                                );
                              }
                              return null;
                            })()}
                            {(() => {
                              const ls = o.stockStatus?.lensBrand;
                              if (ls) {
                                const total = ls.shop + ls.warehouse;
                                if (total > 0) return (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300">
                                    Lens: {ls.shop} shop / {ls.warehouse} warehouse
                                  </span>
                                );
                                if (o.lensBrand) return (
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300">Lens: out of stock</span>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-3 pt-0 border-t border-gray-100 dark:border-dark-700 mx-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs pt-3">
                          {o.frame && <Detail label="Frame" value={o.frame as string} />}
                          {o.frameBrand && <Detail label="Frame Brand" value={o.frameBrand as string} />}
                          {o.frameModel && <Detail label="Frame Model" value={o.frameModel as string} />}
                          {o.frameColor && <Detail label="Frame Color" value={o.frameColor as string} />}
                          {o.frameSize && <Detail label="Frame Size" value={o.frameSize as string} />}
                          {o.framePrice != null && <Detail label="Frame Price" value={`₹${(o.framePrice as number).toLocaleString()}`} />}
                          {o.lens && <Detail label="Lens" value={o.lens as string} />}
                          {o.lensBrand && <Detail label="Lens Brand" value={o.lensBrand as string} />}
                          {o.lensType && <Detail label="Lens Type" value={o.lensType as string} />}
                          {o.lensIndex && <Detail label="Lens Index" value={o.lensIndex as string} />}
                          {o.lensPrice != null && <Detail label="Lens Price" value={`₹${(o.lensPrice as number).toLocaleString()}`} />}
                          {o.coating && <Detail label="Coating" value={o.coating as string} />}
                          {o.coatingPrice != null && <Detail label="Coating Price" value={`₹${(o.coatingPrice as number).toLocaleString()}`} />}
                          {(o.accessories as string[])?.length > 0 && <Detail label="Accessories" value={(o.accessories as string[]).join(", ")} />}
                          {o.quantity != null && <Detail label="Qty" value={String(o.quantity)} />}
                          {o.labAssigned && <Detail label="Lab" value={o.labAssigned as string} />}
                          {o.labExpectedDate && <Detail label="Lab ETA" value={new Date(o.labExpectedDate as string).toLocaleDateString("en-IN")} />}
                          {o.deliveryDate && <Detail label="Delivery" value={new Date(o.deliveryDate as string).toLocaleDateString("en-IN")} />}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {!isStaff && (
        <>
      {/* Bottom row: Recent Customers, Recent Orders, Pending Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Customers</h3>
            <button onClick={() => navigate("/customers")} className="text-xs text-primary-600 dark:text-primary-400 font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">View all</button>
          </div>
          <div className="space-y-1">
            {data.recentCustomers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No customers yet</p>
            ) : (
              data.recentCustomers.slice(0, 5).map((c) => (
                <div key={c._id as string} onClick={() => navigate(`/customers/${c._id as string}`)}
                  className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-750 cursor-pointer transition-all">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm flex-shrink-0">
                      {String(c.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{c.name as string}</p>
                      <p className="text-xs text-gray-400 truncate">{String(c.mobile ?? "—")}</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-gray-400 flex-shrink-0">
                    {c.createdAt ? new Date(c.createdAt as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-xs text-primary-600 dark:text-primary-400 font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all inline-flex items-center gap-1">
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="space-y-1">
            {data.recentOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No orders yet</p>
            ) : (
              data.recentOrders.slice(0, 6).map((o) => {
                const cName = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).name as string : "";
                return (
                  <div key={o._id as string} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-750 transition-all group">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-500 text-xs font-bold flex-shrink-0">
                        {(cName?.charAt(0) || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{cName || "—"}</span>
                          <span className={`badge text-[10px] px-2 py-0.5 font-semibold ${o.status === "Delivered" ? "badge-green" : o.status === "Cancelled" ? "badge-red" : o.status === "Ready" ? "badge-blue" : o.status === "In Lab" ? "badge-yellow" : "badge-gray"}`}>{String(o.status || "Draft")}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {o.frameBrand && <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Glasses size={11} /> {o.frameBrand as string}</span>}
                          {o.lensBrand && <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Eye size={11} /> {o.lensBrand as string}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white">Pending Bills</h3>
            <button onClick={() => navigate("/bills")} className="text-xs text-primary-600 dark:text-primary-400 font-semibold px-3 py-1.5 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all inline-flex items-center gap-1">
              View all <ArrowRight size={15} />
            </button>
          </div>
          <div className="space-y-1">
            {data.pendingBills.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No pending bills</p>
            ) : (
              data.pendingBills.slice(0, 6).map((b) => {
                const cName = typeof b.customerId === "object" && b.customerId ? (b.customerId as Record<string, unknown>).name as string : "";
                const cMobile = typeof b.customerId === "object" && b.customerId ? (b.customerId as Record<string, unknown>).mobile as string : "";
                return (
                  <div key={b._id as string} onClick={() => navigate("/bills")}
                    className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-750 cursor-pointer transition-all group">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold text-sm flex-shrink-0">
                        {(cName?.charAt(0) || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{cName || "—"}</p>
                        {cMobile && <p className="text-xs text-gray-400 truncate">{cMobile}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-600 dark:text-amber-400 flex-shrink-0">₹{((b.pendingAmount as number) || 0).toLocaleString()}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      </>)}
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

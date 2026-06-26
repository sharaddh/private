import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApiGet } from "../hooks/useApi";
import StatCard from "../components/StatCard";
import PageSkeleton from "../components/PageSkeleton";
import CameraScanner from "../components/CameraScanner";
import { useToast } from "../context/ToastContext";
import {
  Users, ShoppingCart, FileText, Package, Truck,
  TrendingUp, DollarSign, Clock, AlertTriangle, ArrowRight,
  Glasses, Eye, Plus, Check, Trash2,
  Search, ChevronDown, ChevronUp, Send, FlaskConical, QrCode,
} from "lucide-react";

interface DashboardData {
  counts: { customers: number; orders: number; bills: number; payments: number; inventory: number; deliveries: number; visits: number; };
  todaySales: number; todayCollection: number; readyDeliveries: number; newCustomersToday: number;
  lowStock: number; pendingPayments: number; recentCustomers: Record<string, unknown>[]; recentOrders: Record<string, unknown>[]; todayDeliveries: Record<string, unknown>[]; pendingBills: Record<string, unknown>[];
  incompleteOrders: Record<string, unknown>[];
}

export default function Dashboard() {
  const { data, loading, refetch } = useApiGet<DashboardData>("/api/dashboard/stats");
  const [todos, setTodos] = useState<Record<string, unknown>[]>([]);
  const [newTask, setNewTask] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [sendingDemand, setSendingDemand] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

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

  const toggleReviewed = useCallback(async (o: Record<string, unknown>) => {
    const newVal = !o.reviewed;
    const res = await api.patch(`/api/orders/${o._id}/review`, { reviewed: newVal });
    if (res.success) {
      if (data) {
        data.incompleteOrders = data.incompleteOrders.map((x) =>
          x._id === o._id ? { ...x, reviewed: newVal } : x
        );
      }
      refetch();
    }
  }, [data, refetch]);

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

  if (loading) return <PageSkeleton page="dashboard" />;

  if (!data) return null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);

  return (
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{greeting}!</h1>
          <p className="page-subtitle">Here's what's happening at your shop today.</p>
        </div>
        <button onClick={() => setShowScanner(true)} className="btn-primary flex items-center gap-2">
          <QrCode size={18} /> Scan
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={`₹${(data.todaySales || 0).toLocaleString()}`} icon={<TrendingUp size={20} />} color="primary" />
        <StatCard title="Collection" value={`₹${(data.todayCollection || 0).toLocaleString()}`} icon={<DollarSign size={20} />} color="emerald" />
        <StatCard title="Pending" value={`₹${(data.pendingPayments || 0).toLocaleString()}`} icon={<Clock size={20} />} color="amber" />
        <StatCard title="Low Stock" value={data.lowStock || 0} icon={<AlertTriangle size={20} />} color="red" onClick={() => navigate("/inventory")} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Customers" value={data.counts.customers} subtitle={`+${data.newCustomersToday || 0} today`} icon={<Users size={18} />} color="primary" onClick={() => navigate("/customers")} />
        <StatCard title="Orders" value={data.counts.orders} icon={<ShoppingCart size={18} />} color="blue" onClick={() => navigate("/orders")} />
        <StatCard title="Bills" value={data.counts.bills} icon={<FileText size={18} />} color="emerald" onClick={() => navigate("/bills")} />
        <StatCard title="Ready" value={data.readyDeliveries || 0} subtitle="for pickup" icon={<Truck size={18} />} color="purple" onClick={() => navigate("/pickup")} />
        <StatCard title="Inventory" value={data.counts.inventory} subtitle={`${data.lowStock} low`} icon={<Package size={18} />} color="cyan" onClick={() => navigate("/inventory")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">To-Do</h3>
            <span className="text-xs text-gray-400">{activeTodos.length} pending</span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input type="text" placeholder="Add a task..." value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTodo()}
              className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-850 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 transition-all placeholder-gray-400" />
            <button onClick={addTodo} disabled={!newTask.trim()}
              className="p-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 rounded-lg text-white transition-all">
              <Plus size={16} />
            </button>
          </div>
          <div className="space-y-1 max-h-[280px] overflow-y-auto scrollbar-thin pr-1">
            {todos.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No tasks yet</p>
            ) : (
              [...activeTodos, ...doneTodos].map((t) => (
                <div key={t._id as string} className={`flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 group transition-all ${t.done ? "opacity-50" : ""}`}>
                  <button onClick={() => toggleTodo(t._id as string, t.done as boolean)}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${t.done ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-dark-600 hover:border-primary-400"}`}>
                    {t.done && <Check size={11} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-sm truncate ${t.done ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                    {t.task as string}
                  </span>
                  <button onClick={() => deleteTodo(t._id as string)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Incomplete Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {data.incompleteOrders.length > 0 && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {(["pending", "stock", "buy", "order"] as const).map((c) => {
                const count = data.incompleteOrders.filter((o) => (o.classification || "pending") === c).length;
                const colors: Record<string, string> = {
                  pending: "bg-gray-100 dark:bg-dark-700 text-gray-500",
                  stock: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300",
                  buy: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300",
                  order: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300",
                };
                return (
                  <span key={c} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[c]}`}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}: {count}
                  </span>
                );
              })}
              <div className="flex-1" />
              {(["buy", "order"] as const).map((type) => {
                const hasItems = data.incompleteOrders.some((o) => (o.classification || "pending") === type);
                return hasItems ? (
                  <button key={type} onClick={() => sendDemand(type)} disabled={sendingDemand === type}
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-all disabled:opacity-40"
                    style={{ background: type === "buy" ? "#fef3c7" : "#dbeafe", color: type === "buy" ? "#d97706" : "#2563eb" }}>
                    <Send size={11} />
                    {sendingDemand === type ? "Sending..." : `Send ${type === "buy" ? "Purchase" : "Lab Order"}`}
                  </button>
                ) : null;
              })}
            </div>
          )}
          <div className="space-y-2 max-h-[460px] overflow-y-auto scrollbar-thin pr-1">
            {data.incompleteOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">All orders complete</p>
            ) : (
              data.incompleteOrders.map((o) => {
                const cName = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).name as string : "";
                const cMobile = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).mobile as string : "";
                const isExpanded = expandedOrders.has(o._id as string);
                const demand = o.prescription ? buildDemand(o.prescription, o) : null;
                const cls = (o.classification as string) || "pending";
                return (
                  <div key={o._id as string} className={`rounded-lg border transition-all ${o.reviewed ? "border-emerald-200 dark:border-emerald-800/40" : "border-gray-100 dark:border-dark-700 hover:border-gray-200 dark:hover:border-dark-600"}`}>
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 dark:border-dark-700/50">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleReviewed(o)}
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${o.reviewed ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-dark-600 hover:border-primary-400"}`}>
                          {o.reviewed && <Check size={9} className="text-white" />}
                        </button>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${o.status === "Draft" ? "bg-gray-100 dark:bg-dark-700 text-gray-500" : o.status === "Ordered" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300" : "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300"}`}>{o.status as string}</span>
                        {cls !== "pending" && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${cls === "stock" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300" : cls === "buy" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"}`}>
                            {cls === "stock" ? "Stock" : cls === "buy" ? "Buy" : "Order"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/inventory?q=${encodeURIComponent((o.lensBrand || o.lens || o.frame) as string)}`)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-400 hover:text-primary-600 transition-all" title="Check stock">
                          <Search size={13} />
                        </button>
                        <button onClick={() => toggleExpand(o._id as string)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row">
                      <div className="flex-1 px-3 py-2">
                        {demand ? (
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">{demand.heading}</div>
                            {demand.lines.map((line, i) => (
                              <div key={i} className="text-xs font-mono text-gray-700 dark:text-gray-300">{line}</div>
                            ))}
                            {demand.footer && <div className="text-xs text-gray-400 pt-0.5">{demand.footer}</div>}
                          </div>
                        ) : (
                          <div className="text-sm italic text-gray-400 py-1">No prescription</div>
                        )}
                      </div>

                      <div className="sm:w-48 px-3 py-2 sm:border-l border-gray-100 dark:border-dark-700 sm:text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{cName || "—"}</div>
                        {cMobile && <div className="text-xs text-gray-400">{cMobile}</div>}
                        {o.frameBrand && (
                          <div className="flex sm:justify-end items-center gap-1 mt-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                            <Glasses size={11} /> {o.frameBrand as string}{o.frameModel ? ` (${o.frameModel as string})` : ""}
                          </div>
                        )}
                        {o.frameColor && <div className="text-[10px] text-gray-400">{o.frameColor as string}{o.frameSize ? ` / ${o.frameSize as string}` : ""}</div>}
                        <div className="flex sm:justify-end gap-1 mt-2">
                          {(["stock", "buy", "order"] as const).map((c) => (
                            <button key={c} onClick={() => classifyOrder(o._id as string, cls === c ? "pending" : c)}
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border transition-all ${cls === c ? c === "stock" ? "bg-emerald-500 border-emerald-500 text-white" : c === "buy" ? "bg-amber-500 border-amber-500 text-white" : "bg-blue-500 border-blue-500 text-white" : "border-gray-200 dark:border-dark-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}>
                              {c === "stock" ? "Stock" : c === "buy" ? "Buy" : "Order"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-3 pb-2.5 pt-0 border-t border-gray-100 dark:border-dark-700 mx-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs pt-2">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Customers</h3>
            <button onClick={() => navigate("/customers")} className="text-xs text-primary-600 dark:text-primary-400 font-medium">View all</button>
          </div>
          <div className="space-y-1">
            {data.recentCustomers.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No customers yet</p>
            ) : (
              data.recentCustomers.slice(0, 5).map((c) => (
                <div key={c._id as string} onClick={() => navigate(`/customers/${c._id as string}`)}
                  className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 cursor-pointer transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-xs flex-shrink-0">
                      {String(c.name ?? "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name as string}</p>
                      <p className="text-xs text-gray-400 truncate">{String(c.mobile ?? "—")}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {c.createdAt ? new Date(c.createdAt as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {data.recentOrders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No orders yet</p>
            ) : (
              data.recentOrders.slice(0, 6).map((o) => {
                const cName = typeof o.customerId === "object" && o.customerId ? (o.customerId as Record<string, unknown>).name as string : "";
                return (
                  <div key={o._id as string} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-all group">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-500 text-xs font-semibold flex-shrink-0">
                        {(cName?.charAt(0) || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{cName || "—"}</span>
                          <span className={`badge text-[10px] px-1.5 py-0 ${o.status === "Delivered" ? "badge-green" : o.status === "Cancelled" ? "badge-red" : o.status === "Ready" ? "badge-blue" : o.status === "In Lab" ? "badge-yellow" : "badge-gray"}`}>{String(o.status || "Draft")}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {o.frameBrand && <span className="text-xs text-gray-400 inline-flex items-center gap-1"><Glasses size={10} /> {o.frameBrand as string}</span>}
                          {o.lensBrand && <span className="text-xs text-gray-400 inline-flex items-center gap-1 ml-2"><Eye size={10} /> {o.lensBrand as string}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pending Bills</h3>
            <button onClick={() => navigate("/bills")} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
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
                    className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 cursor-pointer transition-all group">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-semibold text-xs flex-shrink-0">
                        {(cName?.charAt(0) || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{cName || "—"}</p>
                        {cMobile && <p className="text-xs text-gray-400 truncate">{cMobile}</p>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0">₹{((b.pendingAmount as number) || 0).toLocaleString()}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
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

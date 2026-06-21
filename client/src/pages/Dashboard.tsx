import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import StatCard from "../components/StatCard";
import Toast from "../components/Toast";
import {
  Users, ShoppingCart, FileText, Package, Truck,
  TrendingUp, DollarSign, Clock, AlertTriangle, ArrowRight,
  Glasses, Eye, Plus, Check, Trash2, Circle, FlaskConical,
  Search, ChevronDown, ChevronUp, Send, ShoppingBag, Factory
} from "lucide-react";

interface DashboardData {
  counts: { customers: number; orders: number; bills: number; payments: number; inventory: number; deliveries: number; visits: number; };
  todaySales: number; todayCollection: number; readyDeliveries: number; newCustomersToday: number;
  lowStock: number; pendingPayments: number; recentCustomers: any[]; recentOrders: any[]; todayDeliveries: any[]; pendingBills: any[];
  incompleteOrders: any[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [todos, setTodos] = useState<any[]>([]);
  const [newTask, setNewTask] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [sendingDemand, setSendingDemand] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/dashboard/stats").then((res) => {
      if (res.success) setData(res.data);
    });
    fetchTodos();
  }, []);

  function fetchTodos() { api.get("/api/todos").then((d) => { if (d.success) setTodos(d.data || []); }); }

  async function addTodo() {
    if (!newTask.trim()) return;
    const res = await api.post("/api/todos", { task: newTask.trim() });
    if (res.success) { setNewTask(""); fetchTodos(); }
  }

  async function toggleTodo(id: string, done: boolean) {
    await api.patch(`/api/todos/${id}`, { done: !done });
    fetchTodos();
  }

  async function deleteTodo(id: string) {
    await api.del(`/api/todos/${id}`);
    fetchTodos();
  }

  function toggleExpand(id: string) {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function toggleReviewed(o: any) {
    const newVal = !o.reviewed;
    const res = await api.patch(`/api/orders/${o._id}/review`, { reviewed: newVal });
    if (res.success) {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          incompleteOrders: prev.incompleteOrders.map((x: any) =>
            x._id === o._id ? { ...x, reviewed: newVal } : x
          ),
        };
      });
    }
  }

  async function classifyOrder(id: string, classification: string) {
    const res = await api.patch(`/api/orders/${id}/classify`, { classification });
    if (res.success) {
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          incompleteOrders: prev.incompleteOrders.map((x: any) =>
            x._id === id ? { ...x, classification } : x
          ),
        };
      });
    }
  }

  async function sendDemand(type: "buy" | "order") {
    setSendingDemand(type);
    const res = await api.post("/api/orders/demand-send", { type });
    setSendingDemand(null);
    if (res.success) {
      if (res.data?.sent) {
        setToast({ message: `${type === "buy" ? "Purchase" : "Lab Order"} list sent to your WhatsApp!`, type: "success" });
      } else if (res.data?.waConnected === false) {
        setToast({ message: `WhatsApp not connected. Scan QR code on WhatsApp page to receive PDFs`, type: "error" });
      } else if (res.data?.queued) {
        setToast({ message: `${type === "buy" ? "Purchase" : "Lab Order"} list queued — WhatsApp will send when connected`, type: "info" });
      } else {
        const errMsg = res.data?.sendError ? `: ${res.data.sendError}` : "";
        setToast({ message: `PDF generated (${res.data?.count || 0} items, ${res.data?.sizeKB || "?"}KB) but send failed${errMsg}`, type: "error" });
      }
    } else {
      setToast({ message: res.message || "Failed to send", type: "error" });
    }
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-[3px] border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

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

      {/* Middle row: Todo + Incomplete Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Todo List — moved from bottom to middle-left */}
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
                <div key={t._id} className={`flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 group transition-all ${t.done ? "opacity-50" : ""}`}>
                  <button onClick={() => toggleTodo(t._id, t.done)}
                    className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 transition-all ${
                      t.done ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-dark-600 hover:border-primary-400"
                    }`}>
                    {t.done && <Check size={11} className="text-white" />}
                  </button>
                  <span className={`flex-1 text-sm truncate ${t.done ? "line-through text-gray-400" : "text-gray-700 dark:text-gray-300"}`}>
                    {t.task}
                  </span>
                  <button onClick={() => deleteTodo(t._id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-all">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Incomplete Orders — expanded (3 cols) */}
        <div className="card p-4 lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Incomplete Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          {/* Demand action bar */}
          {data.incompleteOrders.length > 0 && (
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {(["pending", "stock", "buy", "order"] as const).map(c => {
                const count = data.incompleteOrders.filter((o: any) => (o.classification || "pending") === c).length;
                const colors: Record<string, string> = {
                  pending: "bg-gray-100 dark:bg-dark-700 text-gray-500",
                  stock: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300",
                  buy: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300",
                  order: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300",
                };
                const labels: Record<string, string> = {
                  pending: "Pending",
                  stock: "In Stock",
                  buy: "To Buy",
                  order: "To Order",
                };
                return (
                  <span key={c} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${colors[c]}`}>
                    {labels[c]}: {count}
                  </span>
                );
              })}
              <div className="flex-1" />
              {(["buy", "order"] as const).map(type => {
                const hasItems = data.incompleteOrders.some((o: any) => (o.classification || "pending") === type);
                return hasItems ? (
                  <button key={type} onClick={() => sendDemand(type)}
                    disabled={sendingDemand === type}
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
            {(data.incompleteOrders || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">All orders complete</p>
            ) : (
              data.incompleteOrders?.map((o: any) => {
                const cName = typeof o.customerId === "object" ? o.customerId?.name : "";
                const cMobile = typeof o.customerId === "object" ? o.customerId?.mobile : "";
                const isExpanded = expandedOrders.has(o._id);
                const rx = o.prescription;
                const demand = rx ? buildDemand(rx, o) : null;
                const cls = o.classification || "pending";
                return (
                  <div key={o._id} className={`rounded-lg border transition-all ${o.reviewed ? "border-emerald-200 dark:border-emerald-800/40" : "border-gray-100 dark:border-dark-700 hover:border-gray-200 dark:hover:border-dark-600"}`}>
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-50 dark:border-dark-700/50">
                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleReviewed(o)}
                          className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            o.reviewed ? "bg-emerald-500 border-emerald-500" : "border-gray-300 dark:border-dark-600 hover:border-primary-400"
                          }`}>
                          {o.reviewed && <Check size={9} className="text-white" />}
                        </button>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          o.status === "Draft" ? "bg-gray-100 dark:bg-dark-700 text-gray-500" :
                          o.status === "Ordered" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300" :
                          "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300"
                        }`}>{o.status}</span>
                        {/* Classification badges */}
                        {cls !== "pending" && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                            cls === "stock" ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300" :
                            cls === "buy" ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300" :
                            "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"
                          }`}>
                            {cls === "stock" ? "Stock" : cls === "buy" ? "Buy" : "Order"}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/inventory?q=${encodeURIComponent(o.lensBrand || o.lens || o.frame || "")}`)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-400 hover:text-primary-600 transition-all"
                          title="Check stock">
                          <Search size={13} />
                        </button>
                        <button onClick={() => toggleExpand(o._id)}
                          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-dark-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all">
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </div>

                    {/* Body: left = prescription, right = customer + frame */}
                    <div className="flex flex-col sm:flex-row">
                      {/* Left — Prescription */}
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

                      {/* Right — Customer + Frame */}
                      <div className="sm:w-48 px-3 py-2 sm:border-l border-gray-100 dark:border-dark-700 sm:text-right">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">{cName || "—"}</div>
                        {cMobile && <div className="text-xs text-gray-400">{cMobile}</div>}
                        {o.frameBrand && (
                          <div className="flex sm:justify-end items-center gap-1 mt-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                            <Glasses size={11} />
                            {o.frameBrand}{o.frameModel ? ` (${o.frameModel})` : ""}
                          </div>
                        )}
                        {o.frameColor && <div className="text-[10px] text-gray-400">{o.frameColor}{o.frameSize ? ` / ${o.frameSize}` : ""}</div>}
                        {/* Classification buttons */}
                        <div className="flex sm:justify-end gap-1 mt-2">
                          {(["stock", "buy", "order"] as const).map(c => (
                            <button key={c} onClick={() => classifyOrder(o._id, cls === c ? "pending" : c)}
                              className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full border transition-all ${
                                cls === c
                                  ? c === "stock" ? "bg-emerald-500 border-emerald-500 text-white"
                                    : c === "buy" ? "bg-amber-500 border-amber-500 text-white"
                                    : "bg-blue-500 border-blue-500 text-white"
                                  : "border-gray-200 dark:border-dark-600 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              }`}>
                              {c === "stock" ? "Stock" : c === "buy" ? "Buy" : "Order"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-2.5 pt-0 border-t border-gray-100 dark:border-dark-700 mx-3">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs pt-2">
                          {o.frame && <Detail label="Frame" value={o.frame} />}
                          {o.frameBrand && <Detail label="Frame Brand" value={o.frameBrand} />}
                          {o.frameModel && <Detail label="Frame Model" value={o.frameModel} />}
                          {o.frameColor && <Detail label="Frame Color" value={o.frameColor} />}
                          {o.frameSize && <Detail label="Frame Size" value={o.frameSize} />}
                          {o.framePrice ? <Detail label="Frame Price" value={`₹${o.framePrice.toLocaleString()}`} /> : null}
                          {o.lens && <Detail label="Lens" value={o.lens} />}
                          {o.lensBrand && <Detail label="Lens Brand" value={o.lensBrand} />}
                          {o.lensType && <Detail label="Lens Type" value={o.lensType} />}
                          {o.lensIndex && <Detail label="Lens Index" value={o.lensIndex} />}
                          {o.lensPrice ? <Detail label="Lens Price" value={`₹${o.lensPrice.toLocaleString()}`} /> : null}
                          {o.coating && <Detail label="Coating" value={o.coating} />}
                          {o.coatingPrice ? <Detail label="Coating Price" value={`₹${o.coatingPrice.toLocaleString()}`} /> : null}
                          {o.accessories?.length > 0 && (
                            <Detail label="Accessories" value={o.accessories.join(", ")} />
                          )}
                          {o.quantity ? <Detail label="Qty" value={o.quantity.toString()} /> : null}
                          {o.labAssigned && <Detail label="Lab" value={o.labAssigned} />}
                          {o.labExpectedDate && <Detail label="Lab ETA" value={new Date(o.labExpectedDate).toLocaleDateString("en-IN")} />}
                          {o.deliveryDate && <Detail label="Delivery" value={new Date(o.deliveryDate).toLocaleDateString("en-IN")} />}
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

      {/* Bottom row: Recent Customers, Recent Orders, Pending Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Customers — moved from middle-left, fonts increased */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Customers</h3>
            <button onClick={() => navigate("/customers")} className="text-xs text-primary-600 dark:text-primary-400 font-medium">
              View all
            </button>
          </div>
          <div className="space-y-1">
            {(data.recentCustomers || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No customers yet</p>
            ) : (
              data.recentCustomers?.slice(0, 5).map((c: any) => (
                <div key={c._id} onClick={() => navigate(`/customers/${c._id}`)}
                  className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 cursor-pointer transition-all">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-xs flex-shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.mobile || "—"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {(data.recentOrders || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No orders yet</p>
            ) : (
              data.recentOrders?.slice(0, 6).map((o: any) => {
                const cName = typeof o.customerId === "object" ? o.customerId?.name : "";
                return (
                  <div key={o._id} className="flex items-center justify-between py-2 px-2 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-all group">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-500 text-xs font-semibold flex-shrink-0">
                        {(cName?.charAt(0) || "?").toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{cName || "—"}</span>
                          <span className={`badge text-[10px] px-1.5 py-0 ${
                            o.status === "Delivered" ? "badge-green" :
                            o.status === "Cancelled" ? "badge-red" :
                            o.status === "Ready" ? "badge-blue" :
                            o.status === "In Lab" ? "badge-yellow" : "badge-gray"
                          }`}>{o.status || "Draft"}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-0.5">
                          {o.frameBrand && (
                            <span className="text-xs text-gray-400 inline-flex items-center gap-1">
                              <Glasses size={10} /> {o.frameBrand}
                            </span>
                          )}
                          {o.lensBrand && (
                            <span className="text-xs text-gray-400 inline-flex items-center gap-1 ml-2">
                              <Eye size={10} /> {o.lensBrand}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pending Bills */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Pending Bills</h3>
            <button onClick={() => navigate("/bills")} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {(data.pendingBills || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-6">No pending bills</p>
            ) : (
              data.pendingBills?.slice(0, 6).map((b: any) => {
                const cName = typeof b.customerId === "object" ? b.customerId?.name : "";
                const cMobile = typeof b.customerId === "object" ? b.customerId?.mobile : "";
                return (
                  <div key={b._id} onClick={() => navigate("/bills")}
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
                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-400 flex-shrink-0">₹{b.pendingAmount?.toLocaleString()}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
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

function buildDemand(rx: any, order: any): { heading: string; lines: string[]; footer: string } | null {
  const right = rx?.rightEye;
  const left = rx?.leftEye;
  const rDV = right?.dv;
  const lDV = left?.dv;
  const rNV = right?.nv;
  const lNV = left?.nv;

  const hasRx = rDV?.sph != null || lDV?.sph != null || rNV?.sph != null || lNV?.sph != null;
  if (!hasRx) return null;

  const lensLabel = [order.lensBrand, order.lensType, order.lensIndex].filter(Boolean).join(" ") || "";

  function rxStr(e: any, dv: any, nv: any): string {
    const parts: string[] = [];
    if (dv?.sph != null) {
      let s = formatRx(dv.sph, dv.cyl, dv.axis);
      if (dv.va) s += ` VA:${dv.va}`;
      parts.push(s);
    }
    if (nv?.sph != null) {
      let s = formatRx(nv.sph, nv.cyl, nv.axis);
      if (dv?.sph != null && nv.sph !== dv.sph) {
        const add = (nv.sph - dv.sph).toFixed(2);
        s += ` Add ${add}`;
      }
      if (nv.va) s += ` VA:${nv.va}`;
      parts.push(s);
    }
    return parts.join(" | ");
  }

  function eyeMatch(a: any, b: any): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.sph === b.sph && a.cyl === b.cyl && a.axis === b.axis;
  }

  const sameRx = eyeMatch(rDV, lDV) && eyeMatch(rNV, lNV);
  const heading = sameRx
    ? `1p ${lensLabel}`.trim()
    : `1/2p ${lensLabel}`.trim();

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

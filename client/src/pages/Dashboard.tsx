import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useApiGet } from "../hooks/useApi";
import { useAuth } from "../context/AuthContext";
import StatCard from "../components/StatCard";
import PageSkeleton from "../components/PageSkeleton";
import CameraScanner from "../components/CameraScanner";
import { SalesTrendChart, OrderStatusDonut } from "../components/DashboardCharts";
import { useToast } from "../context/ToastContext";
import {
  TrendingUp, Clock, AlertTriangle, ArrowRight,
  Glasses, Eye, Plus, Check, Trash2, Package,
  ChevronDown, ChevronUp, Send, QrCode, Download,
  ShoppingBag, Users,
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
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });

  const incompleteCount = data.incompleteOrders.length;
  const pendingBillsCount = data.pendingBills.length;

  const activeTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.filter((t) => t.done);
  const pickupCount = data.readyDeliveries ?? 0;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">ShopDash</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{dateStr} &bull; {timeStr}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/reports")}
            className="btn-secondary btn-sm flex items-center gap-2">
            <Download size={15} /> Export
          </button>
          <button onClick={() => setShowScanner(true)}
            className="btn-primary btn-sm flex items-center gap-2">
            <QrCode size={15} /> Scan
          </button>
        </div>
      </div>

      {!isStaff && (
        <>
          {/* KPI Cards Row */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <StatCard
              title="TODAY SALES"
              value={`₹${(data.todaySales || 0).toLocaleString()}`}
              icon={<TrendingUp size={20} />}
              color="primary"
              subtitle="+12% vs yesterday"
            />
            <StatCard
              title="COLLECTIONS"
              value={`₹${(data.todayCollection || 0).toLocaleString()}`}
              icon={<TrendingUp size={20} />}
              color="emerald"
              subtitle="Today"
            />
            <StatCard
              title="PENDING BILLS"
              value={`₹${(data.pendingPayments || 0).toLocaleString()}`}
              icon={<Clock size={20} />}
              color="amber"
              subtitle={data.pendingPayments > 0 ? "Needs attention" : "All clear"}
            />
            <StatCard
              title="PICKUP TODAY"
              value={pickupCount}
              icon={<ShoppingBag size={20} />}
              color="primary"
              subtitle="Ready for pickup"
              onClick={pickupCount > 0 ? () => navigate("/pickup") : undefined}
            />
            <StatCard
              title="LOW STOCK"
              value={data.lowStock ?? 0}
              icon={<AlertTriangle size={20} />}
              color={data.lowStock > 0 ? "red" : "emerald"}
              subtitle={data.lowStock > 0 ? `${data.lowStock} items low` : "All stocked"}
              onClick={() => navigate("/inventory")}
            />
          </div>

          {/* Charts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-3">
              <SalesTrendChart data={data.dailySales} />
            </div>
            <div className="lg:col-span-2">
              <OrderStatusDonut data={data.orderStatusCounts} />
            </div>
          </div>
        </>
      )}

      {/* Action Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Incomplete Orders */}
        <div className="lg:col-span-3 card p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-dark-700">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Incomplete Orders</h3>
              <p className="text-xs text-gray-400 mt-0.5">{v(incompleteCount)} orders need attention</p>
            </div>
            <button onClick={() => navigate("/orders")}
              className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 inline-flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
              View all <ArrowRight size={13} />
            </button>
          </div>
          {data.incompleteOrders.length > 0 && (
            <div className="flex items-center gap-2 px-5 py-2.5 flex-wrap border-b border-gray-50 dark:border-dark-800">
              {(["pending", "stock", "buy", "order"] as const).map((c) => {
                const count = data.incompleteOrders.filter((o) => (o.classification || "pending") === c).length;
                const colors: Record<string, string> = {
                  pending: "bg-gray-100 dark:bg-dark-700 text-gray-500",
                  stock: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300",
                  buy: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300",
                  order: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300",
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
                    className={`px-3 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${type === "buy" ? "bg-amber-500 text-white hover:bg-amber-600" : "bg-blue-500 text-white hover:bg-blue-600"}`}>
                    <Send size={12} />
                    {sendingDemand === type ? "Sending..." : `Send ${type === "buy" ? "Purchase" : "Lab Order"}`}
                  </button>
                ) : null;
              })}
            </div>
          )}
          <div className="divide-y divide-gray-50 dark:divide-dark-800 max-h-[400px] overflow-y-auto scrollbar-thin">
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
                  <div key={o._id as string}>
                    <div className="px-5 py-3 hover:bg-gray-50 dark:hover:bg-dark-750 transition-all">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-dark-700 flex items-center justify-center text-gray-500 text-xs font-bold flex-shrink-0">
                            {(cName?.charAt(0) || "?").toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white truncate">{v(cName)}</span>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${o.status === "Draft" ? "bg-gray-100 dark:bg-dark-700 text-gray-500" : o.status === "Ordered" ? "bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300" : "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-300"}`}>{v(o.status as string, "Draft")}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                              {cMobile && <span>{maskPhone(cMobile)}</span>}
                              {o.frameBrand && <span><Glasses size={10} className="inline mr-0.5" />{o.frameBrand as string}</span>}
                              {o.lensBrand && <span><Eye size={10} className="inline mr-0.5" />{o.lensBrand as string}</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {(["stock", "order", "buy"] as const).map((c) => (
                            <button key={c} onClick={() => classifyOrder(o._id as string, cls === c ? "pending" : c)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-all duration-150 ${
                                cls === c
                                  ? c === "stock" ? "bg-emerald-500 text-white"
                                    : c === "order" ? "bg-blue-500 text-white"
                                    : "bg-amber-500 text-white"
                                  : "bg-white dark:bg-dark-800 text-gray-400 border border-gray-200 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700"
                              }`}>
                              {c === "stock" ? "Stock" : c === "order" ? "Order" : "Buy"}
                            </button>
                          ))}
                          <button onClick={() => toggleExpand(o._id as string)}
                            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-400 hover:text-gray-600 transition-all">
                            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                          </button>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-gray-100 dark:border-dark-700 grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs">
                          {demand && <div className="col-span-full text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{demand.heading} — {demand.lines.join(", ")}{demand.footer ? ` (${demand.footer})` : ""}</div>}
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
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Quick Actions */}
          <div className="card">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Quick Actions</h3>
            <div className="space-y-1.5">
              <button onClick={() => navigate("/orders?status=incomplete")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-all group">
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">Incomplete Orders</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">{v(incompleteCount)}</span>
                  <ArrowRight size={14} className="text-gray-300 dark:text-dark-500 group-hover:text-primary-500 transition-all" />
                </span>
              </button>
              <button onClick={() => navigate("/bills?status=pending")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-all group">
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">Pending Bills</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">{v(pendingBillsCount)}</span>
                  <ArrowRight size={14} className="text-gray-300 dark:text-dark-500 group-hover:text-primary-500 transition-all" />
                </span>
              </button>
              <button onClick={() => navigate("/pickup")}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-all group">
                <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">Ready for Pickup</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary-600 dark:text-primary-400">{v(pickupCount)}</span>
                  <ArrowRight size={14} className="text-gray-300 dark:text-dark-500 group-hover:text-primary-500 transition-all" />
                </span>
              </button>
            </div>
          </div>

          {/* Recent Customers */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Recent Customers</h3>
              <button onClick={() => navigate("/customers")}
                className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 px-2 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all">
                View all
              </button>
            </div>
            <div className="space-y-0.5">
              {data.recentCustomers.length === 0 ? (
                <div className="text-center py-6">
                  <Users size={24} className="text-gray-300 dark:text-dark-500 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No recent customers</p>
                </div>
              ) : (
                data.recentCustomers.slice(0, 5).map((c) => (
                  <div key={v(c._id as string)} onClick={() => navigate(`/customers/${c._id as string}`)}
                    className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 cursor-pointer transition-all">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm flex-shrink-0">
                        {String(c.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{v(c.name as string)}</p>
                        <p className="text-xs text-gray-400">{maskPhone(String(c.mobile ?? ""))}</p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {c.createdAt ? new Date(c.createdAt as string).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
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

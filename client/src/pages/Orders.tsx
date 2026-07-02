import React, { useEffect, useState, useCallback } from "react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import PageSkeleton from "../components/PageSkeleton";
import { Eye, Clock, Package, Glasses, FlaskConical, Circle, ArrowUpRight, Loader2, Minus, Plus, Check } from "lucide-react";
import DateRangePicker from "../components/DateRangePicker";

const STATUS_STEPS = ["Draft", "Ordered", "In Lab", "Ready", "Delivered"];

const VALID_NEXT: Record<string, string> = {
  Draft: "Ordered",
  Ordered: "In Lab",
  "In Lab": "Ready",
};

function DotProgress({ status, forwardedCount, quantity }: { status: string; forwardedCount?: number; quantity?: number }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
  const qty = quantity || 1;
  const fwd = forwardedCount || 0;
  const pct = fwd > 0 && fwd < qty ? fwd / qty : 0;
  return (
    <div className="flex items-center gap-1 px-1">
      {STATUS_STEPS.slice(0, 4).map((step, i) => (
        <div key={step} className="flex items-center flex-1 last:flex-none">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
            i < currentIdx
              ? "bg-primary-500 text-white"
              : i === currentIdx
              ? "ring-2 ring-primary-500/50 bg-primary-500 text-white"
              : "bg-gray-200 dark:bg-dark-600 text-gray-400 dark:text-gray-500"
          }`}>
            {i < currentIdx ? "\u2713" : i + 1}
          </div>
          {i < 3 && (
            <div className={`flex-1 h-0.5 mx-1 rounded transition-all duration-300 relative overflow-hidden ${
              i < currentIdx ? "bg-primary-500" : "bg-gray-200 dark:bg-dark-600"
            }`}>
              {i === currentIdx && pct > 0 && (
                <div className="absolute inset-0 bg-primary-400 transition-all duration-500" style={{ width: `${pct * 100}%` }} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

const STATUS_THEME: Record<string, { dot: string; badge: string }> = {
  Draft:    { dot: "bg-gray-300 dark:bg-gray-600", badge: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300" },
  Ordered:  { dot: "bg-purple-500", badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" },
  "In Lab": { dot: "bg-amber-500", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
  Ready:    { dot: "bg-blue-500", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
  Delivered: { dot: "bg-emerald-500", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300" },
};

export default function Orders() {
  const toast = useToast();
  const { isStaff } = useAuth();
  const [filter, setFilter] = useState<string>("all");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [advanceModal, setAdvanceModal] = useState<{ order: any; nextStatus: string } | null>(null);
  const [advanceQty, setAdvanceQty] = useState(1);
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [showAll, setShowAll] = useState(false);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    const params = new URLSearchParams();
    if (!showAll) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    const res = await api.get<any[]>("/api/orders?" + params.toString());
    if (res.success && res.data) setList(res.data);
  }, [startDate, endDate, showAll]);

  useEffect(() => { fetchOrders().finally(() => setLoading(false)); }, [fetchOrders]);

  // Poll every 30s for real-time updates
  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Refetch on window focus
  useEffect(() => {
    const onFocus = () => fetchOrders();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchOrders]);

  async function doAdvance(order: any, nextStatus: string, advQty: number) {
    const qty = order.quantity || 1;
    const remaining = qty - (order.forwardedCount || 0);
    if (advQty <= 0) return;
    setStatusLoading(order._id);
    setList((prev) => prev.map((o) => o._id === order._id ? {
      ...o,
      forwardedCount: advQty < remaining ? (o.forwardedCount || 0) + advQty : 0,
      status: advQty < remaining ? o.status : nextStatus,
    } : o));
    try {
      const res = await api.patch<{ partial?: boolean }>(`/api/orders/${order._id}/status`, { status: nextStatus, advanceQuantity: advQty });
      if (!res.success) {
        toast.error(res.message || "Failed to update status");
      } else if (res.data?.partial) {
        toast.success(`${advQty} of ${qty} pair(s) moved to "${nextStatus}"`);
      } else if (nextStatus === "Ready") {
        toast.success("Order ready — pickup notification sent");
      } else {
        toast.success(`Order moved to "${nextStatus}"`);
      }
    } catch {
      toast.error("Failed to update status");
    }
    finally { setStatusLoading(null); fetchOrders(); }
  }

  function openAdvanceModal(order: any) {
    const next = VALID_NEXT[order.status];
    if (!next) return;
    const remaining = (order.quantity || 1) - (order.forwardedCount || 0);
    if (remaining <= 1) { doAdvance(order, next, 1); return; }
    setAdvanceQty(remaining);
    setAdvanceModal({ order, nextStatus: next });
  }

  async function confirmAdvance() {
    if (!advanceModal) return;
    const { order, nextStatus } = advanceModal;
    const remaining = (order.quantity || 1) - (order.forwardedCount || 0);
    const advQty = Math.min(advanceQty, remaining);
    setAdvanceModal(null);
    await doAdvance(order, nextStatus, advQty);
  }

  function customerName(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.name) return o.customerId.name;
    if (typeof o.customerId === "string") return o.customerId.slice(-6);
    return "\u2014";
  }

  function customerMobile(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.mobile) return o.customerId.mobile;
    return "";
  }

  if (loading) return <PageSkeleton page="orders" />;

  const filteredList = filter === "all" ? list : list.filter((o) => o.status === filter);

  const stats = {
    total: list.length,
    ordered: list.filter((o) => o.status === "Ordered" || o.status === "Draft").length,
    inLab: list.filter((o) => o.status === "In Lab").length,
    ready: list.filter((o) => o.status === "Ready").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Orders generated from visits.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: "all", label: "Total", value: stats.total, color: "text-gray-900 dark:text-white" },
          { key: "Ordered", label: "Ordered", value: stats.ordered, color: "text-purple-600 dark:text-purple-400" },
          { key: "In Lab", label: "In Lab", value: stats.inLab, color: "text-amber-600 dark:text-amber-400" },
          { key: "Ready", label: "Ready", value: stats.ready, color: "text-blue-600 dark:text-blue-400" },
        ].map((s) => (
          <button key={s.key} type="button" onClick={() => setFilter(s.key)}
            className={`card text-center py-4 px-3 cursor-pointer transition-all duration-150 ${
              filter === s.key ? "ring-2 ring-primary-500/30 border-primary-500 dark:border-primary-500" : ""
            }`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: "All Orders" },
          { key: "Draft", label: "Draft" },
          { key: "Ordered", label: "Ordered" },
          { key: "In Lab", label: "In Lab" },
          { key: "Ready", label: "Ready" },
          { key: "Delivered", label: "Delivered" },
        ].map((f) => (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                    filter === f.key
                      ? "bg-primary-600 text-white"
                      : "bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700"
                  }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); setShowAll(false); }} count={filteredList.length} label="order" />
        <button onClick={() => setShowAll(!showAll)}
          className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
            showAll
              ? "bg-primary-600 text-white"
              : "text-gray-600 dark:text-gray-400 bg-white dark:bg-dark-800 border border-gray-300 dark:border-dark-600 hover:bg-gray-50 dark:hover:bg-dark-700"
          }`}>
          All Orders
        </button>
      </div>

      {/* Orders grid */}
      {filteredList.length === 0 ? (
        <div className="card text-center py-16 border-dashed border-gray-300 dark:border-dark-500 bg-surface-50/50 dark:bg-dark-750/50">
          <Package size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredList.map((o: any) => {
            const theme = STATUS_THEME[o.status] || STATUS_THEME.Draft;
            const pending = o.billInfo?.pendingAmount || 0;
            return (
              <div key={o._id}
                className="group bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-600 overflow-hidden hover:shadow-md transition-all duration-300">
                {/* Top section */}
                <div className="p-5 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ${theme.badge}`}>
                        {customerName(o).charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate leading-tight">{customerName(o)}</p>
                        {customerMobile(o) && <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{customerMobile(o)}</p>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full ${theme.badge} flex-shrink-0`}>
                      {o.status}
                    </span>
                  </div>
                  {/* Order items */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {o.frameBrand ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 px-2 py-0.5 rounded-md text-indigo-700 dark:text-indigo-300 font-medium truncate max-w-full">
                        <Glasses size={11} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" /> {o.frameBrand}{o.frameModel ? ` ${o.frameModel}` : ""}
                      </span>
                    ) : o.frame ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 px-2 py-0.5 rounded-md text-indigo-700 dark:text-indigo-300 font-medium truncate max-w-full">
                        <Glasses size={11} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" /> {o.frame}
                      </span>
                    ) : null}
                    {o.lensBrand && (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 px-2 py-0.5 rounded-md text-sky-700 dark:text-sky-300 font-medium truncate max-w-full">
                        <Eye size={11} className="text-sky-500 dark:text-sky-400 flex-shrink-0" /> {o.lensBrand}{o.lens ? ` \u00B7 ${o.lens}` : ""}
                      </span>
                    )}
                    {(o.accessories || []).map((a: string, i: number) => {
                      const lower = a.toLowerCase();
                      const accIcon = lower.includes("clean") || lower.includes("solution") ? <FlaskConical size={11} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                        : lower.includes("contact") || lower.includes("lens") ? <Circle size={11} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
                        : <Package size={11} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />;
                      return (
                        <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-gray-50 dark:bg-dark-700 border border-gray-100 dark:border-dark-600 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300 font-medium truncate max-w-full">
                          {accIcon} {a}
                        </span>
                      );
                    })}
                  </div>
                  {/* Delivery + Amount */}
                  <div className="flex items-center justify-between text-[11px]">
                    {o.deliveryDate ? (
                      <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                        <Clock size={11} /> {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    ) : (
                      <span />
                    )}
                    {o.billInfo?.totalAmount > 0 && (
                      <span className="font-bold text-gray-900 dark:text-white tracking-tight">
                        \u20B9{o.billInfo.totalAmount.toLocaleString()}
                        {pending > 0 && <span className="text-[10px] text-amber-500 font-medium ml-1">({pending})</span>}
                      </span>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                {VALID_NEXT[o.status] && (
                  <div className="px-5 pb-2">
                    <DotProgress status={o.status} forwardedCount={o.forwardedCount} quantity={o.quantity} />
                  </div>
                )}
                {/* Partial progress indicator */}
                {(o.forwardedCount || 0) > 0 && (o.forwardedCount || 0) < (o.quantity || 1) && (
                  <div className="px-5 pb-2">
                    <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">
                      {o.forwardedCount} of {o.quantity} pair(s) advanced to {VALID_NEXT[o.status] || "next"}
                    </span>
                  </div>
                )}
                {/* Actions */}
                <div className="px-4 pb-4 pt-0">
                  <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-dark-700">
                    <button type="button" onClick={() => {
                      const cid = typeof o.customerId === "object" ? o.customerId?._id : o.customerId;
                      window.open(`/customers/${cid}?visitId=${o.visitId || ""}`, "_blank");
                    }}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 active:scale-[0.98] transition-all duration-150">
                      <Eye size={16} /> View
                    </button>
                    {!isStaff && VALID_NEXT[o.status] ? (
                      <button type="button" disabled={statusLoading === o._id} onClick={() => openAdvanceModal(o)}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
                        {statusLoading === o._id ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                        {VALID_NEXT[o.status]}
                      </button>
                    ) : (
                      <button type="button" onClick={() => {
                        const cid = typeof o.customerId === "object" ? o.customerId?._id : o.customerId;
                        window.open(`/customers/${cid}?visitId=${o.visitId || ""}`, "_blank");
                      }}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 active:scale-[0.98] transition-all duration-150">
                        <ArrowUpRight size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Advance quantity modal */}
      {advanceModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-fade-in" onClick={() => setAdvanceModal(null)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-600 p-6 max-w-sm w-full mx-4 shadow-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/50 rounded-xl flex items-center justify-center mx-auto mb-3">
              <ArrowUpRight size={20} className="text-primary-600 dark:text-primary-400" />
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white text-center mb-1">Mark as &quot;{advanceModal.nextStatus}&quot;</h3>
            <p className="text-xs text-gray-500 text-center mb-4">
              {advanceModal.order.quantity > 1
                ? `How many of ${advanceModal.order.quantity} pair(s) to advance?`
                : `Advance this order to &quot;${advanceModal.nextStatus}&quot;?`}
            </p>
            {advanceModal.order.quantity > 1 && (
              <div className="flex items-center justify-center gap-3 mb-4">
                <button onClick={() => setAdvanceQty(Math.max(1, advanceQty - 1))}
                  className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
                  <Minus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
                <span className="text-xl font-bold text-gray-900 dark:text-white w-10 text-center">{advanceQty}</span>
                <button onClick={() => setAdvanceQty(Math.min((advanceModal.order.quantity || 1) - (advanceModal.order.forwardedCount || 0), advanceQty + 1))}
                  className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-dark-700 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors">
                  <Plus size={16} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            )}
            {(advanceModal.order.forwardedCount || 0) > 0 && (
              <p className="text-xs text-amber-500 text-center mb-2">
                {advanceModal.order.forwardedCount} of {advanceModal.order.quantity} already advanced. Remaining: {(advanceModal.order.quantity || 1) - (advanceModal.order.forwardedCount || 0)}
              </p>
            )}
            <div className="space-y-1.5">
              <button onClick={confirmAdvance} disabled={statusLoading === advanceModal.order._id}
                className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 text-sm font-semibold disabled:opacity-50">
                {statusLoading === advanceModal.order._id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {advanceQty < ((advanceModal.order.quantity || 1) - (advanceModal.order.forwardedCount || 0))
                  ? `Advance ${advanceQty} of ${advanceModal.order.quantity} pair(s)`
                  : `Mark All as ${advanceModal.nextStatus}`}
              </button>
              <button onClick={() => setAdvanceModal(null)} disabled={statusLoading === advanceModal.order._id}
                className="w-full btn-secondary py-2.5">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

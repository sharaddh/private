import React, { useEffect, useState } from "react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import { useCachedData } from "../hooks/useCachedData";
import PageSkeleton from "../components/PageSkeleton";
import { Skeleton, SkeletonStats, SkeletonCard } from "../components/Skeleton";
import { Eye, Clock, Package, Glasses, FlaskConical, Circle, ArrowUpRight, Loader2 } from "lucide-react";
import DateRangePicker from "../components/DateRangePicker";

const STATUS_STEPS = ["Draft", "Ordered", "In Lab", "Ready", "Delivered"];

const VALID_NEXT: Record<string, string> = {
  Draft: "Ordered",
  Ordered: "In Lab",
  "In Lab": "Ready",
};

function DotProgress({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status);
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
            {i < currentIdx ? "✓" : i + 1}
          </div>
          {i < 3 && (
            <div className={`flex-1 h-0.5 mx-1 rounded transition-all duration-300 ${
              i < currentIdx ? "bg-primary-500" : "bg-gray-200 dark:bg-dark-600"
            }`} />
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
  const [filter, setFilter] = useState<string>("all");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const params = new URLSearchParams({ startDate, endDate });
  const cacheKey = `/api/orders?${params.toString()}`;
  const { data: rawList, loading, refetch } = useCachedData<any[]>(cacheKey,
    () => api.get("/api/orders?" + params.toString()),
    [startDate, endDate]
  );
  const [list, setList] = useState<any[]>(() => rawList || []);

  useEffect(() => {
    if (rawList) setList(rawList);
  }, [rawList]);

  async function advanceStatus(order: any) {
    const next = VALID_NEXT[order.status];
    if (!next) return;
    const prevStatus = order.status;
    setStatusLoading(order._id);
    setList((prev) => prev.map((o) => o._id === order._id ? { ...o, status: next } : o));
    toast.success(next === "Ready" ? "Order moved to Ready" : `Order moved to "${next}"`);
    try {
      const res = await api.patch(`/api/orders/${order._id}/status`, { status: next });
      if (!res.success) {
        setList((prev) => prev.map((o) => o._id === order._id ? { ...o, status: prevStatus } : o));
        toast.error(res.message || "Failed to update status");
      } else if (next === "Ready") {
        toast.success("Order ready — pickup notification sent");
      }
    } catch {
      setList((prev) => prev.map((o) => o._id === order._id ? { ...o, status: prevStatus } : o));
      toast.error("Failed to update status");
    }
    finally { setStatusLoading(null); }
  }

  function customerName(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.name) return o.customerId.name;
    if (typeof o.customerId === "string") return o.customerId.slice(-6);
    return "—";
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
            className={`relative card text-center py-5 px-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
              filter === s.key ? "ring-2 ring-primary-500/40 ring-offset-2 dark:ring-offset-dark-850" : ""
            }`}>
            <p className={`text-3xl font-bold tracking-tight ${s.color}`}>{s.value}</p>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5">{s.label}</p>
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
            className={`px-4 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-200 ${
              filter === f.key
                ? "bg-primary-600 text-white shadow-sm"
                : "bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} count={filteredList.length} label="order" />

      {/* Orders grid */}
      {filteredList.length === 0 ? (
        <div className="card text-center py-16">
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
                className="group relative bg-white dark:bg-dark-800 rounded-2xl shadow-sm border border-gray-100 dark:border-dark-700 overflow-hidden">
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
                        <Eye size={11} className="text-sky-500 dark:text-sky-400 flex-shrink-0" /> {o.lensBrand}{o.lens ? ` · ${o.lens}` : ""}
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
                        ₹{o.billInfo.totalAmount.toLocaleString()}
                        {pending > 0 && <span className="text-[10px] text-amber-500 font-medium ml-1">({pending})</span>}
                      </span>
                    )}
                  </div>
                </div>
                {/* Progress bar */}
                {VALID_NEXT[o.status] && (
                  <div className="px-5 pb-2">
                    <DotProgress status={o.status} />
                  </div>
                )}
                {/* Actions */}
                <div className="px-5 pb-5 pt-0">
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                    <button type="button" onClick={() => {
                      const cid = typeof o.customerId === "object" ? o.customerId?._id : o.customerId;
                      window.open(`/customers/${cid}?visitId=${o.visitId || ""}`, "_blank");
                    }}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 active:scale-[0.98] transition-all duration-200 shadow-sm">
                      <Eye size={16} /> View Details
                    </button>
                    {VALID_NEXT[o.status] ? (
                      <button type="button" disabled={statusLoading === o._id} onClick={() => advanceStatus(o)}
                        className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 hover:bg-primary-100 dark:hover:bg-primary-900/50 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
                        {statusLoading === o._id ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                        Mark as {VALID_NEXT[o.status]}
                      </button>
                    ) : (
                      <button type="button" onClick={() => {
                        const cid = typeof o.customerId === "object" ? o.customerId?._id : o.customerId;
                        window.open(`/customers/${cid}?visitId=${o.visitId || ""}`, "_blank");
                      }}
                        className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-dark-700 hover:bg-gray-200 dark:hover:bg-dark-600 active:scale-[0.98] transition-all duration-200">
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
    </div>
  );
}

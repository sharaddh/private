import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Eye, ChevronRight, Clock, Package } from "lucide-react";

const STATUS_STEPS = ["Draft", "Ordered", "In Lab", "Ready", "Delivered"];

const STATUS_THEME: Record<string, { bar: string; dot: string; border: string; gradient: string; badge: string; glow: string }> = {
  Draft:    { bar: "bg-gray-300 dark:bg-gray-600", dot: "bg-gray-400 dark:bg-gray-500", border: "border-l-gray-400 dark:border-l-gray-500", gradient: "from-gray-50 to-white dark:from-dark-800 dark:to-dark-850", badge: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300", glow: "shadow-gray-200/50 dark:shadow-gray-800/50" },
  Ordered:  { bar: "bg-purple-500", dot: "bg-purple-500", border: "border-l-purple-500", gradient: "from-purple-50 to-white dark:from-purple-950/30 dark:to-dark-850", badge: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300", glow: "shadow-purple-200/50 dark:shadow-purple-800/30" },
  "In Lab": { bar: "bg-amber-500", dot: "bg-amber-500", border: "border-l-amber-500", gradient: "from-amber-50 to-white dark:from-amber-950/30 dark:to-dark-850", badge: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300", glow: "shadow-amber-200/50 dark:shadow-amber-800/30" },
  Ready:    { bar: "bg-blue-500", dot: "bg-blue-500", border: "border-l-blue-500", gradient: "from-blue-50 to-white dark:from-blue-950/30 dark:to-dark-850", badge: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300", glow: "shadow-blue-200/50 dark:shadow-blue-800/30" },
  Delivered: { bar: "bg-emerald-500", dot: "bg-emerald-500", border: "border-l-emerald-500", gradient: "from-emerald-50 to-white dark:from-emerald-950/30 dark:to-dark-850", badge: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300", glow: "shadow-emerald-200/50 dark:shadow-emerald-800/30" },
};

const VALID_NEXT: Record<string, string> = {
  Draft: "Ordered",
  Ordered: "In Lab",
  "In Lab": "Ready",
};

function DotProgress({ currentIdx }: { currentIdx: number }) {
  const labels = ["Draft", "Ordered", "In Lab", "Ready"];
  return (
    <div className="flex items-center w-full gap-0">
      {labels.map((l, i) => {
        const done = currentIdx > i;
        const active = currentIdx === i;
        return (
          <div key={l} className="flex items-center flex-1 last:flex-none">
            <div className={`relative w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold transition-all duration-500 ${
              active ? "bg-indigo-500 shadow-lg shadow-indigo-300/50 dark:shadow-indigo-700/50 scale-110" :
              done ? "bg-emerald-400 shadow-sm" : "bg-gray-200 dark:bg-dark-700"
            }`}>
              {done ? (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              ) : (
                <span className={active ? "text-white" : "text-gray-400 dark:text-gray-600"}>{i + 1}</span>
              )}
            </div>
            {i < labels.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 rounded-full transition-all duration-500 ${done || active ? "bg-indigo-400" : "bg-gray-200 dark:bg-dark-700"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => { fetchOrders(); }, []);

  function fetchOrders() {
    api.get("/api/orders").then((d) => { if (d.success) setList(d.data || []); });
  }

  async function advanceStatus(order: any) {
    const next = VALID_NEXT[order.status];
    if (!next) return;
    setStatusLoading(order._id);
    try {
      const res = await api.patch(`/api/orders/${order._id}/status`, { status: next });
      if (res.success) fetchOrders();
    } finally { setStatusLoading(null); }
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

  function customerId(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?._id) return o.customerId._id;
    return o.customerId || "";
  }

  const filteredList = filter === "all" ? list : list.filter((o) => o.status === filter);

  const stats = {
    total: list.length,
    ordered: list.filter((o) => o.status === "Ordered" || o.status === "Draft").length,
    inLab: list.filter((o) => o.status === "In Lab").length,
    ready: list.filter((o) => o.status === "Ready").length,
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Orders generated from visits — track from processing to delivery.</p>
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
          <button key={s.key} onClick={() => setFilter(s.key)}
            className={`relative card text-center py-4 px-3 cursor-pointer transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
              filter === s.key ? "ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-dark-850" : ""
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
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
              filter === f.key
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200/50 dark:shadow-indigo-900/30"
                : "bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700 hover:border-gray-300 dark:hover:border-dark-600"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Orders grid */}
      {filteredList.length === 0 ? (
        <div className="card text-center py-16">
          <Package size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-400 dark:text-gray-500 text-sm">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {filteredList.map((o: any) => {
            const currentIdx = STATUS_STEPS.indexOf(o.status);
            const nextStep = VALID_NEXT[o.status];
            const theme = STATUS_THEME[o.status] || STATUS_THEME.Draft;
            const pending = o.billInfo?.pendingAmount || 0;
            return (
              <div key={o._id}
                className={`group relative bg-white dark:bg-dark-800 rounded-2xl border-l-[5px] ${theme.border} ${theme.glow} shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-br ${theme.gradient} overflow-hidden`}>
                {/* Top section */}
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 shadow-sm ${theme.badge}`}>
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
                  {/* Order items as pills */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {o.frame && <span className="text-[11px] bg-white dark:bg-dark-700 border border-gray-100 dark:border-dark-600 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300 font-medium truncate max-w-full">🖼 {o.frame}</span>}
                    {o.lens && <span className="text-[11px] bg-white dark:bg-dark-700 border border-gray-100 dark:border-dark-600 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300 font-medium truncate max-w-full">💎 {o.lens}</span>}
                    {o.coating && <span className="text-[11px] bg-white dark:bg-dark-700 border border-gray-100 dark:border-dark-600 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300 font-medium truncate max-w-full">✨ {o.coating}</span>}
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
                {/* Progress bar section */}
                <div className="px-4 pb-3 pt-1">
                  <DotProgress currentIdx={currentIdx} />
                </div>
                {/* Actions bar */}
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 dark:bg-dark-900/50 border-t border-gray-100 dark:border-dark-700">
                  <button onClick={() => navigate(`/customers/${customerId(o)}?visitId=${o.visitId || ""}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-dark-700 transition-all duration-200">
                    <Eye size={13} /> View
                  </button>
                  {nextStep && (
                    <button onClick={() => advanceStatus(o)} disabled={statusLoading === o._id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-all duration-200">
                      {statusLoading === o._id
                        ? <div className="animate-spin w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        : <ChevronRight size={13} />}
                      {nextStep}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

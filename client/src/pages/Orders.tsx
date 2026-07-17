import React, { useEffect, useState, useCallback } from "react";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useTranslate } from "../context/TranslateContext";
import PageSkeleton from "../components/PageSkeleton";
import { Eye, Clock, Package, Glasses, FlaskConical, Circle, ArrowUpRight, Loader2, Minus, Plus, Check } from "lucide-react";
import DateRangePicker from "../components/DateRangePicker";
import { orderService } from "../services";
import type { Order, OrderStatus, Customer } from "../types";

const STATUS_STEPS: readonly OrderStatus[] = ["Draft", "Ordered", "In Lab", "Ready", "Delivered"] as const;

const VALID_NEXT: Record<OrderStatus, OrderStatus | undefined> = {
  Draft: "Ordered",
  Ordered: "In Lab",
  "In Lab": "Ready",
  Ready: undefined,
  Delivered: undefined,
  Cancelled: undefined,
};

interface OrderCard extends Order {
  frame?: string;
  accessories?: string[];
}

function DotProgress({ status, forwardedCount, quantity }: { status: OrderStatus; forwardedCount?: number; quantity?: number }) {
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
              ? "bg-[#1ed760] text-black"
              : i === currentIdx
              ? "ring-2 ring-[#1ed760]/50 bg-[#1ed760] text-black"
              : "bg-th-elevated text-th-secondary"
          }`}>
            {i < currentIdx ? "\u2713" : i + 1}
          </div>
          {i < 3 && (
            <div className={`flex-1 h-0.5 mx-1 rounded transition-all duration-300 relative overflow-hidden ${
              i < currentIdx ? "bg-[#1ed760]" : "bg-th-elevated"
            }`}>
              {i === currentIdx && pct > 0 && (
                <div className="absolute inset-0 bg-[#1ed760] transition-all duration-500" style={{ width: `${pct * 100}%` }} />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const STATUS_THEME: Record<OrderStatus, { dot: string; badge: string }> = {
  Draft:    { dot: "bg-[#b3b3b3]", badge: "bg-th-elevated text-th-secondary" },
  Ordered:  { dot: "bg-[#af2896]", badge: "bg-[#af2896]/20 text-[#e854c7]" },
  "In Lab": { dot: "bg-[#e8115b]", badge: "bg-[#e8115b]/20 text-[#ff6b8a]" },
  Ready:    { dot: "bg-[#509bf5]", badge: "bg-[#509bf5]/20 text-[#82b6ff]" },
  Delivered: { dot: "bg-[#1ed760]", badge: "bg-[#1ed760]/20 text-[#1ed760]" },
  Cancelled: { dot: "bg-[#b3b3b3]", badge: "bg-th-elevated text-th-secondary" },
};

function todayStr(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function Orders() {
  const toast = useToast();
  const { isStaff } = useAuth();
  const { uiT } = useTranslate();
  const [filter, setFilter] = useState<string>("all");
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [advanceModal, setAdvanceModal] = useState<{ order: OrderCard; nextStatus: OrderStatus } | null>(null);
  const [advanceQty, setAdvanceQty] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>(todayStr());
  const [endDate, setEndDate] = useState<string>(todayStr());
  const [showAll, setShowAll] = useState<boolean>(false);
  const [list, setList] = useState<OrderCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchOrders = useCallback(async () => {
    const params: Record<string, string> = {};
    if (!showAll) {
      params.startDate = startDate;
      params.endDate = endDate;
    }
    const res = await orderService.listFiltered(params);
    if (res.success && res.data) setList(res.data.data as OrderCard[]);
  }, [startDate, endDate, showAll]);

  useEffect(() => { fetchOrders().finally(() => setLoading(false)); }, [fetchOrders]);

  useEffect(() => {
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  useEffect(() => {
    const onFocus = () => fetchOrders();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchOrders]);

  async function doAdvance(order: OrderCard, nextStatus: OrderStatus, advQty: number): Promise<void> {
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
      const res = await orderService.advanceStatus(order._id, nextStatus, advQty);
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

  function openAdvanceModal(order: OrderCard): void {
    const next = VALID_NEXT[order.status];
    if (!next) return;
    const remaining = (order.quantity || 1) - (order.forwardedCount || 0);
    if (remaining <= 1) { doAdvance(order, next, 1); return; }
    setAdvanceQty(remaining);
    setAdvanceModal({ order, nextStatus: next });
  }

  async function confirmAdvance(): Promise<void> {
    if (!advanceModal) return;
    const { order, nextStatus } = advanceModal;
    const remaining = (order.quantity || 1) - (order.forwardedCount || 0);
    const advQty = Math.min(advanceQty, remaining);
    setAdvanceModal(null);
    await doAdvance(order, nextStatus, advQty);
  }

  function customerName(o: OrderCard): string {
    if (typeof o.customerId === "object" && o.customerId?.name) return o.customerId.name;
    if (typeof o.customerId === "string") return o.customerId.slice(-6);
    return "\u2014";
  }

  function customerMobile(o: OrderCard): string {
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
          <h1 className="text-2xl font-bold text-th-text tracking-tight">{uiT("Orders", "ऑर्डर")}</h1>
          <p className="text-sm text-th-secondary mt-1">Orders generated from visits.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { key: "all", label: uiT("Total", "कुल"), value: stats.total, color: "text-th-text" },
          { key: "Ordered", label: uiT("Ordered", "ऑर्डर किया"), value: stats.ordered, color: "text-[#e854c7]" },
          { key: "In Lab", label: uiT("In Lab", "लैब में"), value: stats.inLab, color: "text-[#ff6b8a]" },
          { key: "Ready", label: uiT("Ready", "तैयार"), value: stats.ready, color: "text-[#82b6ff]" },
        ].map((s) => (
          <button key={s.key} type="button" onClick={() => setFilter(s.key)}
            aria-label={`Filter by ${s.label}: ${s.value}`}
            className={`bg-th-surface rounded-lg text-center py-4 px-3 cursor-pointer transition-all duration-150 hover:bg-th-hover ${
              filter === s.key ? "ring-2 ring-[#1ed760]/50" : ""
            }`}>
            <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-sm font-medium text-th-secondary mt-1">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: "all", label: uiT("All Orders", "सभी ऑर्डर") },
          { key: "Draft", label: uiT("Draft", "ड्राफ्ट") },
          { key: "Ordered", label: uiT("Ordered", "ऑर्डर किया") },
          { key: "In Lab", label: uiT("In Lab", "लैब में") },
          { key: "Ready", label: uiT("Ready", "तैयार") },
          { key: "Delivered", label: uiT("Delivered", "डिलीवर हो गया") },
        ].map((f) => (
                <button key={f.key} type="button" onClick={() => setFilter(f.key)}
                  aria-label={`Show ${f.label} orders`}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider whitespace-nowrap transition-all duration-150 ${
                    filter === f.key
                      ? "bg-[#1ed760] text-black"
                      : "bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text"
                  }`}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s: string, e: string) => { setStartDate(s); setEndDate(e); setShowAll(false); }} count={filteredList.length} label="order" />
        <button onClick={() => setShowAll(!showAll)}
          aria-label={showAll ? "Show filtered orders" : "Show all orders"}
          className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150 ${
            showAll
              ? "bg-[#1ed760] text-black"
              : "text-th-secondary bg-th-elevated hover:bg-th-hover hover:text-th-text"
          }`}>
          {uiT("All Orders", "सभी ऑर्डर")}
        </button>
      </div>

      {/* Orders grid */}
      {filteredList.length === 0 ? (
        <div className="bg-th-surface rounded-lg text-center py-16">
          <Package size={40} className="mx-auto text-[#535353] mb-3" />
          <p className="text-th-secondary text-sm">{uiT("No orders found", "कोई ऑर्डर नहीं मिला")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredList.map((o) => {
            const theme = STATUS_THEME[o.status] || STATUS_THEME.Draft;
            const pending = o.billInfo?.pendingAmount || 0;
            return (
              <div key={o._id}
                className="group bg-th-surface rounded-lg overflow-hidden transition-all duration-150 hover:bg-th-hover shadow-lg">
                {/* Top section */}
                <div className="p-5 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${theme.badge}`}>
                        {customerName(o).charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-th-text truncate leading-tight">{customerName(o)}</p>
                        {customerMobile(o) && <p className="text-[11px] text-th-secondary truncate">{customerMobile(o)}</p>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-lg ${theme.badge} flex-shrink-0`}>
                      {o.status}
                    </span>
                  </div>
                  {/* Order items */}
                  <div className="flex flex-wrap gap-1.5 mb-2.5">
                    {o.frameBrand ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-th-elevated px-2 py-0.5 rounded-sm text-th-secondary font-medium truncate max-w-full">
                        <Glasses size={11} className="text-th-secondary flex-shrink-0" /> {o.frameBrand}{o.frameModel ? ` ${o.frameModel}` : ""}
                      </span>
                    ) : o.frame ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-th-elevated px-2 py-0.5 rounded-sm text-th-secondary font-medium truncate max-w-full">
                        <Glasses size={11} className="text-th-secondary flex-shrink-0" /> {o.frame}
                      </span>
                    ) : null}
                    {o.lensBrand && (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-th-elevated px-2 py-0.5 rounded-sm text-th-secondary font-medium truncate max-w-full">
                        <Eye size={11} className="text-th-secondary flex-shrink-0" /> {o.lensBrand}{o.lensType ? ` \u00B7 ${o.lensType}` : ""}
                      </span>
                    )}
                    {(o.accessories || []).map((a: string, i: number) => {
                      const lower = a.toLowerCase();
                      const accIcon = lower.includes("clean") || lower.includes("solution") ? <FlaskConical size={11} className="text-[#1ed760] flex-shrink-0" />
                        : lower.includes("contact") || lower.includes("lens") ? <Circle size={11} className="text-[#e8115b] flex-shrink-0" />
                        : <Package size={11} className="text-th-secondary flex-shrink-0" />;
                      return (
                        <span key={a || i} className="inline-flex items-center gap-1 text-[11px] bg-th-elevated px-2 py-0.5 rounded-sm text-th-secondary font-medium truncate max-w-full">
                          {accIcon} {a}
                        </span>
                      );
                    })}
                  </div>
                  {/* Delivery + Amount */}
                  <div className="flex items-center justify-between text-[11px]">
                    {o.deliveryDate ? (
                      <span className="flex items-center gap-1 text-th-secondary">
                        <Clock size={11} /> {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                    ) : (
                      <span />
                    )}
                    {(o.billInfo?.totalAmount ?? 0) > 0 && (
                      <span className="font-bold text-th-text tracking-tight">
                        \u20B9{(o.billInfo?.totalAmount ?? 0).toLocaleString()}
                        {pending > 0 && <span className="text-[10px] text-[#e8115b] font-medium ml-1">({pending})</span>}
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
                    <span className="text-[11px] font-medium text-[#e8115b] bg-[#e8115b]/10 px-2.5 py-1 rounded-lg">
                      {o.forwardedCount} of {o.quantity} pair(s) advanced to {VALID_NEXT[o.status] || "next"}
                    </span>
                  </div>
                )}
                {/* Actions */}
                <div className="px-4 pb-4 pt-0">
                  <div className="flex items-center gap-2 pt-3 border-t border-th-hover">
                    <button type="button" onClick={() => {
                      const cid = typeof o.customerId === "object" ? o.customerId?._id : o.customerId;
                      window.open(`/customers/${cid}?visitId=${o.visitId || ""}`, "_blank");
                    }}
                      aria-label={`View order for ${customerName(o)}`}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-black bg-[#1ed760] hover:bg-[#1fdf64] active:scale-95 transition-all duration-150">
                      <Eye size={16} /> View
                    </button>
                    {!isStaff && VALID_NEXT[o.status] ? (
                      <button type="button" disabled={statusLoading === o._id} onClick={() => openAdvanceModal(o)}
                        aria-label={`Advance order to ${VALID_NEXT[o.status]}`}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-[#1ed760] bg-[#1ed760]/10 hover:bg-[#1ed760]/20 active:scale-95 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed">
                        {statusLoading === o._id ? <Loader2 size={16} className="animate-spin" /> : <ArrowUpRight size={16} />}
                        {VALID_NEXT[o.status]}
                      </button>
                    ) : (
                      <button type="button" onClick={() => {
                        const cid = typeof o.customerId === "object" ? o.customerId?._id : o.customerId;
                        window.open(`/customers/${cid}?visitId=${o.visitId || ""}`, "_blank");
                      }}
                        aria-label={`Open customer page for ${customerName(o)}`}
                        className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-th-secondary bg-th-elevated hover:bg-th-hover active:scale-95 transition-all duration-150">
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => setAdvanceModal(null)}>
          <div className="bg-th-surface rounded-lg p-6 max-w-sm w-full animate-scale-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-10 bg-[#1ed760]/10 rounded-sm flex items-center justify-center mx-auto mb-3">
              <ArrowUpRight size={20} className="text-[#1ed760]" />
            </div>
            <h3 className="text-base font-bold text-th-text text-center mb-1">Mark as &quot;{advanceModal.nextStatus}&quot;</h3>
            <p className="text-xs text-th-secondary text-center mb-4">
              {advanceModal.order.quantity && advanceModal.order.quantity > 1
                ? `How many of ${advanceModal.order.quantity} pair(s) to advance?`
                : `Advance this order to &quot;${advanceModal.nextStatus}&quot;?`}
            </p>
            {advanceModal.order.quantity && advanceModal.order.quantity > 1 && (
              <div className="flex items-center justify-center gap-3 mb-4">
                <button onClick={() => setAdvanceQty(Math.max(1, advanceQty - 1))}
                  aria-label="Decrease quantity"
                  className="w-9 h-9 rounded-full bg-th-elevated flex items-center justify-center hover:bg-th-hover transition-colors">
                  <Minus size={16} className="text-th-secondary" />
                </button>
                <span className="text-xl font-bold text-th-text w-10 text-center">{advanceQty}</span>
                <button onClick={() => setAdvanceQty(Math.min((advanceModal.order.quantity || 1) - (advanceModal.order.forwardedCount || 0), advanceQty + 1))}
                  aria-label="Increase quantity"
                  className="w-9 h-9 rounded-full bg-th-elevated flex items-center justify-center hover:bg-th-hover transition-colors">
                  <Plus size={16} className="text-th-secondary" />
                </button>
              </div>
            )}
            {(advanceModal.order.forwardedCount || 0) > 0 && (
              <p className="text-xs text-[#e8115b] text-center mb-2">
                {advanceModal.order.forwardedCount} of {advanceModal.order.quantity} already advanced. Remaining: {(advanceModal.order.quantity || 1) - (advanceModal.order.forwardedCount || 0)}
              </p>
            )}
            <div className="space-y-1.5">
              <button onClick={confirmAdvance} disabled={statusLoading === advanceModal.order._id}
                aria-label={`Confirm advance ${advanceQty} pair(s) to ${advanceModal.nextStatus}`}
                className="w-full bg-[#1ed760] text-black rounded-lg flex items-center justify-center gap-2 py-2.5 text-sm font-semibold hover:bg-[#1fdf64] disabled:opacity-50 transition-all duration-150">
                {statusLoading === advanceModal.order._id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {advanceModal.order.quantity && advanceQty < ((advanceModal.order.quantity || 1) - (advanceModal.order.forwardedCount || 0))
                  ? `Advance ${advanceQty} of ${advanceModal.order.quantity} pair(s)`
                  : `Mark All as ${advanceModal.nextStatus}`}
              </button>
              <button onClick={() => setAdvanceModal(null)} disabled={statusLoading === advanceModal.order._id}
                aria-label="Cancel advance"
                className="w-full bg-th-elevated text-th-secondary rounded-lg py-2.5 text-sm font-semibold hover:bg-th-hover transition-all duration-150 disabled:opacity-50">{uiT("Cancel", "रद्द करें")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

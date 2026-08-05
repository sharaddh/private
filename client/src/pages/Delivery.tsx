import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CheckCircle, Clock, FlaskConical, Loader2, Package, Search, Truck, Wallet } from "lucide-react";
import PageSkeleton from "../components/PageSkeleton";
import ShineCard from "../components/ShineCard";
import DateRangePicker from "../components/DateRangePicker";
import { orderService } from "../services";
import { useCachedData } from "../hooks/useCachedData";
import { invalidateCache } from "../hooks/useCache";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";
import { todayStr, toDateKey, formatDate } from "../utils/date";

type View = "ready" | "all" | "delivered";

const NON_DELIVERED_STATUSES = ["Draft", "Ordered", "In Lab", "Ready"] as const;
const STATUS_ORDER: readonly string[] = ["Ready", "In Lab", "Ordered", "Draft"];

const STATUS_DOT: Record<string, string> = {
  Draft: "bg-[#b3b3b3]",
  Ordered: "bg-[#af2896]",
  "In Lab": "bg-[#e8115b]",
  Ready: "bg-[#509bf5]",
  Delivered: "bg-[#1ed760]",
  Cancelled: "bg-[#b3b3b3]",
};

const STATUS_BADGE: Record<string, string> = {
  Draft: "bg-th-elevated text-th-secondary",
  Ordered: "bg-[#af2896]/20 text-[#e854c7]",
  "In Lab": "bg-[#e8115b]/20 text-[#ff6b8a]",
  Ready: "bg-[#509bf5]/20 text-[#82b6ff]",
  Delivered: "bg-[#1ed760]/20 text-[#1ed760]",
  Cancelled: "bg-th-elevated text-th-secondary",
};

const STAT_STYLE: Record<string, { icon: typeof Truck; color: string; bg: string }> = {
  Ready: { icon: Truck, color: "text-[#509bf5]", bg: "bg-[#509bf5]/10" },
  "In Lab": { icon: FlaskConical, color: "text-[#ff6b8a]", bg: "bg-[#ff6b8a]/10" },
  Ordered: { icon: Package, color: "text-[#e854c7]", bg: "bg-[#e854c7]/10" },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyOrder = any;

export default function Delivery() {
  const { uiT } = useTranslate();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [view, setView] = useState<View>("ready");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [confirmOrder, setConfirmOrder] = useState<AnyOrder | null>(null);
  const [delivering, setDelivering] = useState(false);

  const readyKey = "/api/orders?status=Ready&limit=10000";
  const { data: readyData, loading: readyLoading, refetch: refetchReady } = useCachedData<AnyOrder[]>(readyKey,
    async () => {
      const res = await orderService.listFiltered({ status: "Ready", limit: "10000" });
      return { success: res.success, data: res.data?.data ?? [] };
    },
    []
  );

  const allKey = `/api/orders?status=${encodeURIComponent(NON_DELIVERED_STATUSES.join(","))}&limit=10000`;
  const { data: allData, loading: allLoading, refetch: refetchAll } = useCachedData<AnyOrder[]>(allKey,
    async () => {
      const res = await orderService.listFiltered({ status: NON_DELIVERED_STATUSES.join(","), limit: "10000" });
      return { success: res.success, data: res.data?.data ?? [] };
    },
    []
  );

  const deliveredKey = `/api/orders?status=Delivered&dateField=actualDeliveryDate&startDate=${startDate}&endDate=${endDate}&limit=10000`;
  const { data: deliveredData, loading: deliveredLoading, refetch: refetchDelivered } = useCachedData<AnyOrder[]>(deliveredKey,
    async () => {
      const res = await orderService.listFiltered({
        status: "Delivered",
        dateField: "actualDeliveryDate",
        startDate,
        endDate,
        limit: "10000",
      });
      return { success: res.success, data: res.data?.data ?? [] };
    },
    [startDate, endDate]
  );

  const readyOrders = readyData ?? [];
  const allOrders = allData ?? [];
  const deliveredOrders = deliveredData ?? [];

  // Auto-open delivery confirmation when arriving from the dashboard (?order=<id>)
  useEffect(() => {
    const targetId = searchParams.get("order");
    if (!targetId || readyOrders.length === 0) return;
    const target = readyOrders.find((o) => o._id === targetId);
    if (target) {
      setView("ready");
      if (pendingAmount(target) > 0) {
        navigate(`/pickup?orderId=${target._id}&collect=true`, { replace: true });
      } else {
        setConfirmOrder(target);
        navigate("/delivery", { replace: true });
      }
    } else {
      navigate("/delivery", { replace: true });
    }
  }, [searchParams, readyOrders, navigate]);

  const todayReady = useMemo(
    () => readyOrders.filter((o) => !!o.deliveryDate && toDateKey(o.deliveryDate) === todayStr()),
    [readyOrders]
  );

  const filteredReady = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return todayReady;
    return todayReady.filter((o) => {
      const name = typeof o.customerId === "object" ? (o.customerId?.name || "") : "";
      const mobile = typeof o.customerId === "object" ? (o.customerId?.mobile || "") : "";
      return name.toLowerCase().includes(q) || mobile.includes(q);
    });
  }, [todayReady, search]);

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOrders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      const name = typeof o.customerId === "object" ? (o.customerId?.name || "") : "";
      const mobile = typeof o.customerId === "object" ? (o.customerId?.mobile || "") : "";
      return name.toLowerCase().includes(q) || mobile.includes(q);
    });
  }, [allOrders, statusFilter, search]);

  const groups = useMemo(
    () =>
      STATUS_ORDER
        .map((status) => ({ status, orders: filteredAll.filter((o) => o.status === status) }))
        .filter((g) => g.orders.length > 0),
    [filteredAll]
  );

  const stats = useMemo(() => ({
    ready: allOrders.filter((o) => o.status === "Ready").length,
    inLab: allOrders.filter((o) => o.status === "In Lab").length,
    ordered: allOrders.filter((o) => o.status === "Ordered").length,
    draft: allOrders.filter((o) => o.status === "Draft").length,
    overdue: allOrders.filter((o) => isOverdue(o)).length,
  }), [allOrders]);

  function statusCount(st: string): number {
    switch (st) {
      case "Ready": return stats.ready;
      case "In Lab": return stats.inLab;
      case "Ordered": return stats.ordered;
      case "Draft": return stats.draft;
      default: return 0;
    }
  }

  function custName(o: AnyOrder): string {
    if (typeof o.customerId === "object" && o.customerId?.name) return o.customerId.name;
    return "—";
  }

  function custMobile(o: AnyOrder): string {
    if (typeof o.customerId === "object" && o.customerId?.mobile) return o.customerId.mobile;
    return "";
  }

  function custId(o: AnyOrder): string {
    if (typeof o.customerId === "object" && o.customerId?._id) return o.customerId._id;
    return o.customerId || "";
  }

  function isOverdue(o: AnyOrder): boolean {
    return !!o.deliveryDate && new Date(o.deliveryDate) < new Date(todayStr());
  }

  function overdueDays(o: AnyOrder): number {
    if (!isOverdue(o)) return 0;
    const d = new Date(o.deliveryDate);
    const today = new Date(todayStr());
    return Math.max(1, Math.round((today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)));
  }

  function dueLabel(o: AnyOrder): string {
    const dateStr: string | undefined = o.deliveryDate;
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const today = new Date(todayStr());
    const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}d ${uiT("ago", "पहले")}`;
    if (diff === 0) return uiT("Today", "आज");
    if (diff === 1) return uiT("Tomorrow", "कल");
    return `${diff}d`;
  }

  function pendingAmount(o: AnyOrder): number {
    return o.billInfo?.pendingAmount || 0;
  }

  const doDeliver = useCallback(async (o: AnyOrder) => {
    setDelivering(true);
    const res = await orderService.advanceStatus(o._id, "Delivered");
    setDelivering(false);
    setConfirmOrder(null);
    if (res.success) {
      toast.success(uiT("Order delivered!", "ऑर्डर डिलीवर हो गया!"));
      invalidateCache(readyKey);
      invalidateCache(allKey);
      invalidateCache(deliveredKey);
      refetchReady();
      refetchAll();
      refetchDelivered();
    } else {
      toast.error(res.message || "Failed");
    }
  }, [readyKey, allKey, deliveredKey, refetchReady, refetchAll, refetchDelivered, toast, uiT]);

  const openDeliver = (o: AnyOrder) => {
    if (pendingAmount(o) > 0) {
      navigate(`/pickup?orderId=${o._id}&collect=true`);
    } else {
      setConfirmOrder(o);
    }
  };

  const loading = view === "ready" ? readyLoading : view === "all" ? allLoading : deliveredLoading;
  if (loading) return <PageSkeleton page="delivery" />;

  const renderOrderCard = (o: AnyOrder) => (
    <ShineCard key={o._id} className="bg-th-surface rounded-2xl p-4 shadow-lg border border-th-border hover:border-[#509bf5]/40 transition-all">
      {/* Customer */}
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-full bg-th-elevated flex items-center justify-center text-th-secondary font-bold text-base flex-shrink-0">
          {custName(o).charAt(0)?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[17px] font-bold text-th-text truncate">{custName(o)}</p>
            <span className={`text-[12px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${STATUS_BADGE[o.status] || "bg-th-elevated text-th-secondary"}`}>
              {uiT(o.status, o.status === "Ready" ? "तैयार" : o.status === "In Lab" ? "लेब में" : o.status === "Ordered" ? "ऑर्डर हुआ" : "ड्राफ्ट")}
            </span>
          </div>
          {custMobile(o) && <p className="text-[14px] text-th-secondary mt-0.5">{custMobile(o)}</p>}
        </div>
      </div>

      {/* Items */}
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {o.frameBrand && (
          <span className="text-[13px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md font-medium">
            {o.frameBrand}{o.frameModel ? ` ${o.frameModel}` : ""}
          </span>
        )}
        {o.lensBrand && (
          <span className="text-[13px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md font-medium">{o.lensBrand}</span>
        )}
        {Array.isArray(o.accessories) && o.accessories.map((a: string, i: number) => (
          <span key={i} className="text-[13px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md font-medium">{a}</span>
        ))}
      </div>

      {/* Date + amount */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-th-card">
        <div>
          {o.deliveryDate ? (
            <span className={`inline-flex items-center gap-1 text-[13px] font-bold px-2 py-1 rounded-lg ${isOverdue(o) ? "text-[#e74c3c] bg-[#e74c3c]/10" : "text-th-secondary bg-th-elevated"}`}>
              <Clock size={11} />
              {dueLabel(o)} · {formatDate(o.deliveryDate)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[13px] text-th-muted px-1">
              <Clock size={11} /> {uiT("No date set", "कोई तारीख नहीं")}
            </span>
          )}
        </div>
        <div className="text-right">
          {o.billInfo?.totalAmount > 0 && (
            <p className="text-[15px] font-bold text-th-text">₹{o.billInfo.totalAmount.toLocaleString()}</p>
          )}
          {pendingAmount(o) > 0 && (
            <p className="text-[13px] font-bold text-[#e74c3c]">{uiT("Pending", "बाकी")} ₹{pendingAmount(o).toLocaleString()}</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3">
        {o.status === "Ready" && (
          <button onClick={() => openDeliver(o)}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[14px] font-bold bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-all active:scale-95 uppercase tracking-wider">
            <CheckCircle size={13} />
            {pendingAmount(o) > 0
              ? `${uiT("Deliver & Collect", "डिलीवर और एकत्र")} ₹${pendingAmount(o).toLocaleString()}`
              : uiT("Deliver", "डिलीवर")}
          </button>
        )}
        {o.status !== "Ready" && (
          <div className="flex-1" />
        )}
        {isOverdue(o) && (
          <span className="text-[12px] font-bold text-[#e74c3c] bg-[#e74c3c]/10 px-2 py-1 rounded-lg flex-shrink-0">
            {overdueDays(o)}d {uiT("overdue", "पार")}
          </span>
        )}
        <button onClick={() => navigate(`/customers/${custId(o)}?visitId=${o.visitId || ""}`)}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[14px] font-bold bg-th-elevated text-th-secondary hover:text-[#1ed760] hover:bg-[#1ed760]/10 transition-all active:scale-95">
          <ArrowUpRight size={13} /> {uiT("View", "देखें")}
        </button>
      </div>
    </ShineCard>
  );

  return (
    <div className="bg-th-base min-h-screen">
      <div className="max-w-[1800px] mx-auto px-3 sm:px-6 lg:px-8 py-5 md:py-7 space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-th-text">{uiT("Delivery", "डिलीवरी")}</h1>
          <p className="text-sm text-th-secondary mt-1">
            {uiT("Ready orders to deliver, every undelivered order, and delivered history by date.", "डिलीवर करने के लिए तैयार ऑर्डर, सभी अभी तक डिलीवर न हुए ऑर्डर, और तारीख के अनुसार डिलीवर हुए ऑर्डर।")}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-th-surface rounded-xl p-1 shadow-lg">
          <button onClick={() => setView("ready")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[15px] sm:text-[17px] font-bold transition-all ${
              view === "ready" ? "bg-[#509bf5]/10 text-[#82b6ff]" : "text-th-secondary hover:text-th-text"
            }`}>
            <Truck size={16} />
            {uiT("Ready", "तैयार")} ({todayReady.length})
          </button>
          <button onClick={() => setView("all")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[15px] sm:text-[17px] font-bold transition-all ${
              view === "all" ? "bg-[#e854c7]/10 text-[#e854c7]" : "text-th-secondary hover:text-th-text"
            }`}>
            <Package size={16} />
            {uiT("All Non-Delivered", "सभी डिलीवर नहीं हुए")} ({allOrders.length})
          </button>
          <button onClick={() => setView("delivered")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[15px] sm:text-[17px] font-bold transition-all ${
              view === "delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" : "text-th-secondary hover:text-th-text"
            }`}>
            <CheckCircle size={16} />
            {uiT("Delivered", "डिलीवर")}
          </button>
        </div>

        {view === "ready" && (
          <>
            {/* Search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <h2 className="text-[18px] font-bold text-th-text">{uiT("Ready to Deliver", "डिलीवर के लिए तैयार")}</h2>
                <p className="text-[13px] text-th-secondary">{uiT("Ready orders with today's delivery date.", "आज की डिलीवरी तारीख वाले तैयार ऑर्डर।")}</p>
              </div>
              <div className="relative w-full sm:w-80">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-muted pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={uiT("Search customer name or mobile…", "ग्राहक का नाम या मोबाइल खोजें…")}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-th-surface border border-th-border text-[15px] text-th-text placeholder:text-th-muted focus:outline-none focus:border-[#509bf5] transition-colors"
                />
              </div>
            </div>

            {filteredReady.length === 0 ? (
              <div className="bg-th-surface rounded-xl text-center py-16 shadow-lg">
                <Truck size={40} className="mx-auto text-th-muted mb-3" />
                <p className="text-th-secondary text-sm">
                  {readyOrders.length === 0
                    ? uiT("No orders ready for delivery right now.", "अभी डिलीवरी के लिए कोई ऑर्डर तैयार नहीं है।")
                    : todayReady.length === 0
                    ? uiT("No orders are scheduled for delivery today.", "आज डिलीवरी के लिए कोई ऑर्डर निर्धारित नहीं है।")
                    : uiT("No orders found for the selected search.", "चयनित खोज के लिए कोई ऑर्डर नहीं मिला।")}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                {filteredReady.map(renderOrderCard)}
              </div>
            )}
          </>
        )}

        {view === "all" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {(["Ready", "In Lab", "Ordered"] as const).map((st) => {
                const meta = STAT_STYLE[st];
                const count = statusCount(st);
                return (
                  <ShineCard key={st} className="bg-th-surface rounded-xl p-4 shadow-lg text-center">
                    <div className={`w-10 h-10 ${meta.bg} rounded-full flex items-center justify-center mx-auto mb-2`}>
                      <meta.icon size={20} className={meta.color} />
                    </div>
                    <p className={`text-2xl font-bold ${meta.color}`}>{count}</p>
                    <p className="text-[15px] text-th-secondary mt-0.5 uppercase tracking-wider font-medium">{uiT(st, st === "Ready" ? "तैयार" : st === "In Lab" ? "लेब में" : "ऑर्डर हुआ")}</p>
                  </ShineCard>
                );
              })}
              <ShineCard className="bg-th-surface rounded-xl p-4 shadow-lg text-center">
                <div className="w-10 h-10 bg-[#e74c3c]/10 rounded-full flex items-center justify-center mx-auto mb-2">
                  <AlertTriangle size={20} className="text-[#e74c3c]" />
                </div>
                <p className="text-2xl font-bold text-[#e74c3c]">{stats.overdue}</p>
                <p className="text-[15px] text-th-secondary mt-0.5 uppercase tracking-wider font-medium">{uiT("Overdue", "समय पार")}</p>
              </ShineCard>
            </div>

            {/* Status filter pills + search */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {["all", ...NON_DELIVERED_STATUSES].map((st) => (
                  <button key={st} onClick={() => setStatusFilter(st)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-[14px] font-bold transition-all active:scale-95 ${
                      statusFilter === st
                        ? "bg-th-text text-th-base"
                        : "bg-th-surface text-th-secondary hover:text-th-text border border-th-border"
                    }`}>
                    <span className={`w-2 h-2 rounded-full ${statusFilter === st ? "bg-th-base" : STATUS_DOT[st] || "bg-[#b3b3b3]"}`} />
                    {st === "all" ? uiT("All", "सभी") : uiT(st, st === "Ready" ? "तैयार" : st === "In Lab" ? "लेब में" : st === "Ordered" ? "ऑर्डर हुआ" : "ड्राफ्ट")}
                    <span className="opacity-60">({st === "all" ? allOrders.length : statusCount(st)})</span>
                  </button>
                ))}
              </div>
              <div className="relative w-full lg:w-80 lg:ml-auto">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-muted pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={uiT("Search customer name or mobile…", "ग्राहक का नाम या मोबाइल खोजें…")}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-th-surface border border-th-border text-[15px] text-th-text placeholder:text-th-muted focus:outline-none focus:border-[#509bf5] transition-colors"
                />
              </div>
            </div>

            {/* Grouped orders */}
            {filteredAll.length === 0 ? (
              <div className="bg-th-surface rounded-xl text-center py-16 shadow-lg">
                <Package size={40} className="mx-auto text-th-muted mb-3" />
                <p className="text-th-secondary text-sm">
                  {allOrders.length === 0
                    ? uiT("No undelivered orders. All orders have been delivered.", "कोई गैर-डिलीवर ऑर्डर नहीं। सभी ऑर्डर डिलीवर हो गए हैं।")
                    : uiT("No orders found for the selected filters.", "चयनित फ़िल्टर के लिए कोई ऑर्डर नहीं मिला।")}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {groups.map(({ status, orders: list }) => (
                  <div key={status}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status] || "bg-[#b3b3b3]"}`} />
                      <h2 className="text-[17px] font-bold text-th-text">
                        {uiT(status, status === "Ready" ? "तैयार" : status === "In Lab" ? "लेब में" : status === "Ordered" ? "ऑर्डर हुआ" : "ड्राफ्ट")}
                      </h2>
                      <span className="text-[14px] font-bold text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md">{list.length}</span>
                      {status === "Ready" && (
                        <span className="text-[13px] text-[#509bf5] bg-[#509bf5]/10 px-2 py-0.5 rounded-md font-medium">
                          {uiT("Ready to deliver", "डिलीवर के लिए तैयार")}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                      {list.map(renderOrderCard)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {view === "delivered" && (
          <>
            {/* Date filter */}
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
              count={deliveredOrders.length}
              label="order"
            />

            {deliveredOrders.length === 0 ? (
              <div className="bg-th-surface rounded-xl text-center py-16 shadow-lg">
                <CheckCircle size={40} className="mx-auto text-th-muted mb-3" />
                <p className="text-th-secondary text-sm">
                  {uiT("No orders were delivered on this date.", "इस तारीख पर कोई ऑर्डर डिलीवर नहीं हुआ।")}
                </p>
              </div>
            ) : (
              <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg divide-y divide-th-border">
                {deliveredOrders.map((o) => (
                  <ShineCard key={o._id} className="px-4 sm:px-5 py-4 hover:bg-th-card transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-th-elevated flex items-center justify-center text-th-secondary font-bold text-sm flex-shrink-0">
                        {custName(o).charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[17px] font-bold text-th-text truncate">{custName(o)}</p>
                          {custMobile(o) && <span className="text-[14px] text-th-muted hidden sm:inline">{custMobile(o)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {o.frameBrand && (
                            <span className="text-[13px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md font-medium">
                              {o.frameBrand}{o.frameModel ? ` ${o.frameModel}` : ""}
                            </span>
                          )}
                          {o.lensBrand && (
                            <span className="text-[13px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md font-medium">{o.lensBrand}</span>
                          )}
                          {o.billInfo?.totalAmount > 0 && (
                            <span className="text-[14px] font-bold text-th-text">₹{o.billInfo.totalAmount.toLocaleString()}</span>
                          )}
                          {pendingAmount(o) > 0 && (
                            <span className="text-[13px] font-bold text-[#e74c3c] bg-[#e74c3c]/10 px-1.5 py-0.5 rounded">
                              ₹{pendingAmount(o).toLocaleString()} {uiT("due", "बाकी")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {o.actualDeliveryDate && (
                          <span className="text-[14px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-2 py-1 rounded-lg">
                            {formatDate(o.actualDeliveryDate)}
                          </span>
                        )}
                        {pendingAmount(o) > 0 && (
                          <button onClick={() => navigate(`/pickup?orderId=${o._id}&collect=true`)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[14px] font-bold bg-[#e74c3c]/10 text-[#e74c3c] hover:bg-[#e74c3c]/20 transition-all active:scale-95 uppercase tracking-wider">
                            <Wallet size={13} /> {uiT("Collect", "एकत्र")} ₹{pendingAmount(o).toLocaleString()}
                          </button>
                        )}
                        <button onClick={() => navigate(`/customers/${custId(o)}?visitId=${o.visitId || ""}`)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[14px] font-bold bg-th-elevated text-th-secondary hover:text-[#1ed760] hover:bg-[#1ed760]/10 transition-all active:scale-95">
                          <ArrowUpRight size={13} /> {uiT("View", "देखें")}
                        </button>
                      </div>
                    </div>
                  </ShineCard>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Confirm delivery modal */}
      {confirmOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !delivering && setConfirmOrder(null)}>
          <div className="bg-th-surface rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#1ed760]/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={24} className="text-[#1ed760]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-th-text">{uiT("Confirm Delivery", "डिलीवरी की पुष्टि करें")}</h3>
                <p className="text-[14px] text-th-secondary">{uiT("Mark this order as delivered?", "इस ऑर्डर को डिलीवर के रूप में चिह्नित करें?")}</p>
              </div>
            </div>

            <div className="mt-4 bg-th-elevated rounded-xl p-4 space-y-1.5">
              <p className="text-[16px] font-bold text-th-text">{custName(confirmOrder)}</p>
              {custMobile(confirmOrder) && <p className="text-[14px] text-th-secondary">{custMobile(confirmOrder)}</p>}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {confirmOrder.frameBrand && (
                  <span className="text-[13px] text-th-secondary bg-th-surface px-2 py-0.5 rounded-md font-medium">
                    {confirmOrder.frameBrand}{confirmOrder.frameModel ? ` ${confirmOrder.frameModel}` : ""}
                  </span>
                )}
                {confirmOrder.lensBrand && (
                  <span className="text-[13px] text-th-secondary bg-th-surface px-2 py-0.5 rounded-md font-medium">{confirmOrder.lensBrand}</span>
                )}
              </div>
              {confirmOrder.billInfo?.totalAmount > 0 && (
                <p className="text-[15px] font-bold text-th-text pt-1">
                  {uiT("Total", "कुल")}: ₹{confirmOrder.billInfo.totalAmount.toLocaleString()}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button onClick={() => !delivering && setConfirmOrder(null)} disabled={delivering}
                className="flex-1 px-4 py-2.5 rounded-xl text-[15px] font-bold bg-th-elevated text-th-secondary hover:text-th-text transition-all active:scale-95">
                {uiT("Cancel", "रद्द करें")}
              </button>
              <button onClick={() => doDeliver(confirmOrder)} disabled={delivering}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[15px] font-bold bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-all active:scale-95 uppercase tracking-wider">
                {delivering ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                {uiT("Deliver", "डिलीवर")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

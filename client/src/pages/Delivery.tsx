import React, { useState, useCallback } from "react";
import api from "../api";
import { useCachedData } from "../hooks/useCachedData";
import { invalidateCache } from "../hooks/useCache";
import PageSkeleton from "../components/PageSkeleton";
import { Eye, Clock, Package, Truck, Wallet, CheckCircle, ArrowUpRight, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DateRangePicker from "../components/DateRangePicker";
import { todayStr } from "../utils/date";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";

type Tab = "ready" | "delivered";

export default function Delivery() {
  const { uiT } = useTranslate();
  const navigate = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("ready");
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const dateParams = new URLSearchParams({ startDate, endDate });
  const cacheKey = `/api/orders?${dateParams.toString()}`;
  const { data: orders, loading, refetch } = useCachedData<any[]>(cacheKey,
    async () => {
      const res = await api.get("/api/orders?" + dateParams.toString());
      if (res.success && res.data && typeof res.data === "object" && "data" in res.data) {
        return { success: true, data: (res.data as any).data };
      }
      return { success: res.success, data: Array.isArray(res.data) ? res.data : [] };
    },
    [startDate, endDate]
  );

  const allOrders = orders || [];
  const readyOrders = allOrders.filter((o: any) => o.status === "Ready");
  const deliveredOrders = allOrders.filter((o: any) => o.status === "Delivered");
  const activeList = tab === "ready" ? readyOrders : deliveredOrders;

  const markDelivered = useCallback(async (orderId: string) => {
    setActionLoading(orderId);
    const res = await api.patch(`/api/orders/${orderId}/status`, { status: "Delivered" });
    setActionLoading(null);
    if (res.success) {
      toast.success(uiT("Order delivered!", "ऑर्डर डिलीवर हो गया!"));
      invalidateCache(cacheKey);
      refetch();
    } else {
      toast.error(res.message || "Failed");
    }
  }, [cacheKey, refetch, toast, uiT]);

  function custName(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.name) return o.customerId.name;
    return "—";
  }

  function custMobile(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.mobile) return o.customerId.mobile;
    return "";
  }

  function custId(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?._id) return o.customerId._id;
    return o.customerId || "";
  }

  function daysUntil(dateStr: string): string {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    d.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return `${Math.abs(diff)}d ${uiT("ago", "पहले")}`;
    if (diff === 0) return uiT("Today", "आज");
    if (diff === 1) return uiT("Tomorrow", "कल");
    return `${diff}d`;
  }

  const totalRevenue = deliveredOrders.reduce((s, o) => s + (o.billInfo?.totalAmount || 0), 0);
  const pendingPayments = readyOrders.filter((o) => (o.billInfo?.pendingAmount || 0) > 0).length +
    deliveredOrders.filter((o) => (o.billInfo?.pendingAmount || 0) > 0).length;

  if (loading) return <PageSkeleton page="delivery" />;

  return (
    <div className="bg-th-base min-h-screen">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-th-text">{uiT("Delivery", "डिलीवरी")}</h1>
          <p className="text-sm text-th-secondary mt-1">{uiT("Ready for pickup and delivered orders.", "पिकअप के लिए तैयार और डिलीवर किए गए ऑर्डर।")}</p>
        </div>

        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} count={activeList.length} label="delivery" />

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-th-surface rounded-xl p-4 shadow-lg text-center">
            <div className="w-10 h-10 bg-[#f59e0b]/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Truck size={20} className="text-[#f59e0b]" />
            </div>
            <p className="text-2xl font-bold text-[#f59e0b]">{readyOrders.length}</p>
            <p className="text-[11px] text-th-secondary mt-0.5 uppercase tracking-wider font-medium">{uiT("Ready", "तैयार")}</p>
          </div>
          <div className="bg-th-surface rounded-xl p-4 shadow-lg text-center">
            <div className="w-10 h-10 bg-[#1ed760]/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <CheckCircle size={20} className="text-[#1ed760]" />
            </div>
            <p className="text-2xl font-bold text-[#1ed760]">{deliveredOrders.length}</p>
            <p className="text-[11px] text-th-secondary mt-0.5 uppercase tracking-wider font-medium">{uiT("Delivered", "डिलीवर")}</p>
          </div>
          <div className="bg-th-surface rounded-xl p-4 shadow-lg text-center">
            <div className="w-10 h-10 bg-[#1ed760]/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Wallet size={20} className="text-[#1ed760]" />
            </div>
            <p className="text-2xl font-bold text-[#1ed760]">₹{totalRevenue.toLocaleString()}</p>
            <p className="text-[11px] text-th-secondary mt-0.5 uppercase tracking-wider font-medium">{uiT("Revenue", "राजस्व")}</p>
          </div>
          <div className="bg-th-surface rounded-xl p-4 shadow-lg text-center">
            <div className="w-10 h-10 bg-[#e74c3c]/10 rounded-full flex items-center justify-center mx-auto mb-2">
              <Wallet size={20} className="text-[#e74c3c]" />
            </div>
            <p className="text-2xl font-bold text-[#e74c3c]">{pendingPayments}</p>
            <p className="text-[11px] text-th-secondary mt-0.5 uppercase tracking-wider font-medium">{uiT("Pending", "बाकी")}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-th-surface rounded-xl p-1 shadow-lg">
          <button onClick={() => setTab("ready")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold transition-all ${
              tab === "ready" ? "bg-[#f59e0b]/10 text-[#f59e0b]" : "text-th-secondary hover:text-th-text"
            }`}>
            <Truck size={16} />
            {uiT("Ready for Pickup", "पिकअप के लिए तैयार")} ({readyOrders.length})
          </button>
          <button onClick={() => setTab("delivered")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-bold transition-all ${
              tab === "delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" : "text-th-secondary hover:text-th-text"
            }`}>
            <CheckCircle size={16} />
            {uiT("Delivered", "डिलीवर")} ({deliveredOrders.length})
          </button>
        </div>

        {/* Order List */}
        {activeList.length === 0 ? (
          <div className="bg-th-surface rounded-xl text-center py-16 shadow-lg">
            <Truck size={40} className="mx-auto text-th-muted mb-3" />
            <p className="text-th-secondary text-sm">
              {tab === "ready"
                ? uiT("No orders ready for pickup", "पिकअप के लिए कोई ऑर्डर तैयार नहीं")
                : uiT("No delivered orders in this period", "इस अवधि में कोई डिलीवर ऑर्डर नहीं")}
            </p>
          </div>
        ) : (
          <div className="bg-th-surface rounded-xl overflow-hidden shadow-lg divide-y divide-th-border">
            {activeList.map((o: any) => {
              const isOverdue = tab === "ready" && o.deliveryDate && new Date(o.deliveryDate) < new Date();
              return (
                <div key={o._id} className="px-5 py-4 hover:bg-th-card transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-th-elevated flex items-center justify-center text-th-secondary font-bold text-sm flex-shrink-0">
                      {custName(o).charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[14px] font-bold text-th-text truncate">{custName(o)}</p>
                        {custMobile(o) && <span className="text-[12px] text-th-muted hidden sm:inline">{custMobile(o)}</span>}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {o.frameBrand && (
                          <span className="text-[11px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md font-medium">
                            {o.frameBrand}{o.frameModel ? ` ${o.frameModel}` : ""}
                          </span>
                        )}
                        {o.lensBrand && (
                          <span className="text-[11px] text-th-secondary bg-th-elevated px-2 py-0.5 rounded-md font-medium">
                            {o.lensBrand}
                          </span>
                        )}
                        {o.billInfo?.totalAmount > 0 && (
                          <span className="text-[11px] font-bold text-th-text">₹{o.billInfo.totalAmount.toLocaleString()}</span>
                        )}
                        {o.billInfo?.pendingAmount > 0 && (
                          <span className="text-[10px] font-bold text-[#e74c3c] bg-[#e74c3c]/10 px-1.5 py-0.5 rounded">₹{o.billInfo.pendingAmount.toLocaleString()} {uiT("due", "बाकी")}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {tab === "ready" && (
                        <>
                          {o.deliveryDate && (
                            <span className={`text-[11px] font-bold px-2 py-1 rounded-lg ${isOverdue ? "text-[#e74c3c] bg-[#e74c3c]/10" : "text-th-secondary bg-th-elevated"}`}>
                              <Clock size={11} className="inline mr-1" />
                              {daysUntil(o.deliveryDate)}
                            </span>
                          )}
                          <button onClick={() => navigate(`/pickup?orderId=${o._id}`)}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-all active:scale-95 uppercase tracking-wider">
                            <CheckCircle size={13} /> {uiT("Deliver", "डिलीवर")}
                          </button>
                        </>
                      )}
                      {tab === "delivered" && o.actualDeliveryDate && (
                        <span className="text-[11px] font-bold text-[#1ed760] bg-[#1ed760]/10 px-2 py-1 rounded-lg">
                          {new Date(o.actualDeliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {tab === "delivered" && (o.billInfo?.pendingAmount || 0) > 0 && (
                        <button onClick={() => navigate(`/pickup?orderId=${o._id}&collect=true`)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold bg-[#e74c3c]/10 text-[#e74c3c] hover:bg-[#e74c3c]/20 transition-all active:scale-95 uppercase tracking-wider">
                          {uiT("Collect", "एकत्र")} ₹{o.billInfo.pendingAmount.toLocaleString()}
                        </button>
                      )}
                      <button onClick={() => navigate(`/customers/${custId(o)}?visitId=${o.visitId || ""}`)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-bold bg-th-elevated text-th-secondary hover:text-[#1ed760] hover:bg-[#1ed760]/10 transition-all active:scale-95">
                        <ArrowUpRight size={13} /> {uiT("View", "देखें")}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState } from "react";
import api from "../api";
import { useCachedData } from "../hooks/useCachedData";
import PageSkeleton from "../components/PageSkeleton";
import { Eye, Clock, Package, Truck, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import DateRangePicker from "../components/DateRangePicker";

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

export default function Delivery() {
  const navigate = useNavigate();
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const params = new URLSearchParams({ startDate, endDate });
  const cacheKey = `/api/orders?${params.toString()}`;
  const { data: orders, loading } = useCachedData<any[]>(cacheKey,
    () => api.get("/api/orders?" + params.toString()),
    [startDate, endDate]
  );
  const list = (orders || []).filter((o: any) => o.status === "Delivered");

  function customerName(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.name) return o.customerId.name;
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

  const totalRevenue = list.reduce((s, o) => s + (o.billInfo?.totalAmount || 0), 0);

  if (loading) return <PageSkeleton page="delivery" />;

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Delivery History</h1>
        <p className="page-subtitle">All delivered orders.</p>
      </div>

      <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} count={list.length} label="delivery" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card text-center py-6">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Package size={24} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-bold text-emerald-600">{list.length}</p>
          <p className="text-sm font-medium text-gray-500 mt-1">Total Delivered</p>
        </div>
        <div className="card text-center py-6">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Wallet size={24} className="text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-primary-600">₹{totalRevenue.toLocaleString()}</p>
          <p className="text-sm font-medium text-gray-500 mt-1">Total Revenue</p>
        </div>
        <div className="card text-center py-6">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Truck size={24} className="text-amber-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{list.reduce((s, o) => s + (o.billInfo?.pendingAmount > 0 ? 1 : 0), 0)}</p>
          <p className="text-sm font-medium text-gray-500 mt-1">Pending Payments</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-16">
          <Truck size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No delivered orders in this period</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((o: any) => (
            <div key={o._id} className="card">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-800/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm flex-shrink-0">
                      {customerName(o).charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{customerName(o)}</p>
                      {customerMobile(o) && <p className="text-xs text-gray-400">{customerMobile(o)}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {o.frameBrand ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 px-2 py-0.5 rounded-md text-indigo-700 dark:text-indigo-300 font-medium">
                        <Package size={11} className="text-indigo-500 flex-shrink-0" /> {o.frameBrand}{o.frameModel ? ` ${o.frameModel}` : ""}
                      </span>
                    ) : o.frame ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 px-2 py-0.5 rounded-md text-indigo-700 dark:text-indigo-300 font-medium">
                        <Package size={11} className="text-indigo-500 flex-shrink-0" /> {o.frame}
                      </span>
                    ) : null}
                    {o.lensBrand && (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 px-2 py-0.5 rounded-md text-sky-700 dark:text-sky-300 font-medium">
                        <Eye size={11} className="text-sky-500 flex-shrink-0" /> {o.lensBrand}{o.lens ? ` · ${o.lens}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {o.deliveryDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {o.billInfo?.totalAmount > 0 && (
                      <span className="font-medium text-gray-700 dark:text-gray-300">₹{o.billInfo.totalAmount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => navigate(`/customers/${customerId(o)}?visitId=${o.visitId || ""}`)}
                  className="btn-primary gap-2 px-5 py-2.5 flex-shrink-0 text-sm">
                  <Eye size={16} /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

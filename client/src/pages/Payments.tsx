import React, { useState } from "react";
import api from "../api";
import { useCachedData } from "../hooks/useCachedData";
import Table from "../components/Table";
import PageSkeleton from "../components/PageSkeleton";
import DateRangePicker from "../components/DateRangePicker";
import { IndianRupee, Receipt, TrendingUp } from "lucide-react";
import { todayStr } from "../utils/date";

export default function Payments() {
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState(todayStr());
  const params = new URLSearchParams({ startDate, endDate });
  const cacheKey = `/api/payments?${params.toString()}`;
  const { data: rawList, loading } = useCachedData<any[]>(cacheKey,
    () => api.get("/api/payments?" + params.toString()),
    [startDate, endDate]
  );
  const list = rawList || [];

  function customerName(p: any): string {
    if (typeof p.customerId === "object" && p.customerId?.name) return p.customerId.name;
    return p.customerId?.slice?.(-6) || "—";
  }

  function customerMobile(p: any): string {
    if (typeof p.customerId === "object" && p.customerId?.mobile) return p.customerId.mobile;
    return "";
  }

  const totalAmount = list.reduce((s, p) => s + (p.amount || 0), 0);
  const modeBreakdown = list.reduce<Record<string, number>>((acc, p) => {
    const mode = p.paymentMode || "Cash";
    acc[mode] = (acc[mode] || 0) + (p.amount || 0);
    return acc;
  }, {});

  if (loading) return <PageSkeleton page="payments" />;

  return (
    <div className="page-container max-w-full overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="page-subtitle">View all payments recorded from visits, orders, and deliveries.</p>
        </div>
      </div>

      <div className="mb-4">
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s, e) => { setStartDate(s); setEndDate(e); }} count={list.length} label="payment" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
            <IndianRupee size={20} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Total Collected</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">₹{totalAmount.toLocaleString("en-IN")}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
            <Receipt size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Transactions</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{list.length}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">Mode Breakdown</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {Object.entries(modeBreakdown).map(([mode, amt]) => (
                <span key={mode} className="mr-3">{mode}: ₹{amt.toLocaleString("en-IN")}</span>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table
          columns={[
            { key: "customerId", label: "Customer", render: (v: any, row: any) => (
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{customerName(row)}</p>
                {customerMobile(row) && <p className="text-[11px] text-gray-400 truncate">{customerMobile(row)}</p>}
              </div>
            )},
            { key: "amount", label: "Amount", render: (v) => <span className="font-semibold text-emerald-600">₹{(v || 0).toLocaleString("en-IN")}</span> },
            { key: "paymentMode", label: "Mode", render: (v) => (
              <span className={`badge ${
                v === "Cash" ? "badge-green" :
                v === "UPI" ? "badge-blue" :
                v === "Card" ? "badge-purple" : "badge-yellow"
              }`}>{v || "Cash"}</span>
            )},
            { key: "paymentDate", label: "Date", render: (v) => v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" },
            { key: "notes", label: "Notes", render: (v) => <span className="text-gray-500">{v || "—"}</span> },
          ]}
          data={list}
          searchPlaceholder="Search payments..."
        />
      </div>
    </div>
  );
}

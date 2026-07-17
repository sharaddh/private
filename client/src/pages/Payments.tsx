import React, { useState } from "react";
import { paymentService } from "../services";
import { useCachedData } from "../hooks/useCachedData";
import Table from "../components/Table";
import PageSkeleton from "../components/PageSkeleton";
import DateRangePicker from "../components/DateRangePicker";
import { IndianRupee, Receipt, TrendingUp } from "lucide-react";
import { todayStr } from "../utils/date";
import { useTranslate } from "../context/TranslateContext";
import type { Payment, PaymentMode, PaginatedResponse } from "../types";

export default function Payments() {
  const { uiT } = useTranslate();
  const [startDate, setStartDate] = useState<string>(todayStr());
  const [endDate, setEndDate] = useState<string>(todayStr());
  const params = new URLSearchParams({ startDate, endDate });
  const cacheKey = `/api/payments?${params.toString()}`;
  const { data: rawList, loading } = useCachedData<PaginatedResponse<Payment>>(
    cacheKey,
    () => paymentService.listFiltered({ startDate, endDate }),
    [startDate, endDate]
  );
  const list: Payment[] = rawList?.data ?? [];

  function customerName(p: Payment): string {
    if (typeof p.customerId === "object" && p.customerId?.name) return p.customerId.name;
    return (typeof p.customerId === "string" ? p.customerId : "")?.slice(-6) || "—";
  }

  function customerMobile(p: Payment): string {
    if (typeof p.customerId === "object" && p.customerId?.mobile) return p.customerId.mobile;
    return "";
  }

  const totalAmount: number = list.reduce((s, p) => s + (p.amount || 0), 0);
  const modeBreakdown: Record<string, number> = list.reduce<Record<string, number>>((acc, p) => {
    const mode: string = p.paymentMode || "Cash";
    acc[mode] = (acc[mode] || 0) + (p.amount || 0);
    return acc;
  }, {});

  if (loading) return <PageSkeleton page="payments" />;

  return (
    <div className="page-container max-w-full overflow-hidden">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
        <div>
          <h1 className="page-title">{uiT("Payments", "भुगतान")}</h1>
          <p className="page-subtitle">View all payments recorded from visits, orders, and deliveries.</p>
        </div>
      </div>

      <div className="mb-4">
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={(s: string, e: string) => { setStartDate(s); setEndDate(e); }} count={list.length} label="payment" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-th-surface rounded-lg p-4 flex items-center gap-4 shadow-lg">
          <div className="w-10 h-10 rounded-sm bg-[#1ed760]/10 flex items-center justify-center flex-shrink-0">
            <IndianRupee size={20} className="text-[#1ed760]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-th-secondary uppercase tracking-wide">{uiT("Total", "कुल")} {uiT("Collected", "एकत्रित")}</p>
            <p className="text-xl font-bold text-th-text">₹{totalAmount.toLocaleString("en-IN")}</p>
          </div>
        </div>
        <div className="bg-th-surface rounded-lg p-4 flex items-center gap-4 shadow-lg">
          <div className="w-10 h-10 rounded-sm bg-[#509bf5]/10 flex items-center justify-center flex-shrink-0">
            <Receipt size={20} className="text-[#509bf5]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-th-secondary uppercase tracking-wide">Transactions</p>
            <p className="text-xl font-bold text-th-text">{list.length}</p>
          </div>
        </div>
        <div className="bg-th-surface rounded-lg p-4 flex items-center gap-4 shadow-lg">
          <div className="w-10 h-10 rounded-sm bg-[#af2896]/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp size={20} className="text-[#af2896]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-th-secondary uppercase tracking-wide">Mode Breakdown</p>
            <p className="text-sm font-semibold text-th-text truncate">
              {Object.entries(modeBreakdown).map(([mode, amt]: [string, number]) => (
                <span key={mode} className="mr-3">{mode}: ₹{amt.toLocaleString("en-IN")}</span>
              ))}
            </p>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table
          columns={[
            { key: "customerId", label: uiT("Customer", "ग्राहक"), render: (_v: unknown, row: Payment) => (
              <div className="min-w-0">
                <p className="font-medium text-th-text truncate">{customerName(row)}</p>
                {customerMobile(row) && <p className="text-[11px] text-th-secondary truncate">{customerMobile(row)}</p>}
              </div>
            )},
            { key: "amount", label: uiT("Amount", "राशि"), render: (v: number) => <span className="font-semibold text-[#1ed760]">₹{(v || 0).toLocaleString("en-IN")}</span> },
            { key: "paymentMode", label: uiT("Mode", "माध्यम"), render: (v: PaymentMode) => (
              <span className={`badge ${
                v === "Cash" ? "badge-green" :
                v === "UPI" ? "badge-blue" :
                v === "Card" ? "badge-purple" : "badge-yellow"
              }`}>{v || "Cash"}</span>
            )},
            { key: "paymentDate", label: uiT("Date", "तारीख"), render: (v: string) => v ? new Date(v).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—" },
            { key: "notes", label: uiT("Notes", "नोट्स"), render: (v: string) => <span className="text-th-secondary">{v || "—"}</span> },
          ]}
          data={list}
          searchPlaceholder={uiT("Search", "खोजें") + " payments..."}
        />
      </div>
    </div>
  );
}

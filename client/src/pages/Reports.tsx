import React, { useEffect, useState, useCallback, useMemo } from "react";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import {
  Users, TrendingUp, Clock, Package, AlertTriangle,
  Download, ShoppingCart, Calendar,
} from "lucide-react";
import { useTranslate } from "../context/TranslateContext";

const TABS = [
  { key: "customers", label: "Customers", icon: Users },
  { key: "sales", label: "Sales", icon: TrendingUp },
  { key: "pending", label: "Pending", icon: Clock },
  { key: "inventory", label: "Inventory", icon: Package },
];

const DATE_PRESETS = [
  { label: "Today", days: 0 },
  { label: "This Week", days: 7 },
  { label: "This Month", days: 30 },
  { label: "This Quarter", days: 90 },
  { label: "This Year", days: 365 },
  { label: "All", days: -1 },
];

function getDateRange(presetDays: number): { start: string; end: string } {
  if (presetDays < 0) return { start: "", end: "" };
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - presetDays);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default function Reports() {
  const { uiT } = useTranslate();
  const tabLabels: Record<string, string> = { Customers: "ग्राहक", Sales: "बिक्री", Pending: "बाकी", Inventory: "इन्वेंट्री" };
  const presetLabels: Record<string, string> = { Today: "आज", "This Week": "इस सप्ताह", "This Month": "इस महीने", "This Quarter": "इस तिमाही", "This Year": "इस वर्ष", All: "सभी" };
  const [activeTab, setActiveTab] = useState("sales");
  const [loading, setLoading] = useState(true);
  const [customerData, setCustomerData] = useState<any[]>([]);
  const [salesData, setSalesData] = useState<any>(null);
  const [pendingData, setPendingData] = useState<any[]>([]);
  const [invData, setInvData] = useState<any>(null);
  const [topCustomers, setTopCustomers] = useState<any[]>([]);
  const [datePreset, setDatePreset] = useState(2); // "This Month" default
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const effectiveRange = useMemo(() => {
    if (datePreset < 0) return getDateRange(datePreset);
    return getDateRange(datePreset);
  }, [datePreset]);

  const dateRange = useMemo(() => {
    if (customStart || customEnd) return { start: customStart, end: customEnd };
    return effectiveRange;
  }, [customStart, customEnd, effectiveRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange.start) params.set("start", dateRange.start);
    if (dateRange.end) params.set("end", dateRange.end);
    const qs = params.toString();

    const [rev, inv, cust, bills, custReport] = await Promise.all([
      api.get(`/api/reports/revenue${qs ? `?${qs}` : ""}`),
      api.get("/api/reports/inventory"),
      api.get("/api/customers"),
      api.get(`/api/bills${qs ? `?startDate=${dateRange.start}&endDate=${dateRange.end}` : ""}`),
      api.get("/api/reports/customers"),
    ]);
    if (rev.success) setSalesData(rev.data);
    if (inv.success) setInvData(inv.data);
    if (cust.success) {
      const list = cust.data?.data || (Array.isArray(cust.data) ? cust.data : []);
      setCustomerData(list);
    }
    if (bills.success) {
      const billList = Array.isArray(bills.data) ? bills.data : bills.data?.data || [];
      setPendingData(billList.filter((b: any) => (b.pendingAmount || 0) > 0));
    }
    if (custReport.success) {
      setTopCustomers(custReport.data?.topCustomers || []);
    }
    setLoading(false);
  }, [dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  function handlePresetClick(index: number) {
    setDatePreset(index);
    setCustomStart("");
    setCustomEnd("");
  }

  function exportCSV() {
    if (!customerData?.length) return;
    const headers = [uiT("Name", "नाम"), uiT("Mobile", "मोबाइल"), uiT("Visits", "विज़िट"), uiT("Total Spent", "कुल खर्च"), uiT("Pending Amount", "बाकी राशि")];
    const rows = customerData.map((c: any) => [
      `"${(c.name || "").replace(/"/g, '""')}"`,
      c.mobile || "",
      c.totalVisits || 0,
      c.totalSpent || 0,
      c.pendingAmount || 0,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${activeTab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPendingCSV() {
    if (!pendingData?.length) return;
    const headers = [uiT("Bill", "बिल"), uiT("Customer", "ग्राहक"), uiT("Total", "कुल"), uiT("Pending", "बाकी"), uiT("Days", "दिन")];
    const rows = pendingData.map((b: any) => {
      const name = typeof b.customerId === "object" && b.customerId?.name ? b.customerId.name : "—";
      const days = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      return [`"${b.billNumber || ""}"`, `"${name}"`, b.totalAmount || 0, b.pendingAmount || 0, days];
    });
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-pending-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <PageSkeleton page="reports" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="page-title">{uiT("Reports", "रिपोर्ट")}</h1>
          <p className="page-subtitle">{uiT("Business insights and analytics.", "व्यापार जानकारी और विश्लेषण।")}</p>
        </div>
        <div className="flex gap-2">
          {activeTab === "customers" && customerData?.length > 0 && (
            <button onClick={exportCSV} className="btn-secondary btn-sm flex items-center gap-1.5"><Download size={14} /> {uiT("Export CSV", "CSV निर्यात")}</button>
          )}
          {activeTab === "pending" && pendingData?.length > 0 && (
            <button onClick={exportPendingCSV} className="btn-secondary btn-sm flex items-center gap-1.5"><Download size={14} /> {uiT("Export CSV", "CSV निर्यात")}</button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-th-border">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 ${
                  isActive ? "border-[#1ed760] text-[#1ed760]" : "border-transparent text-th-muted hover:text-th-secondary"
                }`}>
                <Icon size={16} /> {uiT(t.label, tabLabels[t.label] || t.label)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date Filters (Sales + Pending) */}
      {(activeTab === "sales" || activeTab === "pending") && (
        <div className="flex flex-wrap items-center gap-2">
          <Calendar size={14} className="text-th-muted" />
          {DATE_PRESETS.map((p, i) => (
            <button key={p.label} onClick={() => handlePresetClick(i)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                datePreset === i && !customStart
                  ? "bg-[#1ed760]/10 border-[#1ed760]/30 text-[#1ed760]"
                  : "bg-th-elevated border-th-border text-th-secondary hover:border-[#555]"
              }`}
            >{uiT(p.label, presetLabels[p.label] || p.label)}</button>
          ))}
          <span className="text-th-border text-xs px-1">|</span>
          <input type="date" value={customStart}
            onChange={(e) => { setCustomStart(e.target.value); setDatePreset(-1); }}
            className="text-xs bg-th-elevated border border-th-border rounded-lg px-2.5 py-1.5 text-th-secondary focus:outline-none" />
          <span className="text-th-muted text-xs">to</span>
          <input type="date" value={customEnd}
            onChange={(e) => { setCustomEnd(e.target.value); setDatePreset(-1); }}
            className="text-xs bg-th-elevated border border-th-border rounded-lg px-2.5 py-1.5 text-th-secondary focus:outline-none" />
          {(customStart || customEnd) && (
            <button onClick={() => { setCustomStart(""); setCustomEnd(""); setDatePreset(2); }}
              className="text-xs text-th-muted hover:text-[#e74c3c] px-2">Clear</button>
          )}
        </div>
      )}

      {/* ──────────────── CUSTOMERS ──────────────── */}
      {activeTab === "customers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-white">{(customerData?.length || 0).toLocaleString()}</p>
              <p className="text-sm text-th-secondary">{uiT("Total Customers", "कुल ग्राहक")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#1ed760]">
                {(customerData?.filter((c: any) => c.totalVisits === 1).length || 0).toLocaleString()}
              </p>
              <p className="text-sm text-th-secondary">{uiT("New Customers", "नए ग्राहक")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#1ed760]">
                {(customerData?.filter((c: any) => (c.totalVisits || 0) > 1).length || 0).toLocaleString()}
              </p>
              <p className="text-sm text-th-secondary">{uiT("Returning Customers", "वापसी ग्राहक")}</p>
            </div>
          </div>

          {topCustomers.length > 0 && (
            <div className="card">
              <h3 className="section-title mb-4">{uiT("Top Customers by Spend", "खर्च के अनुसार शीर्ष ग्राहक")}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-th-border">
                      <th className="text-left py-2 px-3 text-th-muted font-medium">#</th>
                      <th className="text-left py-2 px-3 text-th-muted font-medium">{uiT("Name", "नाम")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Visits", "विज़िट")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Total Spent", "कुल खर्च")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Pending", "बाकी")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.slice(0, 10).map((c: any, i: number) => (
                      <tr key={c._id} className="border-b border-th-card hover:bg-th-elevated">
                        <td className="py-2 px-3 text-th-muted text-xs">{i + 1}</td>
                        <td className="py-2 px-3 font-medium text-white">{c.name}</td>
                        <td className="py-2 px-3 text-right text-th-secondary">{c.totalVisits || 0}</td>
                        <td className="py-2 px-3 text-right text-[#1ed760] font-medium">₹{(c.totalSpent || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={c.pendingAmount > 0 ? "text-amber-400 font-medium" : "text-th-muted"}>
                            {(c.pendingAmount || 0) > 0 ? `₹${c.pendingAmount.toLocaleString()}` : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="section-title mb-4">{uiT("All Customers", "सभी ग्राहक")} ({customerData?.length || 0})</h3>
            {(!customerData || customerData.length === 0) ? (
              <p className="text-th-muted text-sm text-center py-8">{uiT("No customers yet.", "अभी तक कोई ग्राहक नहीं।")}</p>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-th-surface">
                    <tr className="border-b border-th-border">
                      <th className="text-left py-2 px-3 text-th-muted font-medium">{uiT("Name", "नाम")}</th>
                      <th className="text-left py-2 px-3 text-th-muted font-medium">{uiT("Mobile", "मोबाइल")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Visits", "विज़िट")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Total Spent", "कुल खर्च")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Pending", "बाकी")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerData?.map((c: any) => (
                      <tr key={c._id} className="border-b border-th-card hover:bg-th-elevated">
                        <td className="py-2 px-3 font-medium text-white">{c.name}</td>
                        <td className="py-2 px-3 text-th-secondary">{c.mobile || "—"}</td>
                        <td className="py-2 px-3 text-right text-th-secondary">{(c.totalVisits || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-[#1ed760] font-medium">₹{(c.totalSpent || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={c.pendingAmount > 0 ? "text-amber-400 font-medium" : "text-th-muted"}>
                            {(c.pendingAmount || 0) > 0 ? `₹${c.pendingAmount.toLocaleString()}` : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── SALES ──────────────── */}
      {activeTab === "sales" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-white">₹{(salesData?.totalRevenue || 0).toLocaleString()}</p>
              <p className="text-xs text-th-secondary">{uiT("Total", "कुल")} {uiT("Revenue", "राजस्व")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#1ed760]">₹{(salesData?.totalCollection || 0).toLocaleString()}</p>
              <p className="text-xs text-th-secondary">{uiT("Total Collection", "कुल संग्रह")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-amber-400">₹{((salesData?.totalRevenue || 0) - (salesData?.totalCollection || 0)).toLocaleString()}</p>
              <p className="text-xs text-th-secondary">{uiT("Outstanding", "बकाया")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#1ed760]">
                {salesData?.totalRevenue > 0 ? `${((salesData.totalCollection / salesData.totalRevenue) * 100).toFixed(1)}%` : "—"}
              </p>
              <p className="text-xs text-th-secondary">{uiT("Collection Ratio", "संग्रह अनुपात")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card">
              <p className="text-xs text-th-secondary">{uiT("Total Bills", "कुल बिल")}</p>
              <p className="text-xl font-bold text-white">{salesData?.billCount || 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-th-secondary">{uiT("Total Payments", "कुल भुगतान")}</p>
              <p className="text-xl font-bold text-white">{salesData?.paymentCount || 0}</p>
            </div>
            <div className="card">
              <p className="text-xs text-th-secondary">{uiT("Avg Order Value", "औसत ऑर्डर मूल्य")}</p>
              <p className="text-xl font-bold text-[#1ed760]">
                ₹{salesData?.billCount > 0 ? (salesData.totalRevenue / salesData.billCount).toLocaleString(undefined, { maximumFractionDigits: 0 }) : 0}
              </p>
            </div>
            <div className="card">
              <p className="text-xs text-th-secondary">{uiT("Total Discount", "कुल छूट")}</p>
              <p className="text-xl font-bold text-[#e74c3c]">₹{(salesData?.totalDiscount || 0).toLocaleString()}</p>
            </div>
          </div>

          {salesData?.billCount === 0 && (
            <div className="card text-center py-8">
              <ShoppingCart size={32} className="mx-auto mb-2 text-th-muted" />
              <p className="text-sm text-th-muted">{uiT("No data", "कोई डेटा नहीं")}</p>
            </div>
          )}
        </div>
      )}

      {/* ──────────────── PENDING ──────────────── */}
      {activeTab === "pending" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-amber-400">{pendingData.length}</p>
              <p className="text-sm text-th-secondary">{uiT("Pending Bills", "बाकी बिल")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#e74c3c]">
                ₹{pendingData.reduce((s: number, b: any) => s + (b.pendingAmount || 0), 0).toLocaleString()}
              </p>
              <p className="text-sm text-th-secondary">{uiT("Total Pending Amount", "कुल बाकी राशि")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#1ed760]">
                ₹{pendingData.reduce((s: number, b: any) => {
                  const days = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  return days > 30 ? s + (b.pendingAmount || 0) : s;
                }, 0).toLocaleString()}
              </p>
              <p className="text-sm text-th-secondary">{uiT("Over 30 Days (Amount)", "30 दिन से अधिक (राशि)")}</p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">{uiT("Pending Payments", "बाकी भुगतान")}</h3>
              <span className="text-xs text-th-muted">{pendingData.length} bills</span>
            </div>
            {pendingData.length === 0 ? (
              <div className="text-center py-8">
                <Clock size={32} className="mx-auto mb-2 text-th-muted" />
                <p className="text-sm text-th-muted">{uiT("No pending payments.", "कोई बाकी भुगतान नहीं।")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-th-surface">
                    <tr className="border-b border-th-border">
                      <th className="text-left py-2 px-3 text-th-muted font-medium">{uiT("Bill", "बिल")}</th>
                      <th className="text-left py-2 px-3 text-th-muted font-medium">{uiT("Customer", "ग्राहक")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Total", "कुल")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Pending", "बाकी")}</th>
                      <th className="text-right py-2 px-3 text-th-muted font-medium">{uiT("Days", "दिन")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingData.map((b: any) => {
                      const days = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                      const custName = typeof b.customerId === "object" && b.customerId?.name ? b.customerId.name : "—";
                      return (
                        <tr key={b._id} className="border-b border-th-card hover:bg-th-elevated">
                          <td className="py-2 px-3 font-medium text-white">{b.billNumber || "—"}</td>
                          <td className="py-2 px-3 text-th-secondary">{custName}</td>
                          <td className="py-2 px-3 text-right text-th-secondary">₹{(b.totalAmount || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-amber-400 font-medium">₹{(b.pendingAmount || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={`font-medium ${days > 30 ? "text-[#e74c3c]" : days > 7 ? "text-amber-400" : "text-th-muted"}`}>
                              {days}d
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────── INVENTORY ──────────────── */}
      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-white">{(invData?.totalItems || 0).toLocaleString()}</p>
              <p className="text-sm text-th-secondary">{uiT("Total Items", "कुल आइटम")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#e74c3c]">{(invData?.lowStock?.length || 0).toLocaleString()}</p>
              <p className="text-sm text-th-secondary">{uiT("Low Stock (≤5)", "कम स्टॉक (<=5)")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#1ed760]">₹{(invData?.totalValue || 0).toLocaleString()}</p>
              <p className="text-sm text-th-secondary">{uiT("Stock Value", "स्टॉक मूल्य")}</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-[#1ed760]">{(invData?.byCategory?.length || 0).toLocaleString()}</p>
              <p className="text-sm text-th-secondary">{uiT("Categories", "श्रेणियाँ")}</p>
            </div>
          </div>

          {invData?.byCategory?.length > 0 && (
            <div className="card">
              <h3 className="section-title mb-4">{uiT("Stock by Category", "श्रेणी अनुसार स्टॉक")}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {invData.byCategory.map((cat: any) => (
                  <div key={cat._id} className="flex items-center justify-between p-3 rounded-lg bg-th-elevated">
                    <div>
                      <p className="text-sm font-medium text-white capitalize">{cat._id || uiT("Uncategorized", "बिना श्रेणी")}</p>
                      <p className="text-xs text-th-secondary">{cat.count} {uiT("items", "आइटम")}</p>
                    </div>
                    <span className="text-sm font-semibold text-[#1ed760]">{cat.totalQty} {uiT("units", "इकाई")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invData?.lowStock?.length > 0 && (
            <div className="card border border-[#e74c3c]/30">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-[#e74c3c]" />
                <h3 className="section-title text-[#e74c3c]">{uiT("Low Stock Alert", "कम स्टॉक अलर्ट")}</h3>
              </div>
              <div className="space-y-2">
                {invData.lowStock.map((item: any) => (
                  <div key={item._id} className="flex items-center justify-between p-3 rounded-lg bg-[#e74c3c]/5">
                    <div>
                      <p className="text-sm font-medium text-white">{item.sku} {item.brand ? `- ${item.brand}` : ""}</p>
                      <p className="text-xs text-th-secondary">{item.category || "Frame"}</p>
                    </div>
                    <span className="text-sm font-bold text-[#e74c3c]">{item.quantity || 0} {uiT("left", "शेष")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!invData?.lowStock || invData.lowStock.length === 0) && (
            <div className="card text-center py-8">
              <Package size={32} className="mx-auto mb-2 text-th-muted" />
              <p className="text-sm text-th-muted">{uiT("No inventory data available.", "कोई इन्वेंट्री डेटा उपलब्ध नहीं।")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

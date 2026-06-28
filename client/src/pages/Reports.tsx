import React, { useEffect, useState } from "react";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import { Users, TrendingUp, Clock, Package, AlertTriangle } from "lucide-react";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("customers");
  const [loading, setLoading] = useState(true);
  const [customerData, setCustomerData] = useState<any>(null);
  const [salesData, setSalesData] = useState<any>(null);
  const [pendingData, setPendingData] = useState<any[]>([]);
  const [invData, setInvData] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      api.get("/api/reports/revenue"),
      api.get("/api/reports/inventory"),
      api.get("/api/customers"),
      api.get("/api/bills"),
    ]).then(([rev, inv, cust, bills]) => {
      if (rev.success) setSalesData(rev.data);
      if (inv.success) setInvData(inv.data);
      if (cust.success) setCustomerData(cust.data);
      if (bills.success) setPendingData((bills.data || []).filter((b: any) => (b.pendingAmount || 0) > 0));
    }).finally(() => setLoading(false));
  }, []);

  const tabs = [
    { key: "customers", label: "Customers", icon: Users },
    { key: "sales", label: "Sales", icon: TrendingUp },
    { key: "pending", label: "Pending", icon: Clock },
    { key: "inventory", label: "Inventory", icon: Package },
  ];

  if (loading) return <PageSkeleton page="reports" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Business insights and analytics.</p>
      </div>

      <div className="border-b border-gray-200 dark:border-dark-700">
        <div className="flex gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button key={t.key} onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? "border-primary-600 text-primary-600 dark:text-primary-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "customers" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{customerData?.length || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Customers</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                {customerData?.filter((c: any) => c.totalVisits === 1).length || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">New Customers</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {customerData?.filter((c: any) => (c.totalVisits || 0) > 1).length || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Returning Customers</p>
            </div>
          </div>
          <div className="card">
            <h3 className="section-title mb-4">All Customers</h3>
            {(!customerData || customerData.length === 0) ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No customers yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-dark-700">
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Name</th>
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Mobile</th>
                      <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Visits</th>
                      <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Total Spent</th>
                      <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerData?.map((c: any) => (
                      <tr key={c._id} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700">
                        <td className="py-2 px-3 font-medium">{c.name}</td>
                        <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{c.mobile || "—"}</td>
                        <td className="py-2 px-3 text-right">{c.totalVisits || 0}</td>
                        <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">₹{(c.totalSpent || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">
                          <span className={c.pendingAmount > 0 ? "text-amber-600 dark:text-amber-400 font-medium" : "text-gray-500 dark:text-gray-400"}>
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

      {activeTab === "sales" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">₹{(salesData?.totalRevenue || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                ₹{(salesData?.billCount > 0 ? (salesData.totalRevenue / salesData.billCount) : 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Avg Order Value</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">₹{(salesData?.totalCollection || 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Collection</p>
            </div>
          </div>
          <div className="card">
            <h3 className="section-title mb-4">Sales Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Bills</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{salesData?.billCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Payments</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{salesData?.paymentCount || 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Discount</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  ₹{(salesData?.billCount > 0 ? ((salesData.totalRevenue - salesData.totalCollection) / salesData.billCount) : 0).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Collection Ratio</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                  {salesData?.totalRevenue > 0 ? `${((salesData.totalCollection / salesData.totalRevenue) * 100).toFixed(0)}%` : "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "pending" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{pendingData.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Bills</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                ₹{pendingData.reduce((s: number, b: any) => s + (b.pendingAmount || 0), 0).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Pending Amount</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">
                {pendingData.filter((b: any) => {
                  const days = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  return days > 30;
                }).length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Over 30 Days</p>
            </div>
          </div>
          <div className="card">
            <h3 className="section-title mb-4">Pending Payments</h3>
            {pendingData.length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No pending payments.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-dark-700">
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Bill</th>
                      <th className="text-left py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Customer ID</th>
                      <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Total</th>
                      <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Pending</th>
                      <th className="text-right py-2 px-3 text-gray-500 dark:text-gray-400 font-medium">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingData.map((b: any) => {
                      const days = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                      return (
                        <tr key={b._id} className="border-b border-gray-100 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-700">
                          <td className="py-2 px-3 font-medium">{b.billNumber || "—"}</td>
                          <td className="py-2 px-3 text-gray-500 dark:text-gray-400">{b.customerId || "—"}</td>
                          <td className="py-2 px-3 text-right">₹{(b.totalAmount || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400 font-medium">₹{(b.pendingAmount || 0).toLocaleString()}</td>
                          <td className="py-2 px-3 text-right">
                            <span className={days > 30 ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"}>
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

      {activeTab === "inventory" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{invData?.totalItems || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400">{invData?.lowStock?.length || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-primary-600 dark:text-primary-400">{invData?.totalValue || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Stock Value</p>
            </div>
            <div className="card text-center">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{invData?.topSelling?.length || 0}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Top Items</p>
            </div>
          </div>

          {invData?.lowStock?.length > 0 && (
            <div className="card border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={18} className="text-red-500" />
                <h3 className="section-title text-red-700 dark:text-red-400">Low Stock Alert</h3>
              </div>
              <div className="space-y-2">
                {invData.lowStock.map((item: any) => (
                  <div key={item._id} className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.sku} {item.brand ? `- ${item.brand}` : ""}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.category || "Frame"}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">{item.quantity || 0} left</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!invData?.lowStock || invData.lowStock.length === 0) && (
            <div className="card">
              <h3 className="section-title mb-4">All Stock</h3>
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">No inventory data available.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

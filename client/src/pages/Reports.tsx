import React, { useEffect, useState } from "react";
import api from "../api";
import { BarChart3, TrendingUp, DollarSign, Package, Truck, Users } from "lucide-react";

export default function Reports() {
  const [revenue, setRevenue] = useState<any>(null);
  const [monthly, setMonthly] = useState<any>(null);
  const [invReport, setInvReport] = useState<any>(null);
  const [delReport, setDelReport] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("revenue");

  useEffect(() => {
    api.get("/api/reports/revenue").then((r) => { if (r.success) setRevenue(r.data); });
    api.get("/api/reports/monthly").then((r) => { if (r.success) setMonthly(r.data); });
    api.get("/api/reports/inventory").then((r) => { if (r.success) setInvReport(r.data); });
    api.get("/api/reports/deliveries").then((r) => { if (r.success) setDelReport(r.data); });
  }, []);

  const tabs = [
    { key: "revenue", label: "Revenue", icon: DollarSign },
    { key: "monthly", label: "Monthly", icon: TrendingUp },
    { key: "inventory", label: "Inventory", icon: Package },
    { key: "delivery", label: "Delivery", icon: Truck },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Business insights and analytics.</p>
      </div>

      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={16} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "revenue" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">₹{(revenue?.totalRevenue || 0).toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Total Bills</p>
            <p className="text-3xl font-bold text-gray-900">{revenue?.billCount || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Total Collection</p>
            <p className="text-3xl font-bold text-emerald-600">₹{(revenue?.totalCollection || 0).toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Total Payments</p>
            <p className="text-3xl font-bold text-gray-900">{revenue?.paymentCount || 0}</p>
          </div>
        </div>
      )}

      {activeTab === "monthly" && (
        <div className="card">
          <h3 className="section-title mb-4">Monthly Revenue & Collection</h3>
          {monthly?.revenue?.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 text-gray-500 font-medium">Month</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Revenue</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Bills</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Collection</th>
                    <th className="text-right py-2 px-3 text-gray-500 font-medium">Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {(monthly?.revenue || []).map((r: any) => {
                    const col = (monthly?.collection || []).find((c: any) => c._id === r._id);
                    return (
                      <tr key={r._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{r._id}</td>
                        <td className="py-2 px-3 text-right">₹{r.total.toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">{r.count}</td>
                        <td className="py-2 px-3 text-right text-emerald-600">₹{(col?.total || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right">{col?.count || 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "inventory" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="section-title mb-4">Low Stock Items</h3>
            {invReport?.lowStock?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">All items well stocked.</p>
            ) : (
              <div className="space-y-3">
                {invReport?.lowStock?.map((item: any) => (
                  <div key={item._id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{item.sku}</p>
                      <p className="text-xs text-gray-500">{item.brand} {item.model}</p>
                    </div>
                    <span className="text-sm font-bold text-red-600">{item.quantity || 0} units</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="card">
            <h3 className="section-title mb-4">By Category</h3>
            {invReport?.byCategory?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No inventory data.</p>
            ) : (
              <div className="space-y-3">
                {invReport?.byCategory?.map((cat: any) => (
                  <div key={cat._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <p className="text-sm font-medium text-gray-900">{cat._id || "Uncategorized"}</p>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{cat.totalQty || 0}</p>
                      <p className="text-xs text-gray-400">{cat.count} items</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "delivery" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Pending</p>
            <p className="text-3xl font-bold text-amber-600">{delReport?.pending || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Ready</p>
            <p className="text-3xl font-bold text-emerald-600">{delReport?.ready || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Today's Deliveries</p>
            <p className="text-3xl font-bold text-indigo-600">{delReport?.todayDelivery || 0}</p>
          </div>
          <div className="card">
            <p className="text-sm text-gray-500 mb-1">Overdue</p>
            <p className="text-3xl font-bold text-red-600">{delReport?.overdue || 0}</p>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  Users, ShoppingCart, FileText, CreditCard, Package, Truck,
  TrendingUp, DollarSign, Clock, AlertTriangle
} from "lucide-react";

interface DashboardData {
  counts: { customers: number; orders: number; bills: number; payments: number; inventory: number; deliveries: number; visits: number; };
  todaySales: number; todayCollection: number; readyDeliveries: number; newCustomersToday: number;
  lowStock: number; pendingPayments: number; recentCustomers: any[]; recentOrders: any[]; todayDeliveries: any[]; pendingBills: any[];
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/api/dashboard/stats").then((res) => {
      if (res.success) setData(res.data);
    });
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{greeting}! 👋</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">KMJ Optical dashboard overview.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard title="Today Sales" value={`₹${(data.todaySales || 0).toLocaleString()}`} icon={<TrendingUp size={20} />} color="indigo" />
        <MetricCard title="Collection" value={`₹${(data.todayCollection || 0).toLocaleString()}`} icon={<DollarSign size={20} />} color="emerald" />
        <MetricCard title="Pending" value={`₹${(data.pendingPayments || 0).toLocaleString()}`} icon={<Clock size={20} />} color="amber" />
        <MetricCard title="Low Stock" value={data.lowStock || 0} icon={<AlertTriangle size={20} />} color="red" onClick={() => navigate("/inventory")} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <CountCard title="Customers" value={data.counts.customers} subtitle={`+${data.newCustomersToday} today`} icon={<Users size={18} />} onClick={() => navigate("/customers")} />
        <CountCard title="Orders" value={data.counts.orders} icon={<ShoppingCart size={18} />} onClick={() => navigate("/orders")} />
        <CountCard title="Bills" value={data.counts.bills} icon={<FileText size={18} />} onClick={() => navigate("/bills")} />
        <CountCard title="Deliveries" value={data.readyDeliveries || 0} subtitle="ready" icon={<Truck size={18} />} onClick={() => navigate("/delivery")} />
        <CountCard title="Inventory" value={data.counts.inventory} icon={<Package size={18} />} onClick={() => navigate("/inventory")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Customers</h3>
            <button onClick={() => navigate("/customers")} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">View all</button>
          </div>
          <div className="space-y-2">
            {(data.recentCustomers || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No customers yet</p>
            ) : (
              data.recentCustomers?.slice(0, 5).map((c: any) => (
                <div key={c._id} onClick={() => navigate(`/customers/${c._id}`)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-sm">
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.mobile || "—"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 dark:text-white">Recent Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">View all</button>
          </div>
          <div className="space-y-2">
            {(data.recentOrders || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No orders yet</p>
            ) : (
              data.recentOrders?.slice(0, 5).map((o: any) => (
                <div key={o._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{o.frame || "Frame"} / {o.lens || "Lens"}</p>
                    <p className="text-xs text-gray-400">Qty: {o.quantity || 1}</p>
                  </div>
                  <span className={`badge ${o.status === "Delivered" ? "badge-green" : o.status === "Cancelled" ? "badge-red" : o.status === "Ready" ? "badge-blue" : "badge-yellow"}`}>{o.status || "Draft"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon, color, onClick }: { title: string; value: string | number; icon: React.ReactNode; color: string; onClick?: () => void }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    emerald: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    red: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400",
  };
  return (
    <div onClick={onClick} className={`card ${onClick ? "cursor-pointer hover:shadow-md" : ""} transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${colors[color] || colors.indigo}`}>{icon}</div>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{typeof value === "number" ? value.toLocaleString() : value}</p>
    </div>
  );
}

function CountCard({ title, value, subtitle, icon, onClick }: { title: string; value: number; subtitle?: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={`card text-center ${onClick ? "cursor-pointer hover:shadow-md" : ""} transition-shadow`}>
      <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center mx-auto mb-2 text-indigo-600 dark:text-indigo-400">
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      {subtitle && <p className="text-xs text-indigo-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

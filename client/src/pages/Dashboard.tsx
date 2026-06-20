import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import StatCard from "../components/StatCard";
import {
  Users, ShoppingCart, FileText, Package, Truck,
  TrendingUp, DollarSign, Clock, AlertTriangle, ArrowRight, Calendar
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
        <div className="animate-spin w-8 h-8 border-[3px] border-primary-500 border-t-transparent rounded-full" />
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
    <div className="page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{greeting}!</h1>
          <p className="page-subtitle">Here's what's happening at your shop today.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Today's Sales" value={`₹${(data.todaySales || 0).toLocaleString()}`} icon={<TrendingUp size={20} />} color="primary" />
        <StatCard title="Collection" value={`₹${(data.todayCollection || 0).toLocaleString()}`} icon={<DollarSign size={20} />} color="emerald" />
        <StatCard title="Pending" value={`₹${(data.pendingPayments || 0).toLocaleString()}`} icon={<Clock size={20} />} color="amber" />
        <StatCard title="Low Stock" value={data.lowStock || 0} icon={<AlertTriangle size={20} />} color="red" onClick={() => navigate("/inventory")} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard title="Customers" value={data.counts.customers} subtitle={`+${data.newCustomersToday || 0} today`} icon={<Users size={18} />} color="primary" onClick={() => navigate("/customers")} />
        <StatCard title="Orders" value={data.counts.orders} icon={<ShoppingCart size={18} />} color="blue" onClick={() => navigate("/orders")} />
        <StatCard title="Bills" value={data.counts.bills} icon={<FileText size={18} />} color="emerald" onClick={() => navigate("/bills")} />
        <StatCard title="Ready" value={data.readyDeliveries || 0} subtitle="for pickup" icon={<Truck size={18} />} color="purple" onClick={() => navigate("/pickup")} />
        <StatCard title="Inventory" value={data.counts.inventory} subtitle={`${data.lowStock} low`} icon={<Package size={18} />} color="cyan" onClick={() => navigate("/inventory")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Recent Customers</h3>
            <button onClick={() => navigate("/customers")} className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {(data.recentCustomers || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No customers yet</p>
            ) : (
              data.recentCustomers?.slice(0, 5).map((c: any) => (
                <div key={c._id} onClick={() => navigate(`/customers/${c._id}`)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-750 cursor-pointer transition-all group">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-sm flex-shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.mobile || "—"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0 flex items-center gap-1">
                    <Calendar size={11} />
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <h3 className="section-title">Recent Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium inline-flex items-center gap-1">
              View all <ArrowRight size={14} />
            </button>
          </div>
          <div className="space-y-1">
            {(data.recentOrders || []).length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No orders yet</p>
            ) : (
              data.recentOrders?.slice(0, 5).map((o: any) => (
                <div key={o._id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-dark-750 transition-all group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{o.frame || o.lens || "Order"}</p>
                    <p className="text-xs text-gray-400">Qty: {o.quantity || 1}</p>
                  </div>
                  <span className={`badge ${
                    o.status === "Delivered" ? "badge-green" :
                    o.status === "Cancelled" ? "badge-red" :
                    o.status === "Ready" ? "badge-blue" :
                    o.status === "In Lab" ? "badge-yellow" : "badge-gray"
                  }`}>{o.status || "Draft"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

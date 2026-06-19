import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import StatCard from "../components/StatCard";
import {
  Users, ShoppingCart, FileText, CreditCard, Package, Truck,
  ClipboardList, Eye, TrendingUp, DollarSign, Clock, AlertTriangle
} from "lucide-react";

interface DashboardData {
  counts: {
    customers: number;
    orders: number;
    bills: number;
    payments: number;
    inventory: number;
    deliveries: number;
    visits: number;
  };
  todaySales: number;
  todayCollection: number;
  readyDeliveries: number;
  newCustomersToday: number;
  lowStock: number;
  pendingPayments: number;
  recentCustomers: any[];
  recentOrders: any[];
  todayDeliveries: any[];
  pendingBills: any[];
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

  const { counts } = data;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold mb-1">Good morning! 👋</h1>
        <p className="text-indigo-100 text-sm">Here's what's happening at KMJ Optical today.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Today's Sales"
          value={`₹${(data.todaySales || 0).toLocaleString()}`}
          icon={<TrendingUp size={22} />}
          color="indigo"
        />
        <StatCard
          title="Today's Collection"
          value={`₹${(data.todayCollection || 0).toLocaleString()}`}
          icon={<DollarSign size={22} />}
          color="emerald"
        />
        <StatCard
          title="Pending Payments"
          value={`₹${(data.pendingPayments || 0).toLocaleString()}`}
          icon={<Clock size={22} />}
          color="amber"
        />
        <StatCard
          title="Low Stock Items"
          value={data.lowStock || 0}
          icon={<AlertTriangle size={22} />}
          color="red"
          onClick={() => navigate("/inventory")}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard
          title="Customers"
          value={counts.customers}
          icon={<Users size={22} />}
          color="blue"
          subtitle={`+${data.newCustomersToday} today`}
          onClick={() => navigate("/customers")}
        />
        <StatCard
          title="Orders"
          value={counts.orders}
          icon={<ShoppingCart size={22} />}
          color="purple"
          onClick={() => navigate("/orders")}
        />
        <StatCard
          title="Bills"
          value={counts.bills}
          icon={<FileText size={22} />}
          color="cyan"
          onClick={() => navigate("/bills")}
        />
        <StatCard
          title="Payments"
          value={counts.payments}
          icon={<CreditCard size={22} />}
          color="emerald"
          onClick={() => navigate("/payments")}
        />
        <StatCard
          title="Ready Deliveries"
          value={data.readyDeliveries || 0}
          icon={<Truck size={22} />}
          color="amber"
          onClick={() => navigate("/delivery")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="section-title">Recent Customers</h3>
            <button onClick={() => navigate("/customers")} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {data.recentCustomers?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No customers yet</p>
            ) : (
              data.recentCustomers?.map((c: any) => (
                <div
                  key={c._id}
                  onClick={() => navigate(`/customers/${c._id}`)}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm">
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.mobile || "No phone"}</p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">
                    {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="section-title">Recent Orders</h3>
            <button onClick={() => navigate("/orders")} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {data.recentOrders?.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-4">No orders yet</p>
            ) : (
              data.recentOrders?.map((o: any) => (
                <div
                  key={o._id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{o.frame || "No frame"} / {o.lens || "No lens"}</p>
                    <p className="text-xs text-gray-400">Qty: {o.quantity || 1}</p>
                  </div>
                  <span className={`badge ${
                    o.status === "Delivered" ? "badge-green" :
                    o.status === "Cancelled" ? "badge-red" :
                    o.status === "Ready" ? "badge-blue" :
                    "badge-yellow"
                  }`}>
                    {o.status || "Draft"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Today's Deliveries */}
      {data.todayDeliveries && data.todayDeliveries.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Truck size={18} className="text-amber-500" />
              <h3 className="section-title">Today's Deliveries</h3>
            </div>
            <button onClick={() => navigate("/delivery")} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {data.todayDeliveries.map((d: any) => (
              <div key={d._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 hover:bg-amber-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 font-semibold text-sm">
                    {d.customerId?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.customerId?.name || "—"}</p>
                    <p className="text-xs text-gray-400">{d.customerId?.mobile || ""}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge ${
                    d.status === "Delivered" ? "badge-green" :
                    d.status === "Ready" ? "badge-blue" :
                    d.status === "Cancelled" ? "badge-red" :
                    "badge-yellow"
                  }`}>{d.status}</span>
                  {d.expectedDeliveryDate && (
                    <span className="text-xs text-gray-400">
                      {new Date(d.expectedDeliveryDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Bills */}
      {data.pendingBills && data.pendingBills.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <Clock size={18} className="text-amber-500" />
              <h3 className="section-title">Pending Payments</h3>
            </div>
            <button onClick={() => navigate("/bills")} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              View all
            </button>
          </div>
          <div className="space-y-3">
            {data.pendingBills.map((b: any) => (
              <div key={b._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-semibold text-sm">
                    {b.customerId?.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{b.customerId?.name || "—"}</p>
                    <p className="text-xs text-gray-400">{b.billNumber}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600">₹{(b.pendingAmount || 0).toLocaleString()}</p>
                  <p className="text-xs text-gray-400">
                    {b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

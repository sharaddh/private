import React, { useEffect, useState } from "react";
import api from "../api";

export default function Dashboard() {
  const [stats, setStats] = useState({
    customers: 0,
    orders: 0,
    bills: 0,
    payments: 0,
    inventory: 0,
    deliveries: 0,
  });

  useEffect(() => {
    Promise.all([
      api.get("/api/customers"),
      api.get("/api/orders"),
      api.get("/api/bills"),
      api.get("/api/payments"),
      api.get("/api/inventory"),
      api.get("/api/delivery"),
    ]).then((results) => {
      setStats({
        customers: results[0].data?.length || 0,
        orders: results[1].data?.length || 0,
        bills: results[2].data?.length || 0,
        payments: results[3].data?.length || 0,
        inventory: results[4].data?.length || 0,
        deliveries: results[5].data?.length || 0,
      });
    });
  }, []);

  const cards = [
    { title: "Customers", count: stats.customers, icon: "👥", color: "blue" },
    { title: "Orders", count: stats.orders, icon: "📦", color: "green" },
    { title: "Bills", count: stats.bills, icon: "📄", color: "purple" },
    { title: "Payments", count: stats.payments, icon: "💳", color: "yellow" },
    { title: "Inventory", count: stats.inventory, icon: "📦", color: "red" },
    { title: "Deliveries", count: stats.deliveries, icon: "🚚", color: "indigo" },
  ];

  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-600",
    green: "bg-green-50 border-green-200 text-green-600",
    purple: "bg-purple-50 border-purple-200 text-purple-600",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-600",
    red: "bg-red-50 border-red-200 text-red-600",
    indigo: "bg-indigo-50 border-indigo-200 text-indigo-600",
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-8 rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold mb-2">Welcome to KMJ Optical ERP</h1>
        <p className="text-blue-100">
          Manage your optical business efficiently with our comprehensive ERP system
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className={`border-2 ${colorClasses[card.color as keyof typeof colorClasses]} p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-75">{card.title}</p>
                <p className="text-3xl font-bold mt-2">{card.count}</p>
              </div>
              <div className="text-5xl">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h2 className="text-2xl font-bold mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <a
            href="/customers"
            className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <p className="font-semibold text-blue-600">👥 Add Customer</p>
            <p className="text-sm text-gray-600">Manage customer information</p>
          </a>
          <a
            href="/orders"
            className="p-4 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors"
          >
            <p className="font-semibold text-green-600">📦 Create Order</p>
            <p className="text-sm text-gray-600">Place a new order</p>
          </a>
          <a
            href="/bills"
            className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
          >
            <p className="font-semibold text-purple-600">📄 Generate Bill</p>
            <p className="text-sm text-gray-600">Create billing invoice</p>
          </a>
          <a
            href="/payments"
            className="p-4 bg-yellow-50 border-2 border-yellow-200 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <p className="font-semibold text-yellow-600">💳 Record Payment</p>
            <p className="text-sm text-gray-600">Track payments</p>
          </a>
          <a
            href="/inventory"
            className="p-4 bg-red-50 border-2 border-red-200 rounded-lg hover:bg-red-100 transition-colors"
          >
            <p className="font-semibold text-red-600">📦 Inventory</p>
            <p className="text-sm text-gray-600">Manage stock</p>
          </a>
          <a
            href="/delivery"
            className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <p className="font-semibold text-indigo-600">🚚 Deliveries</p>
            <p className="text-sm text-gray-600">Track shipments</p>
          </a>
        </div>
      </div>
    </div>
  );
}

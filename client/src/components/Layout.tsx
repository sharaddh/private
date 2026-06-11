import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "../api";

const menuItems = [
  { path: "/", label: "Dashboard", icon: "📊" },
  { path: "/customers", label: "Customers", icon: "👥" },
  { path: "/orders", label: "Orders", icon: "📦" },
  { path: "/bills", label: "Bills", icon: "📄" },
  { path: "/payments", label: "Payments", icon: "💳" },
  { path: "/inventory", label: "Inventory", icon: "📦" },
  { path: "/delivery", label: "Delivery", icon: "🚚" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  // Hide sidebar on auth pages
  const isAuthPage = ["/login", "/register"].includes(location.pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-gradient-to-b from-blue-600 to-blue-800 text-white transition-all duration-300 shadow-lg`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center justify-between">
          {sidebarOpen && <h1 className="text-xl font-bold">KMJ Optical</h1>}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 hover:bg-blue-700 rounded"
          >
            {sidebarOpen ? "←" : "→"}
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-8 space-y-2 px-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                location.pathname === item.path
                  ? "bg-white text-blue-600 font-semibold"
                  : "text-blue-100 hover:bg-blue-700"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="absolute bottom-4 left-2 right-2">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-all ${
              !sidebarOpen && "justify-center"
            }`}
          >
            <span>🚪</span>
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white shadow-md px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">
            {menuItems.find((m) => m.path === location.pathname)?.label ||
              "Dashboard"}
          </h2>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Welcome back!</span>
            <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
              👤
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

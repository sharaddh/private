import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken } from "../api";
import {
  LayoutDashboard, Users, ShoppingCart, FileText, CreditCard,
  Package, Truck, Eye, ClipboardList, BarChart3, Settings, LogOut,
  Menu, X, ChevronRight, UserCircle
} from "lucide-react";

const menuItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/visits", label: "Visits", icon: ClipboardList },
  { path: "/prescriptions", label: "Prescriptions", icon: Eye },
  { path: "/orders", label: "Orders", icon: ShoppingCart },
  { path: "/bills", label: "Bills", icon: FileText },
  { path: "/payments", label: "Payments", icon: CreditCard },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/delivery", label: "Delivery", icon: Truck },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    clearToken();
    navigate("/login");
  };

  const isAuthPage = ["/login", "/register"].includes(location.pathname);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed lg:relative z-30 h-full ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold text-gray-900 leading-tight">KMJ Optical</h1>
                <p className="text-xs text-gray-500">ERP System</p>
              </div>
            )}
          </div>
          <button
            onClick={() => { setSidebarOpen(!sidebarOpen); setMobileOpen(false); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors hidden lg:block"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon size={20} className={isActive ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-600"} />
                {sidebarOpen && <span>{item.label}</span>}
                {isActive && sidebarOpen && (
                  <ChevronRight size={16} className="ml-auto text-indigo-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 ${
              !sidebarOpen && "justify-center"
            }`}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-900">
              {menuItems.find((m) => m.path === location.pathname)?.label || "Dashboard"}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <UserCircle size={18} className="text-gray-400" />
              <span className="hidden sm:inline">Admin</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

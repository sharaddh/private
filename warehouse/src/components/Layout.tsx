import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Package, PlusCircle, LogOut, Menu, X, ChevronLeft,
} from "lucide-react";

const sidebarMenu = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/inventory", label: "Lenses", icon: Package },
  { path: "/inventory/new", label: "Add Lens", icon: PlusCircle },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isAuthPage = location.pathname === "/login";
  if (isAuthPage) return <>{children}</>;

  const isActive = (path: string) => location.pathname === path || (path !== "/" && location.pathname.startsWith(path));

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-[72px]"} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 fixed lg:relative z-30 h-full ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package size={16} className="text-white" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-gray-900 leading-tight truncate">Lens Warehouse</h1>
                <p className="text-[9px] text-gray-400 font-medium">KMJ Optical</p>
              </div>
            )}
          </div>
          <button onClick={() => { setSidebarOpen(false); setMobileOpen(false); }}
            className={`p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 ${sidebarOpen ? "hidden lg:block" : "hidden"}`}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setSidebarOpen(true)}
            className={`p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 ${sidebarOpen ? "hidden" : "hidden lg:block"}`}>
            <Menu size={16} />
          </button>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 lg:hidden">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {sidebarMenu.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${active
                  ? "bg-cyan-50 text-cyan-700 font-medium"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}>
                <Icon size={18} className={active ? "text-cyan-600" : "text-gray-400 group-hover:text-gray-600"} />
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-2.5 border-t border-gray-100">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:text-red-600 hover:bg-red-50 w-full transition-all">
            <LogOut size={18} />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg lg:hidden">
              <Menu size={20} />
            </button>
            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg hidden lg:flex">
              <Menu size={18} />
            </button>
            <h2 className="text-base font-semibold text-gray-900">
              {sidebarMenu.find((m) => m.path === location.pathname || (m.path !== "/" && location.pathname.startsWith(m.path)))?.label || "Lens Warehouse"}
            </h2>
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="page-container">{children}</div>
        </main>
      </div>
    </div>
  );
}

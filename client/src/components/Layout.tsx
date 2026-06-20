import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken, get } from "../api";
import {
  LayoutDashboard, Users, ShoppingCart, FileText, CreditCard,
  Package, Truck, BarChart3, Settings, LogOut,
  Menu, X, ChevronRight, Search, Phone, Hand, PlusCircle,
  Sun, Moon, Megaphone
} from "lucide-react";

const menuItems = [
  { path: "/workspace", label: "New Visit", icon: PlusCircle },
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/orders", label: "Orders", icon: ShoppingCart },
  { path: "/pickup", label: "Pickup", icon: Hand },
  { path: "/bills", label: "Bills", icon: FileText },
  { path: "/announcements", label: "Announcements", icon: Megaphone },
  { path: "/payments", label: "Payments", icon: CreditCard },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/delivery", label: "Delivery", icon: Truck },
  { path: "/reports", label: "Reports", icon: BarChart3 },
  { path: "/settings", label: "Settings", icon: Settings },
];

function getToken() {
  return localStorage.getItem("accessToken");
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("theme") === "dark");
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<any>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthPage = ["/login", "/register"].includes(location.pathname);

  // Auth guard
  useEffect(() => {
    if (!isAuthPage && !getToken()) {
      navigate("/login", { replace: true });
    }
  }, [isAuthPage, navigate]);

  // Theme
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleSearch(value: string) {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await get(`/api/customers?q=${encodeURIComponent(value)}`);
      if (res.success) {
        setSearchResults(res.data || []);
        setSearchOpen(res.data.length > 0);
      }
    }, 300);
  }

  function goToCustomer(id: string) {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    navigate(`/customers/${id}`);
  }

  const handleLogout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className={`flex h-screen ${dark ? 'dark' : ''}`}>
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white dark:bg-dark-800 border-r border-gray-200 dark:border-dark-700 flex flex-col transition-all duration-300 fixed lg:relative z-30 h-full ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">KMJ Optical</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">ERP System</p>
              </div>
            )}
          </div>
          <button
            onClick={() => { setSidebarOpen(!sidebarOpen); setMobileOpen(false); }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors hidden lg:block"
          >
            {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-400 lg:hidden"
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
                    ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Icon size={20} className={isActive ? "text-indigo-600 dark:text-indigo-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"} />
                {sidebarOpen && <span>{item.label}</span>}
                {isActive && sidebarOpen && (
                  <ChevronRight size={16} className="ml-auto text-indigo-400" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-dark-700 space-y-1">
          <button
            onClick={() => setDark(!dark)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-dark-700 hover:text-gray-900 dark:hover:text-white transition-all duration-200 ${
              !sidebarOpen && "justify-center"
            }`}
          >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
            {sidebarOpen && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
          </button>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 ${
              !sidebarOpen && "justify-center"
            }`}
          >
            <LogOut size={20} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-dark-900">
        <header className="h-16 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-500 dark:text-gray-400 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white hidden md:block">
              {menuItems.find((m) => m.path === location.pathname)?.label || "Dashboard"}
            </h2>
          </div>

          <div ref={searchRef} className="relative flex-1 max-w-md mx-4">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="Search by name, mobile..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-dark-700 border border-gray-200 dark:border-dark-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-xl max-h-80 overflow-y-auto z-50">
                {searchResults.map((c: any) => (
                  <button
                    key={c._id}
                    type="button"
                    onClick={() => goToCustomer(c._id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left border-b border-gray-100 dark:border-dark-700 last:border-0 transition-colors"
                  >
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex-shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
                        {c.mobile && <><Phone size={11} className="inline mr-0.5" />{c.mobile} • </>}
                        {c.customerId}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-400 flex-shrink-0">
                      <p>{c.totalVisits || 0} visits</p>
                      {c.pendingAmount > 0 && <p className="text-amber-600 dark:text-amber-400 font-medium">₹{c.pendingAmount}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setDark(!dark)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-500 dark:text-gray-400 transition-colors"
              title={dark ? "Light mode" : "Dark mode"}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

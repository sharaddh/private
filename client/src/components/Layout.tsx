import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { clearToken, get } from "../api";
import {
  LayoutDashboard, Users, ShoppingCart, FileText, CreditCard,
  Package, Truck, BarChart3, Settings, LogOut,
  Menu, X, ChevronRight, Search, Phone, Hand, PlusCircle,
  Sun, Moon, Megaphone, Bell, ChevronDown
} from "lucide-react";

const menuItems = [
  { path: "/workspace", label: "New Visit", icon: PlusCircle },
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/customers", label: "Customers", icon: Users },
  { path: "/orders", label: "Orders", icon: ShoppingCart },
  { path: "/pickup", label: "Pickup", icon: Hand },
  { path: "/bills", label: "Bills", icon: FileText },
  { path: "/payments", label: "Payments", icon: CreditCard },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/delivery", label: "Delivery", icon: Truck },
  { path: "/announcements", label: "Announcements", icon: Megaphone },
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

  useEffect(() => {
    if (!isAuthPage && !getToken()) navigate("/login", { replace: true });
  }, [isAuthPage, navigate]);

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
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
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
      if (res.success) { setSearchResults(res.data || []); setSearchOpen(res.data.length > 0); }
    }, 300);
  }

  function goToCustomer(id: string) {
    setSearchOpen(false); setSearchQuery(""); setSearchResults([]);
    navigate(`/customers/${id}`);
  }

  const handleLogout = () => {
    clearToken();
    navigate("/login", { replace: true });
  };

  if (isAuthPage) return <>{children}</>;

  const currentPage = menuItems.find((m) => m.path === location.pathname);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-dark-900 overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } bg-white dark:bg-dark-900 lg:dark:bg-dark-950 border-r border-gray-200 dark:border-dark-800 flex flex-col transition-all duration-300 ease-out fixed lg:relative z-30 h-full ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-dark-800/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-accent-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-500/20">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">KMJ Optical</h1>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">ERP System</p>
              </div>
            )}
          </div>
          <button onClick={() => { setSidebarOpen(!sidebarOpen); setMobileOpen(false); }}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors hidden lg:block">
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 lg:hidden">
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5 scrollbar-thin">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${
                  isActive
                    ? "bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium"
                    : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                }`}
              >
                <Icon size={19} className={isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300"} />
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
                {isActive && sidebarOpen && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary-500 dark:bg-primary-400 shadow-sm" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-200 dark:border-dark-800/50 space-y-1">
          <button onClick={() => setDark(!dark)}
            className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200 w-full ${
              !sidebarOpen && "justify-center"
            }`}
          >
            <div className={`relative w-10 h-5 rounded-full transition-all duration-300 ${
              dark ? "bg-primary-500/30" : "bg-gray-300"
            }`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 flex items-center justify-center ${
                dark ? "left-[22px]" : "left-0.5"
              }`}>
                {dark ? <Moon size={8} className="text-primary-600" /> : <Sun size={8} className="text-amber-500" />}
              </div>
            </div>
            {sidebarOpen && <span className="text-sm">{dark ? "Light" : "Dark"}</span>}
          </button>
          <button onClick={handleLogout}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50 dark:text-red-400/80 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition-all duration-200 w-full ${
              !sidebarOpen && "justify-center"
            }`}
          >
            <LogOut size={18} />
            {sidebarOpen && <span className="text-sm">Logout</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-dark-900">
        <header className="h-16 bg-white/70 dark:bg-dark-800/70 backdrop-blur-xl border-b border-gray-200/60 dark:border-dark-700/50 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)}
              className="btn-ghost lg:hidden p-2">
              <Menu size={20} />
            </button>
            <div className="hidden md:block">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                {currentPage?.label || "Dashboard"}
              </h2>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {currentPage?.label === "Dashboard" ? "Overview of your business" : `Manage ${currentPage?.label?.toLowerCase() || ""}`}
              </p>
            </div>
          </div>

          <div ref={searchRef} className="relative flex-1 max-w-md mx-2 lg:mx-6">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
              className="w-full pl-9 pr-4 py-2 bg-gray-100 dark:bg-dark-750 border border-gray-200 dark:border-dark-700 rounded-xl text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 transition-all"
            />
            {searchOpen && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-dark-800 border border-gray-100 dark:border-dark-700 rounded-xl shadow-soft-lg max-h-80 overflow-y-auto z-50">
                {searchResults.map((c: any) => (
                  <button key={c._id} type="button" onClick={() => goToCustomer(c._id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/10 text-left border-b border-gray-50 dark:border-dark-700 last:border-0 transition-colors">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-xs flex-shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {c.mobile && <><Phone size={10} className="inline mr-0.5" />{c.mobile} • </>}
                        {c.customerId}
                      </p>
                    </div>
                    <div className="text-right text-xs text-gray-400 flex-shrink-0">
                      <p>{c.totalVisits || 0} visits</p>
                      {c.pendingAmount > 0 && <p className="text-amber-500 font-medium">₹{c.pendingAmount}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div /> {/* spacer */}
        </header>

        <main className="flex-1 overflow-auto p-4 lg:p-6 scrollbar-thin">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}

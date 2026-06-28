import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { get, post } from "../api";
import { invalidateCache } from "../hooks/useCache";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Users, ShoppingCart, FileText, CreditCard,
  Package, Truck, BarChart3, Settings, MessageCircle,
  Menu, X, Search, Phone, PlusCircle,
  Megaphone, UserPlus, Hand, ChevronLeft,
} from "lucide-react";

interface DrawerForm {
  name: string;
  mobile: string;
  email: string;
  age: string;
  gender: string;
  city: string;
  address: string;
}

const initialDrawer: DrawerForm = { name: "", mobile: "", email: "", age: "", gender: "", city: "", address: "" };

const allDesktopMenu = [
  { path: "/workspace", label: "New Visit", icon: PlusCircle, staff: true },
  { path: "/", label: "Dashboard", icon: LayoutDashboard, staff: true },
  { path: "/customers", label: "Customers", icon: Users, staff: true },
  { path: "/orders", label: "Orders", icon: ShoppingCart, staff: true },
  { path: "/bills", label: "Bills", icon: FileText, staff: true },
  { path: "/inventory", label: "Inventory", icon: Package, staff: false },
  { path: "/delivery", label: "Delivery", icon: Truck, staff: false },
  { path: "/pickup", label: "Pickup", icon: Hand, staff: true },
  { path: "/payments", label: "Payments", icon: CreditCard, staff: false },
  { path: "/announcements", label: "Announcements", icon: Megaphone, staff: false },
  { path: "/reports", label: "Reports", icon: BarChart3, staff: false },
  { path: "/whatsapp", label: "WhatsApp", icon: MessageCircle, staff: true },
  { path: "/settings", label: "Settings", icon: Settings, staff: true },
];

const allMobileNav = [
  { path: "/", label: "Home", icon: LayoutDashboard, staff: true },
  { path: "/customers", label: "Customers", icon: Users, staff: true },
  { path: "/workspace", label: "New Visit", icon: PlusCircle, staff: true },
  { path: "/orders", label: "Orders", icon: ShoppingCart, staff: true },
  { path: "/bills", label: "Bills", icon: FileText, staff: true },
];

function getToken(): string | null {
  return localStorage.getItem("accessToken");
}

export default function Layout({ children }: { children: ReactNode }) {
  const { isStaff } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [drawerForm, setDrawerForm] = useState<DrawerForm>(initialDrawer);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [prevScroll, setPrevScroll] = useState(0);
  const [navVisible, setNavVisible] = useState(true);

  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const isAuthPage = ["/login", "/staff-login", "/register"].includes(location.pathname);

  useEffect(() => {
    if (!isAuthPage && !getToken()) navigate("/login", { replace: true });
  }, [isAuthPage, navigate]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const current = window.scrollY;
      setNavVisible(prevScroll > current || current < 20);
      setPrevScroll(current);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [prevScroll]);

  const handleSearch = useCallback((value: string) => {
    setSearchQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.length < 2) { setSearchResults([]); setSearchOpen(false); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await get<Array<Record<string, unknown>>>("/api/customers?q=" + encodeURIComponent(value));
      if (res.success) { setSearchResults(res.data || []); setSearchOpen(true); }
    }, 300);
  }, []);

  const goToCustomer = useCallback((id: string) => {
    setSearchOpen(false); setSearchQuery(""); setSearchResults([]);
    navigate(`/customers/${id}`);
  }, [navigate]);

  const goAddCustomer = useCallback(() => {
    setSearchOpen(false);
    setDrawerForm({ ...initialDrawer, mobile: searchQuery.replace(/\D/g, "") });
    setDrawerError("");
    setShowAddDrawer(true);
  }, [searchQuery]);

  const handleCreateCustomer = useCallback(async () => {
    if (!drawerForm.name.trim()) { setDrawerError("Name is required"); return; }
    if (!drawerForm.mobile.trim()) { setDrawerError("Mobile is required"); return; }
    setDrawerSaving(true); setDrawerError("");
    try {
      const res = await post("/api/customers", {
        name: drawerForm.name.trim(),
        mobile: drawerForm.mobile.trim(),
        ...(drawerForm.email.trim() && { email: drawerForm.email.trim() }),
        ...(drawerForm.age && { age: Number(drawerForm.age) }),
        ...(drawerForm.gender && { gender: drawerForm.gender }),
        ...(drawerForm.city.trim() && { city: drawerForm.city.trim() }),
        ...(drawerForm.address.trim() && { address: drawerForm.address.trim() }),
      });
      if (res.success) {
        invalidateCache("/api/customers");
        setShowAddDrawer(false);
        toast.success("Customer created successfully");
        navigate(`/customers/${res.data?._id}`);
      } else {
        setDrawerError(res.message || "Failed to create customer");
      }
    } catch {
      setDrawerError("An error occurred");
    } finally {
      setDrawerSaving(false);
    }
  }, [drawerForm, navigate, toast]);

  if (isAuthPage) return <>{children}</>;

  const isActive = (path: string) => location.pathname === path;
  const desktopMenu = allDesktopMenu.filter(m => !isStaff || m.staff);
  const mobileNav = allMobileNav.filter(m => !isStaff || m.staff);

  return (
    <div className="flex h-screen bg-surface-50 dark:bg-dark-850 overflow-hidden">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Desktop Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-[72px]"} bg-white/80 dark:bg-dark-850/90 backdrop-blur-2xl border-r border-surface-200/50 dark:border-dark-600/30 flex flex-col transition-all duration-300 ease-out fixed lg:relative z-30 h-full ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Sidebar Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-surface-200/50 dark:border-dark-600/20">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-soft flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-muted-900 dark:text-white leading-tight truncate">KMJ Optical</h1>
                <p className="text-[9px] text-muted-400 font-medium">ERP System</p>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)}
            className={`p-1.5 hover:bg-surface-100/60 dark:hover:bg-muted-800/60 rounded-lg text-muted-400 hover:text-muted-600 dark:hover:text-muted-300 transition-colors ${sidebarOpen ? "hidden lg:block" : "hidden"}`}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setSidebarOpen(true)}
            className={`p-1.5 hover:bg-surface-100/60 dark:hover:bg-muted-800/60 rounded-lg text-muted-400 hover:text-muted-600 dark:hover:text-muted-300 transition-colors ${sidebarOpen ? "hidden" : "hidden lg:block"}`}>
            <Menu size={16} />
          </button>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 hover:bg-surface-100/60 dark:hover:bg-muted-800/60 rounded-lg text-muted-400 lg:hidden">
            <X size={16} />
          </button>
        </div>

        {/* Sidebar Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5 scrollbar-thin">
          {desktopMenu.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group ${active
                  ? "bg-primary-50/80 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 font-medium"
                  : "text-muted-500 hover:text-muted-700 dark:text-muted-400 dark:hover:text-muted-200 hover:bg-surface-100/60 dark:hover:bg-dark-700/60"
                }`}>
                <Icon size={18} className={active ? "text-primary-600 dark:text-primary-400" : "text-muted-400 group-hover:text-muted-600 dark:text-muted-500 dark:group-hover:text-muted-300"} />
                {sidebarOpen && <span className="text-sm">{item.label}</span>}
                {active && sidebarOpen && <span className="ml-auto w-1 h-1 rounded-full bg-primary-500 dark:bg-primary-400" />}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white/70 dark:bg-dark-850/80 backdrop-blur-xl border-b border-surface-200/60 dark:border-dark-600/30 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="btn-ghost p-2 lg:hidden">
              <Menu size={20} />
            </button>
            <button onClick={() => setSidebarOpen(true)} className="btn-ghost p-2 hidden lg:flex">
              <Menu size={18} />
            </button>
            <h2 className="text-base font-semibold text-muted-900 dark:text-white hidden sm:block">
              {desktopMenu.find((m) => m.path === location.pathname)?.label || "Dashboard"}
            </h2>
          </div>

          {/* Search */}
          <div ref={searchRef} className="relative flex-1 max-w-xs lg:max-w-sm mx-2 lg:mx-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-400" />
            <input type="text" placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setSearchOpen(true); }}
              className="w-full pl-8 pr-3 py-2 bg-white/60 dark:bg-dark-800/60 backdrop-blur-sm border border-surface-200/50 dark:border-dark-600/40 rounded-xl text-sm text-muted-900 dark:text-white placeholder-muted-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400/60 transition-all" />
            {searchOpen && searchQuery.length >= 2 && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white/80 dark:bg-dark-800/80 backdrop-blur-xl border border-surface-200/50 dark:border-dark-600/30 rounded-xl shadow-glass max-h-80 overflow-y-auto z-50">
                {searchResults.length > 0 ? (
                  searchResults.map((c) => (
                    <button key={c._id as string} type="button" onClick={() => goToCustomer(c._id as string)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary-50/60 dark:hover:bg-primary-900/10 text-left border-b border-surface-200/30 dark:border-dark-600/30 last:border-0 transition-colors">
                      <div className="w-8 h-8 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-xs flex-shrink-0">
                        {String(c.name ?? "?").charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-muted-900 dark:text-white truncate">{String(c.name ?? "")}</p>
                        <p className="text-xs text-muted-400 truncate">
                          {c.mobile && <><Phone size={10} className="inline mr-0.5" />{String(c.mobile)} • </>}
                          {String(c.customerId ?? "")}
                        </p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-6 text-center text-sm text-muted-400">No customer found</div>
                )}
                <div className="px-4 pb-3 pt-2 border-t border-surface-200/30 dark:border-dark-600/30">
                  <button onClick={goAddCustomer}
                    className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-xl transition-colors shadow-soft">
                    <UserPlus size={15} /> Add New Customer
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Spacer for mobile nav */}
          <div className="lg:hidden w-8" />
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto pb-[72px] lg:pb-6 scrollbar-thin">
          <div className="max-w-7xl mx-auto p-4 lg:p-6">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navbar */}
      <nav className={`fixed bottom-0 left-0 right-0 z-40 lg:hidden transition-transform duration-300 ease-out ${navVisible ? "translate-y-0" : "translate-y-full"}`}>
        <div className="bg-white/80 dark:bg-dark-850/90 backdrop-blur-2xl border-t border-surface-200/60 dark:border-dark-600/40 shadow-nav dark:shadow-nav-dark">
          <div className="flex items-center justify-around h-[64px] px-2 pb-1">
            {mobileNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="nav-link relative flex-1 max-w-[72px]"
                >
                  <div className={`nav-link-icon relative ${active ? "text-primary-600 dark:text-primary-400" : "text-muted-400 dark:text-muted-500"}`}>
                    <Icon
                      size={active ? 22 : 20}
                      className={`transition-all duration-200 ${active ? "scale-110" : ""}`}
                      style={active ? { animation: "icon-bounce 0.35s ease-out" } : undefined}
                    />

                  </div>
                  <span className={`nav-link-label ${active ? "text-primary-600 dark:text-primary-400 font-semibold" : "text-muted-400 dark:text-muted-500"}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Add Customer Drawer */}
      {showAddDrawer && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setShowAddDrawer(false)}>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg mx-auto bg-white/80 dark:bg-dark-800/80 backdrop-blur-2xl rounded-t-3xl shadow-glass-lg animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white/80 dark:bg-dark-800/80 backdrop-blur-2xl z-10 flex items-center justify-between px-6 pt-5 pb-3 border-b border-surface-200/50 dark:border-dark-600/30">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-50/80 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400">
                  <UserPlus size={18} />
                </div>
                <h3 className="text-lg font-bold text-muted-900 dark:text-white">New Customer</h3>
              </div>
              <button onClick={() => setShowAddDrawer(false)} className="p-1.5 hover:bg-surface-100/60 dark:hover:bg-muted-700/60 rounded-lg text-muted-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {drawerError && (
                <div className="bg-red-50/80 dark:bg-red-900/20 text-red-600 dark:text-red-400 px-4 py-3 rounded-xl text-sm">{drawerError}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">Full Name *</label>
                <input className="input-field" value={drawerForm.name}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter customer name" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">Mobile *</label>
                <input className="input-field" value={drawerForm.mobile}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Phone number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">Email</label>
                  <input className="input-field" type="email" value={drawerForm.email}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">Age</label>
                  <input className="input-field" type="number" value={drawerForm.age}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, age: e.target.value }))}
                    placeholder="Age" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">Gender</label>
                  <select className="input-field" value={drawerForm.gender}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">City</label>
                  <input className="input-field" value={drawerForm.city}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="City" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">Address</label>
                <textarea className="input-field" rows={2} value={drawerForm.address}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Address (optional)" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddDrawer(false)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleCreateCustomer} disabled={drawerSaving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {drawerSaving ? (
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <UserPlus size={16} />
                  )}
                  {drawerSaving ? "Creating..." : "Create Customer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useRef, useCallback, useEffect, memo, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { get, post } from "../api";
import { invalidateCache } from "../hooks/useCache";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";
import { useTranslate } from "../context/TranslateContext";
import {
  LayoutDashboard, Users, ShoppingCart, FileText, CreditCard,
  Package, Truck, BarChart3, Settings, MessageCircle,
  Menu, X, Search, Phone, PlusCircle, Camera,
  Megaphone, UserPlus, Hand, ChevronLeft, Building2, Loader2,
  PanelLeft,
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
  { path: "/cameras", label: "Cameras", icon: Camera, staff: true },
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

const SearchResultItem = memo(function SearchResultItem({ customer, isHighlighted, onClick }: {
  customer: Record<string, unknown>;
  isHighlighted: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick}
      className={`group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 border-b border-th-hover/70 last:border-b-0 ${isHighlighted ? "bg-th-hover/90" : "hover:bg-th-hover"}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full font-semibold text-xs flex-shrink-0 transition-transform duration-150 group-hover:scale-105" style={{ backgroundColor: '#1ed760', color: '#121212' }}>
        {String(customer.name ?? "?").charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-th-text truncate">{String(customer.name ?? "")}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-th-secondary">
          {customer.mobile ? <><Phone size={9} className="shrink-0" />{String(customer.mobile)}</> : null}
          {customer.mobile && customer.customerId ? <span className="mx-1">·</span> : null}
          {customer.customerId ? <span>{String(customer.customerId)}</span> : null}
        </p>
      </div>
      <div className="rounded-lg bg-th-hover px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-th-secondary transition-all duration-150 group-hover:bg-[#1ed760]/15 group-hover:text-[#1ed760]">
        Open
      </div>
    </button>
  );
});

export default function Layout({ children }: { children: ReactNode }) {
  const { isStaff, currentBranch } = useAuth();
  const { uiT } = useTranslate();

  const trLabel = useCallback((label: string) => {
    const map: Record<string, string> = {
      "New Visit": uiT("New Visit", "नई विज़िट"),
      "Dashboard": uiT("Dashboard", "डैशबोर्ड"),
      "Customers": uiT("Customers", "ग्राहक"),
      "Orders": uiT("Orders", "ऑर्डर"),
      "Bills": uiT("Bills", "बिल"),
      "Inventory": uiT("Inventory", "इन्वेंट्री"),
      "Delivery": uiT("Delivery", "डिलीवरी"),
      "Pickup": uiT("Pickup", "पिकअप"),
      "Payments": uiT("Payments", "भुगतान"),
      "Announcements": uiT("Announcements", "घोषणाएँ"),
      "Reports": uiT("Reports", "रिपोर्ट"),
      "WhatsApp": uiT("WhatsApp", "WhatsApp"),
      "Cameras": uiT("Cameras", "कैमरे"),
      "Settings": uiT("Settings", "सेटिंग्स"),
      "Home": uiT("Home", "होम"),
    };
    return map[label] || label;
  }, [uiT]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<Record<string, unknown>>>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [drawerForm, setDrawerForm] = useState<DrawerForm>(initialDrawer);
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [drawerError, setDrawerError] = useState("");

  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const isAuthPage = ["/login", "/staff-login", "/register"].includes(location.pathname);

  useEffect(() => {
    if (isAuthPage) { document.title = "KMJ Optical — Login"; return; }
    const match = desktopMenu.find((m) => m.path === location.pathname);
    document.title = match ? `KMJ Optical — ${match.label}` : "KMJ Optical";
  }, [location.pathname, isAuthPage]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const input = searchRef.current?.querySelector("input");
        if (input) { input.focus(); input.select(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = useCallback((value: string) => {
    const trimmed = value.trim();
    setSearchQuery(value);
    setHighlightedIndex(-1);
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!trimmed) {
      setSearchResults([]);
      setSearchOpen(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      const res = await get<Array<Record<string, unknown>>>('/api/customers?search=' + encodeURIComponent(trimmed));
      if (res.success) {
        const list = (res.data as any)?.data || res.data || [];
        const results = Array.isArray(list) ? list : [];
        setSearchResults(results);
        setSearchOpen(results.length > 0 || trimmed.length > 0);
      } else {
        setSearchResults([]);
        setSearchOpen(true);
      }
      setSearchLoading(false);
    }, 250);
  }, []);

  const clearSearch = useCallback(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearchQuery("");
    setSearchResults([]);
    setSearchOpen(false);
    setSearchLoading(false);
    setHighlightedIndex(-1);
  }, []);

  const goToCustomer = useCallback((id: string) => {
    setSearchOpen(false); setSearchQuery(""); setSearchResults([]); setHighlightedIndex(-1);
    navigate(`/customers/${id}`);
  }, [navigate]);

  const goAddCustomer = useCallback(() => {
    setSearchOpen(false);
    setDrawerForm({ ...initialDrawer, mobile: searchQuery.replace(/\D/g, "") });
    setDrawerError("");
    setShowAddDrawer(true);
  }, [searchQuery]);

  const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchOpen && searchResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % Math.max(searchResults.length, 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((prev) => (prev <= 0 ? Math.max(searchResults.length - 1, 0) : prev - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedIndex >= 0 && searchResults[highlightedIndex]) {
        goToCustomer(String((searchResults[highlightedIndex] as any)._id));
      } else if (searchQuery.trim()) {
        goAddCustomer();
      }
    } else if (event.key === "Escape") {
      setSearchOpen(false);
      setHighlightedIndex(-1);
    }
  }, [goAddCustomer, goToCustomer, highlightedIndex, searchOpen, searchQuery, searchResults]);

  const handleCreateCustomer = useCallback(async () => {
    if (!drawerForm.name.trim()) { setDrawerError("Name is required"); return; }
    if (!drawerForm.mobile.trim()) { setDrawerError("Mobile is required"); return; }
    const digits = drawerForm.mobile.replace(/\D/g, "");
    if (digits.length < 10) { setDrawerError("Mobile must be at least 10 digits"); return; }
    setDrawerSaving(true); setDrawerError("");
    try {
      const res = await post<{ _id: string }>("/api/customers", {
        name: drawerForm.name.trim(),
        mobile: drawerForm.mobile.trim(),
        ...(drawerForm.email.trim() && { email: drawerForm.email.trim() }),
        ...(drawerForm.age && { age: Number(drawerForm.age) }),
        ...(drawerForm.gender && { gender: drawerForm.gender }),
        ...(drawerForm.city.trim() && { city: drawerForm.city.trim() }),
        ...(drawerForm.address.trim() && { address: drawerForm.address.trim() }),
      });
      if (res.success) {
        invalidateCache("/api/customers?limit=1000");
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
    <div className="flex h-screen overflow-hidden bg-th-base">
      {mobileOpen && (
        <div className="fixed inset-0 z-20 lg:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-[72px]"} flex flex-col transition-all duration-200 ease-out fixed lg:relative z-30 h-full ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"} bg-th-surface border-r border-th-border`}>
        {/* Logo */}
        <div className="h-11 flex items-center justify-between px-4 border-b border-th-hover">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1ed760' }}>
              <span className="font-bold text-xs" style={{ color: '#121212' }}>K</span>
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-sm font-semibold text-th-text leading-tight truncate">KMJ Optical</h1>
                <p className="text-xs text-th-secondary">ERP System</p>
              </div>
            )}
          </div>
          <button onClick={() => setSidebarOpen(false)} aria-label="Collapse sidebar"
            className={`p-1 rounded-sm transition-colors hover:bg-th-hover text-th-secondary ${sidebarOpen ? "hidden lg:block" : "hidden"}`}>
            <ChevronLeft size={14} />
          </button>
          <button onClick={() => setSidebarOpen(true)} aria-label="Expand sidebar"
            className={`p-1 rounded-sm transition-colors hover:bg-th-hover text-th-secondary ${sidebarOpen ? "hidden" : "hidden lg:block"}`}>
            <Menu size={14} />
          </button>
          <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="p-1 rounded-sm transition-colors hover:bg-th-hover text-th-secondary lg:hidden">
            <X size={14} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-px scrollbar-none">
          {desktopMenu.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-sm transition-colors duration-150 ${
                  active
                    ? "text-th-text font-semibold"
                    : "hover:text-th-text hover:bg-th-hover text-th-secondary"
                }`}>
                <Icon size={16} className={active ? "text-th-text" : "text-th-secondary"} />
                {sidebarOpen && <span className="text-sm">{trLabel(item.label)}</span>}
                {active && sidebarOpen && <span className="ml-auto w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1ed760' }} />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 z-1">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-th-border px-4 shadow-sm glass-header lg:px-6">
  
  {/* --- Left Section: Menus & Title --- */}
  <div className="flex w-1/4 items-center gap-3">
    <button 
      onClick={() => setMobileOpen(true)} 
      aria-label="Open mobile menu" 
      className="flex h-9 w-9 items-center justify-center rounded-md text-th-text transition-colors hover:bg-th-hover lg:hidden"
    >
      <Menu size={20} />
    </button>
    
    <button 
      onClick={() => setSidebarOpen(true)} 
      aria-label="Open sidebar" 
      className="hidden h-9 w-9 items-center justify-center rounded-md text-th-text transition-colors hover:bg-th-hover lg:flex"
    >
      <PanelLeft size={20} />
    </button>
    
    <h2 className="hidden truncate text-sm font-semibold tracking-wide text-th-text sm:block">
      {desktopMenu.find((m) => m.path === location.pathname)?.label || "Dashboard"}
    </h2>
  </div>

  {/* --- Center Section: Search Bar --- */}
  <div 
    ref={searchRef} 
    className="relative rounded-none mx-2 flex w-full max-w-xl flex-1 items-center justify-center lg:mx-4"
  >
    <div
      className={`group flex w-full items-center rounded-2xl border bg-gradient-to-r from-th-hover/80 to-th-hover/60 backdrop-blur-md transition-all duration-300 ease-out ${
        searchOpen
          ? "border-[#1ed760]/30 ring-4 ring-[#1ed760]/10 shadow-[0_8px_30px_rgba(30,215,96,0.15)]"
          : "border-white/10 hover:border-[#1ed760]/10 hover:shadow-md"
      }`}
    >
      {/* Search Icon / Loader */}
      <div
        className={`ml-4 mr-2 flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-300 ${
          searchLoading || searchOpen
            ? "text-[#1ed760]"
            : "text-th-secondary group-hover:text-[#1ed760]"
        }`}
      >
        {searchLoading ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Search size={18} className="transition-transform duration-300 group-hover:scale-110" />
        )}
      </div>

      {/* Input Field */}
      <input
        type="text"
        placeholder={uiT("Search customers...", "ग्राहक खोजें...")}
        value={searchQuery}
        onChange={(e) => handleSearch(e.target.value)}
        onKeyDown={handleSearchKeyDown}
        onFocus={() => {
          if (searchQuery.trim()) setSearchOpen(true);
        }}
        className="w-full bg-transparent py-3 pr-4 text-[15px] font-medium text-th-text placeholder-th-secondary/70 outline-none transition-all duration-300 placeholder:font-normal"
        aria-label="Search customers"
      />

      {/* Clear Button */}
      {searchQuery.trim() && (
        <button
          type="button"
          onClick={clearSearch}
          aria-label="Clear search"
          className="mr-2 flex h-9 w-9 items-center justify-center rounded-full text-th-secondary/80 transition-all duration-200 hover:bg-white/15 hover:text-th-text hover:scale-110 active:scale-95"
        >
          <X size={16} />
        </button>
      )}
    </div>

    {/* --- Search Results Dropdown --- */}
    {searchOpen && searchQuery.trim() && (
      <div className="absolute bg-stone-900 left-0 right-0 top-full z-50 mt-3 flex max-h-[22rem] flex-col overflow-hidden rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ">
        
        {/* Scrollable Results Area */}
        <div className="flex-1 overflow-y-auto scrollbar-none">
          {searchLoading ? (
            <div className="space-y-3 px-4 py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex animate-pulse items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-th-hover" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-32 rounded bg-th-hover" />
                    <div className="h-2.5 w-20 rounded bg-th-hover/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : searchResults.length > 0 ? (
            <div className="py-2">
              {searchResults.map((c, index) => (
                <SearchResultItem
                  key={String(c._id ?? `${(c).name}-${index}`)}
                  customer={c}
                  isHighlighted={index === highlightedIndex}
                  onClick={() => goToCustomer(String(c._id ?? ""))}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-th-secondary">
              <p className="font-medium text-th-text">{uiT("No customer found", "कोई ग्राहक नहीं मिला")}</p>
              <p className="mt-1.5 text-xs opacity-80">
                {uiT("Try a name, phone number, or customer ID", "नाम, फोन नंबर या ग्राहक आईडी से कोशिश करें")}
              </p>
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="border-t border-white/10 bg-black/20 p-3 backdrop-blur-md">
          <button 
            onClick={goAddCustomer}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#1ed760] px-4 py-2.5 text-sm font-bold uppercase tracking-wider text-black transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110 hover:shadow-lg active:scale-[0.98]"
          >
            <UserPlus size={16} /> 
            {uiT("Add New Customer", "नया ग्राहक जोड़ें")}
          </button>
        </div>
      </div>
    )}
  </div>

  {/* --- Right Section: Branch Indicator --- */}
  <div className="flex w-1/4 items-center justify-end">
    {currentBranch && (
      <div className="flex items-center gap-2 rounded-lg bg-th-hover px-3 py-1.5 text-xs font-medium text-th-secondary shadow-sm">
        <Building2 size={14} className="text-[#1ed760]" />
        <span className="hidden max-w-[120px] truncate sm:inline-block">
          {currentBranch.name}
        </span>
      </div>
    )}
  </div>
  
</header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-[64px] lg:pb-4 scrollbar-none scroll-smooth">
          <div className="max-w-7xl mx-auto p-4 lg:p-5 animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav — frosted glass */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden">
        <div className="border-t border-th-hover glass-nav">
          <div className="flex items-center justify-around h-16 px-2 pb-1">
            {mobileNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className="nav-link flex-1 max-w-[72px] py-1"
                >
                  <div className={`nav-link-icon ${active ? "text-[#1ed760]" : "text-th-secondary"}`}>
                    <Icon size={active ? 22 : 20} className={`transition-all duration-200 ${active ? "scale-105" : ""}`} />
                  </div>
                  <span className={`nav-link-label ${active ? "text-[#1ed760] font-semibold" : "text-th-secondary font-normal"}`}>
                    {trLabel(item.label)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Add Customer drawer */}
      {showAddDrawer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowAddDrawer(false)}>
          <div className="fixed inset-0 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }} />
          <div onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg mx-auto rounded-2xl max-h-[90vh] overflow-y-auto animate-scale-in bg-th-surface/95 backdrop-blur-xl" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.28)' }}>
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 pt-5 pb-3 bg-th-surface border-b border-th-hover">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-sm flex items-center justify-center" style={{ backgroundColor: '#1ed760', color: '#121212' }}>
                  <UserPlus size={16} />
                </div>
                <h3 className="text-base font-semibold text-th-text">New Customer</h3>
              </div>
              <button onClick={() => setShowAddDrawer(false)} aria-label="Close" className="p-1.5 rounded-sm transition-colors hover:bg-th-hover text-th-secondary">
                <X size={16} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {drawerError && (
                <div className="px-4 py-3 rounded-sm text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>{drawerError}</div>
              )}
              <div>
                <label className="block text-sm mb-1.5 text-th-secondary">Full Name *</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
                  style={{ border: '1px solid rgb(124,124,124)' }} value={drawerForm.name}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter customer name" autoFocus />
              </div>
              <div>
                <label className="block text-sm mb-1.5 text-th-secondary">Mobile *</label>
                <input className="w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
                  style={{ border: '1px solid rgb(124,124,124)' }} value={drawerForm.mobile}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, mobile: e.target.value.replace(/\D/g, "") }))}
                  placeholder="Phone number" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-1.5 text-th-secondary">Email</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
                    style={{ border: '1px solid rgb(124,124,124)' }} type="email" value={drawerForm.email}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="Email" />
                </div>
                <div>
                  <label className="block text-sm mb-1.5 text-th-secondary">Age</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
                    style={{ border: '1px solid rgb(124,124,124)' }} type="number" value={drawerForm.age}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, age: e.target.value }))}
                    placeholder="Age" />
                </div>
                <div>
                  <label className="block text-sm mb-1.5 text-th-secondary">Gender</label>
                  <select className="w-full px-3 py-2 rounded-lg text-sm text-th-text focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
                    style={{ border: '1px solid rgb(124,124,124)' }} value={drawerForm.gender}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, gender: e.target.value }))}>
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1.5 text-th-secondary">City</label>
                  <input className="w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover"
                    style={{ border: '1px solid rgb(124,124,124)' }} value={drawerForm.city}
                    onChange={(e) => setDrawerForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="City" />
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1.5 text-th-secondary">Address</label>
                <textarea className="w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover" rows={2}
                  style={{ border: '1px solid rgb(124,124,124)', resize: 'vertical' }} value={drawerForm.address}
                  onChange={(e) => setDrawerForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Address (optional)" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddDrawer(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-colors hover:bg-th-hover text-th-secondary border border-th-muted">Cancel</button>
                <button onClick={handleCreateCustomer} disabled={drawerSaving}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider transition-all active:scale-95"
                  style={{ backgroundColor: '#1ed760', color: '#121212' }}>
                  {drawerSaving ? (
                    <div className="animate-spin w-4 h-4 border-2 border-[#121212] border-t-transparent rounded-full" />
                  ) : (
                    <UserPlus size={15} />
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

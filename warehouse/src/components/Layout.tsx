import { useState, memo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useCartCount } from "../context/CartContext";
import {
  LayoutDashboard, Package, Users, LogOut, Menu, X, ChevronLeft, Sun, Moon, UserCog, Glasses, PackagePlus, ShoppingCart,
} from "lucide-react";

const sidebarMenu = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/lens-stock", label: "Lens Stock", icon: Glasses },
  { path: "/update-stock", label: "Update Stock", icon: PackagePlus },
  { path: "/cart", label: "Cart", icon: ShoppingCart },
  { path: "/users", label: "Users", icon: Users },
];

const mobileNav = [
  { path: "/", label: "Home", icon: LayoutDashboard },
  { path: "/lens-stock", label: "Stock", icon: Glasses },
  { path: "/cart", label: "Cart", icon: ShoppingCart },
  { path: "/users", label: "User", icon: UserCog },
];

const CartBadge = memo(function CartBadge() {
  const count = useCartCount();
  if (count <= 0) return null;
  return (
    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-primary-500 text-surface-950 text-micro font-bold leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
});

const MobileCartBadge = memo(function MobileCartBadge() {
  const count = useCartCount();
  if (count <= 0) return null;
  return (
    <span className="absolute -top-1.5 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary-500 text-surface-950 text-micro font-bold flex items-center justify-center leading-none">
      {count > 99 ? "99+" : count}
    </span>
  );
});

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();

  const isAuthPage = location.pathname === "/login";
  if (isAuthPage) return <>{children}</>;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen bg-th-base overflow-hidden">
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`${sidebarOpen ? "w-60" : "w-[72px]"} bg-th-surface border-r border-th-border flex flex-col transition-all duration-300 fixed lg:relative z-30 h-full ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-th-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-primary-500 rounded-md flex items-center justify-center flex-shrink-0">
              <Package size={16} className="text-surface-950" />
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-th-text leading-tight truncate">Lens Warehouse</h1>
                <p className="text-micro text-th-muted font-medium">KMJ Optical</p>
              </div>
            )}
          </div>
          <button onClick={() => { setSidebarOpen(false); setMobileOpen(false); }}
            className={`p-1.5 hover:bg-th-hover rounded-lg text-th-muted ${sidebarOpen ? "hidden lg:block" : "hidden"}`}>
            <ChevronLeft size={16} />
          </button>
          <button onClick={() => setSidebarOpen(true)}
            className={`p-1.5 hover:bg-th-hover rounded-lg text-th-muted ${sidebarOpen ? "hidden" : "hidden lg:block"}`}>
            <Menu size={16} />
          </button>
          <button onClick={() => setMobileOpen(false)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted lg:hidden">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2.5 space-y-0.5">
          {sidebarMenu.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-pill transition-all duration-200 group text-nav ${
                  active
                    ? "bg-th-hover text-th-text font-bold"
                    : "text-th-secondary hover:text-th-text hover:bg-th-hover"
                }`}>
                {item.path === "/cart" ? (
                  <span data-cart-icon><Icon size={18} className={active ? "text-primary-500" : "text-th-muted group-hover:text-th-secondary"} /></span>
                ) : (
                  <Icon size={18} className={active ? "text-primary-500" : "text-th-muted group-hover:text-th-secondary"} />
                )}
                {sidebarOpen && <span>{item.label}</span>}
                {item.path === "/cart" && <CartBadge />}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-2.5 border-t border-th-border space-y-0.5">
          {user && (
            <div className={`flex items-center gap-3 px-3 py-2.5 ${sidebarOpen ? "" : "justify-center"}`}>
              <div className="w-8 h-8 rounded-full bg-primary-500/15 flex items-center justify-center shrink-0">
                <span className="text-small-bold text-primary-500">{(user.name || user.username || "U").charAt(0).toUpperCase()}</span>
              </div>
              {sidebarOpen && (
                <div className="min-w-0">
                  <p className="text-small-bold text-th-text truncate">{user.name || user.username}</p>
                  <p className="text-micro text-th-muted truncate">@{user.username}</p>
                </div>
              )}
            </div>
          )}
          <button onClick={toggle}
            className="flex items-center gap-3 px-3 py-2.5 rounded-pill text-th-secondary hover:text-th-text hover:bg-th-hover w-full transition-all text-nav">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
            {sidebarOpen && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-pill text-th-secondary hover:text-negative hover:bg-negative/10 w-full transition-all text-nav">
            <LogOut size={18} />
            {sidebarOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-th-border flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10" style={{ background: "color-mix(in srgb, var(--bg-surface) 95%, var(--bg-base))" }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="p-2 hover:bg-th-hover rounded-lg lg:hidden">
              <Menu size={20} className="text-th-text" />
            </button>
            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-th-hover rounded-lg hidden lg:flex">
              <Menu size={18} className="text-th-text" />
            </button>
            <h2 className="text-body-bold text-th-text">
              {sidebarMenu.find((m) => isActive(m.path))?.label || "Lens Warehouse"}
            </h2>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-5 page-container">{children}</div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 h-16 border-t border-th-border flex items-center justify-around z-10" style={{ background: "color-mix(in srgb, var(--bg-base) 95%, var(--bg-surface))" }}>
          {mobileNav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link key={item.path} to={item.path} className="nav-link">
                <div className="nav-link-icon relative" {...(item.path === "/cart" ? { "data-cart-icon": "" } : {})}>
                  <Icon size={20} className={active ? "text-primary-500" : "text-th-muted"} />
                  {item.path === "/cart" && <MobileCartBadge />}
                </div>
                <span className={`nav-link-label ${active ? "text-primary-500" : "text-th-muted"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

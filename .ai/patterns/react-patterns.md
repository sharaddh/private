# React Patterns — KMJ Optical ERP

> Reference guide for all React/TypeScript frontend conventions used in the KMJ Optical ERP client.

---

## 1. Component Composition Patterns

**Purpose:** Build the UI from composable, reusable pieces — Layout wraps pages, pages
compose modals/tables/forms.

**When to use:** Every new page or feature in the client.

### App Shell Architecture

```
AppProviders → Layout → ErrorBoundary → Suspense → Page Component
```

### AppProviders — Context Nesting

```tsx
// client/src/context/AppProviders.tsx
export default function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ThemeProvider>
        <TranslateProvider>
          <ToastProvider>
            {children}
          </ToastProvider>
        </TranslateProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
```

### App Router with Lazy Loading

```tsx
// client/src/App.tsx
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const Orders = lazy(() => import("./pages/Orders"));

function SuspendedPage({ children, page }: { children: React.ReactNode; page: string }) {
  return <Suspense fallback={<PageSkeleton page={page} />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<SuspendedPage page="dashboard"><Dashboard /></SuspendedPage>} />
          <Route path="/customers" element={<SuspendedPage page="customers"><Customers /></SuspendedPage>} />
          <Route path="/orders" element={<SuspendedPage page="orders"><Orders /></SuspendedPage>} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}
```

### Role-Based Route Guards

```tsx
// client/src/App.tsx
<Route path="/payments" element={
  <RoleGuard path="/payments">
    <SuspendedPage page="payments"><Payments /></SuspendedPage>
  </RoleGuard>
} />
```

### RoleGuard Component

```tsx
// client/src/components/RoleGuard.tsx
const staffPrefixes = [
  "/", "/customers", "/orders", "/bills", "/pickup", "/whatsapp", "/workspace",
];

function isStaffAllowed(path: string): boolean {
  return staffPrefixes.some((p) => path === p || path.startsWith(p + "/"));
}

export default function RoleGuard({ children, path }: { children: React.ReactNode; path: string }) {
  const { isStaff, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <>{children}</>;
  if (isStaff && !isStaffAllowed(path)) return <Navigate to="/" replace />;
  return <>{children}</>;
}
```

### Anti-Pattern

```ts
// WRONG — no lazy loading, entire app loaded upfront
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
// All 25+ pages loaded on initial bundle
```

### Tradeoffs

- `React.lazy` + `Suspense` with `PageSkeleton` gives instant visual feedback during chunk
  loading.
- `ErrorBoundary` wraps all routes so a crash in one page doesn't kill the entire app.
- `RoleGuard` is applied at the route level, not inside pages — cleaner separation.

### Related Patterns

- State Management Patterns (section 2)
- Theme/Dark Mode Patterns (section 10)

---

## 2. State Management Patterns

**Purpose:** Manage authentication, theming, toasts, and translation state via React Context.

**When to use:** Global cross-cutting concerns that many components need.

### AuthContext — Full State Shape

```tsx
// client/src/context/AuthContext.tsx
interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: Record<string, unknown> | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  branches: BranchInfo[];
  currentBranchId: string | null;
  currentBranch: BranchInfo | null;
  login: (token: string, refresh: string) => void;
  logout: () => void;
  setUser: (user: Record<string, unknown>) => void;
  setCurrentBranch: (branchId: string) => void;
}
```

### AuthContext — Provider with useCallback

```tsx
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState & { currentBranchId: string | null }>(loadAuth);
  const [branches, setBranches] = useState<BranchInfo[]>([]);

  useEffect(() => {
    if (state.token) {
      api.get("/api/auth/me").then((d) => {
        if (d.success) {
          const user = d.data as Record<string, unknown>;
          setState((s) => ({ ...s, user }));
          const userBranches = (user?.branches || []) as BranchInfo[];
          setBranches(userBranches);
        } else logout();
      }).catch(() => logout());
    }
  }, [state.token]);

  const login = useCallback((token: string, refresh: string) => {
    localStorage.setItem(STORAGE_KEYS.token, token);
    localStorage.setItem(STORAGE_KEYS.refresh, refresh);
    setState({ token, refreshToken: refresh, user: null, currentBranchId: null });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.token);
    localStorage.removeItem(STORAGE_KEYS.refresh);
    localStorage.removeItem(STORAGE_KEYS.branchId);
    setState({ token: null, refreshToken: null, user: null, currentBranchId: null });
    setBranches([]);
  }, []);

  // ... more callbacks
}
```

### AuthContext — Consumer Hook

```tsx
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

### ThemeContext — Simple Toggle State

```tsx
// client/src/context/ThemeContext.tsx
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(loadTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### ToastContext — Imperative Notifications

```tsx
// client/src/context/ToastContext.tsx
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev, { message, type, id }]);
  }, []);

  const success = useCallback((message: string) => show(message, "success"), [show]);
  const error = useCallback((message: string) => show(message, "error"), [show]);

  return (
    <ToastContext.Provider value={{ show, success, error, info }}>
      {children}
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => remove(t.id)} />
      ))}
    </ToastContext.Provider>
  );
}
```

### Anti-Pattern

```tsx
// WRONG — storing server data in Context (causes unnecessary re-renders)
const DataContext = createContext<any>(null);

function DataProvider({ children }) {
  const [customers, setCustomers] = useState([]);
  // Every customer update re-renders entire tree
  return <DataContext.Provider value={{ customers, setCustomers }}>{children}</DataContext.Provider>;
}

// WRONG — no guard in consumer hook
function useAuth() {
  return useContext(AuthContext); // Returns null if no provider
}
```

### Tradeoffs

- Context is used for auth/theme/toasts — things that rarely change and are needed
  everywhere. Server data is NOT in Context — it uses `useApi` hook instead.
- `useCallback` on all context values prevents unnecessary child re-renders.
- Auth state is hydrated from `localStorage` on mount, then validated against `/api/auth/me`.

### Related Patterns

- Data Fetching Patterns (section 3)
- Toast Patterns (section 7)

---

## 3. Data Fetching Patterns

**Purpose:** Standardized hook-based data fetching with caching, loading states, and
error handling.

**When to use:** Every page that loads data from the API.

### useApi Hook — Full Implementation

```tsx
// client/src/hooks/useApi.ts
interface UseApiOptions {
  cacheKey?: string;
  enabled?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T = unknown>(
  fetcher: () => Promise<{ success: boolean; data?: T; message?: string }>,
  deps: unknown[] = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { cacheKey, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useCache<T>(cacheKey ?? null);
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);

  const fetch = useCallback(async (isBackground = false) => {
    if (!enabled) return;
    if (!isBackground) setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (!mountedRef.current) return;
      if (res.success && res.data !== undefined) {
        setData(res.data);
        if (cacheKey) cache.set(res.data);
      } else {
        setError(res.message || "Request failed");
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message || "Network error");
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    const snapshot = cacheKey ? getCacheSnapshot<T>(cacheKey) : null;
    if (snapshot?.exists && !snapshot.expired) {
      // Serve from cache, then refresh in background
      setData(snapshot.data);
      setLoading(false);
      initialLoadDone.current = true;
      fetch(true);
    } else if (snapshot?.exists && snapshot.expired) {
      // Show stale data while refreshing
      setData(snapshot.data);
      setLoading(true);
      fetch();
    } else {
      fetch();
    }
    return () => { mountedRef.current = false; };
  }, [fetch]);

  const refetch = useCallback(() => {
    if (cacheKey) cache.invalidate();
    fetch();
  }, [fetch, cacheKey, cache]);

  return { data, loading, error, refetch };
}
```

### useApiGet — Convenience Wrapper

```tsx
export function useApiGet<T = unknown>(
  path: string,
  deps: unknown[] = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  return useApi<T>(
    () => api.get(path),
    [path, ...deps],
    { cacheKey: path, ...options }
  );
}
```

### useApiPost — Mutation Hook

```tsx
export function useApiPost<T = any, B = any>(): {
  execute: (path: string, body: B) => Promise<{ success: boolean; data?: T; message?: string }>;
  loading: boolean;
  error: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (path: string, body: B) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<T>(path, body);
      if (!res.success) setError(res.message || "Request failed");
      return res;
    } catch (err) {
      const msg = (err as Error).message || "Network error";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error };
}
```

### Usage in Pages — Direct API Call Pattern

```tsx
// client/src/pages/Customers.tsx
const fetchCustomers = useCallback(async () => {
  setLoading(true);
  try {
    const res = await api.get("/api/customers?limit=1000");
    const raw = res.data as any;
    const customers = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    setList(customers);
  } catch {
    setList([]);
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
```

### Cancelable Requests

```tsx
// client/src/api.ts
export function createCancelableGet<T = any>(path: string): {
  promise: Promise<ApiResponse<T>>;
  abort: () => void;
} {
  const controller = new AbortController();
  const promise = request<T>(path, {
    headers: buildHeaders(false),
    signal: controller.signal,
  });
  return { promise, abort: () => controller.abort() };
}
```

### Anti-Pattern

```tsx
// WRONG — no loading state, user sees nothing while data loads
function Customers() {
  const [list, setList] = useState([]);
  useEffect(() => {
    api.get("/api/customers").then(res => setList(res.data));
  }, []);
  return list.map(c => <div>{c.name}</div>); // Flash of empty content
}

// WRONG — no error handling
useEffect(() => {
  api.get("/api/customers").then(res => setList(res.data));
  // What if the request fails? No catch, no error state.
}, []);
```

### Tradeoffs

- `useApi` provides stale-while-revalidate caching — serve cached data immediately, then
  refresh in background. This makes navigation instant.
- `useApi` uses a `mountedRef` to prevent state updates on unmounted components.
- `deps` array is passed as a parameter because React's `useEffect` requires stable
  references — this avoids stale closure bugs.
- Most pages still use direct `api.get` calls instead of `useApiGet` — this is fine for
  simpler pages.

### Related Patterns

- Client Cache Patterns (section 3 in performance-patterns.md)
- API Client Patterns (section 6 in api-patterns.md)

---

## 4. Form Handling Patterns

**Purpose:** Controlled components with validation, error display, and submit handlers.

**When to use:** Every form in the application (customer create/edit, settings, etc.).

### Reusable Form Components

```tsx
// client/src/components/Form.tsx
export default function Form({ onSubmit, children, title, submitLabel = "Submit", isLoading }: FormProps) {
  return (
    <div className="bg-th-surface p-6 rounded-[8px] mb-6">
      {title && <h3 className="text-[16px] font-semibold text-th-text mb-4">{title}</h3>}
      <form onSubmit={onSubmit} className="space-y-4">
        {children}
        <button type="submit" disabled={isLoading}
          className="w-full bg-[#1ed760] hover:bg-[#1ed760]/90 disabled:opacity-50 text-black font-semibold py-2.5 px-4 rounded-lg transition-all active:scale-[0.95] uppercase tracking-wider text-[14px]">
          {isLoading ? "Loading..." : submitLabel}
        </button>
      </form>
    </div>
  );
}

export function FormGroup({ label, error, children }: FormGroupProps) {
  return (
    <div>
      {label && <label className="block text-[14px] font-medium text-th-text mb-1.5">{label}</label>}
      {children}
      {error && <p className="text-red-600 text-[13px] mt-1">{error}</p>}
    </div>
  );
}

export function Input({ label, error, ...props }: InputProps) {
  return (
    <FormGroup label={label} error={error}>
      <input {...props}
        className="w-full px-4 py-2.5 rounded-lg focus:outline-none focus:border-[#1ed760] bg-th-elevated text-th-text placeholder-th-muted text-[14px]"
        style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }} />
    </FormGroup>
  );
}
```

### Controlled Form State Pattern

```tsx
// client/src/pages/Customers.tsx
const [form, setForm] = useState({
  name: "", email: "", mobile: "", alternateMobile: "",
  address: "", city: "", age: "", gender: "", tags: ""
});
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState("");

// Update individual field
onChange={(e) => setForm({ ...form, name: e.target.value })}

// Submit handler with validation
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setIsLoading(true);
  setError("");
  try {
    const payload = {
      ...form,
      age: form.age ? Number(form.age) : undefined,
      tags: form.tags.split(",").map(t => t.trim()).filter(Boolean),
    };
    const res = editing
      ? await api.put(`/api/customers/${editing._id}`, payload)
      : await api.post("/api/customers", payload);
    if (res.success) {
      invalidateCache("/api/customers?limit=1000");
      setShowForm(false);
    } else {
      setError(res.message || "Operation failed");
    }
  } catch {
    setError("An error occurred");
  } finally {
    setIsLoading(false);
  }
}
```

### Inline Modal Form Pattern

```tsx
{showForm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
       onClick={() => setShowForm(false)}>
    <div className="bg-th-surface rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
         onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
        <h3 className="text-base font-bold text-th-text">
          {editing ? "Edit Customer" : "Add Customer"}
        </h3>
        <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-th-elevated rounded-full">
          <X size={18} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2.5 rounded-lg text-sm mb-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Form fields */}
          <div className="flex justify-end gap-2 pt-3 border-t border-th-border">
            <button type="button" onClick={() => setShowForm(false)} className="...">Cancel</button>
            <button type="submit" disabled={isLoading} className="...">
              {isLoading ? "Saving..." : editing ? "Edit" : "Add Customer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
)}
```

### Anti-Pattern

```tsx
// WRONG — uncontrolled form with no validation
function CustomerForm() {
  const nameRef = useRef();
  const handleSubmit = async () => {
    await api.post("/api/customers", { name: nameRef.current.value });
  };
  return <form><input ref={nameRef} /><button onClick={handleSubmit}>Save</button></form>;
}

// WRONG — setting error state without clearing on new submit
async function handleSubmit() {
  const res = await api.post("/api/customers", form);
  if (!res.success) setError(res.message); // Previous error still shown
}
```

### Tradeoffs

- Forms use `useState` for each field (object state) rather than individual `useState` per
  field — simpler for forms with many fields.
- Error display is inline (above the form) rather than toast — appropriate for form-level
  errors.
- `e.stopPropagation()` on the form container prevents closing when clicking inside the modal.

### Related Patterns

- Modal Patterns (section 6)
- Validation Patterns (api-patterns.md)

---

## 5. Loading / Error / Empty State Patterns

**Purpose:** Consistent UX for the three states of any data-driven page.

**When to use:** Every page that loads data from the API.

### Loading State — Page Skeleton

```tsx
// client/src/pages/Customers.tsx
if (loading) return <PageSkeleton page="customers" />;
```

### Error State — Inline Banner

```tsx
{error && (
  <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2.5 rounded-lg text-sm mb-3">
    {error}
  </div>
)}
```

### Empty State — With Action

```tsx
{filteredList.length === 0 ? (
  <div className="bg-th-surface rounded-lg text-center py-16 mt-6">
    <div className="w-16 h-16 bg-th-hover rounded-full flex items-center justify-center mx-auto mb-4">
      <Users size={28} className="text-[#535353]" />
    </div>
    <h3 className="text-lg font-bold text-th-text mb-1">
      {searchQuery ? "No customers found" : "No customers yet"}
    </h3>
    <p className="text-sm text-th-secondary mb-5">
      {searchQuery ? `No results matching "${searchQuery}"` : "Start by adding your first customer."}
    </p>
    <button onClick={openCreate} className="inline-flex items-center gap-2 ...">
      <UserPlus size={16} /> Add Customer
    </button>
  </div>
) : (
  <div className="space-y-2 mt-6">
    {/* Customer list */}
  </div>
)}
```

### Table Empty State

```tsx
// client/src/components/Table.tsx
{paged.length === 0 ? (
  <tr>
    <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-16 text-center text-th-secondary">
      <div className="flex flex-col items-center gap-3">
        <Search size={28} className="text-[#535353]" />
        <span className="text-[15px]">No data available</span>
      </div>
    </td>
  </tr>
) : (
  paged.map((row, idx) => ( /* ... */ ))
)}
```

### Loading Button State

```tsx
<button disabled={isLoading} className="...">
  {isLoading ? (
    <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
  ) : (
    <UserPlus size={15} />
  )}
  {isLoading ? "Creating..." : "Create Customer"}
</button>
```

### Recalculate / Background Action State

```tsx
const [recalculating, setRecalculating] = useState(false);

<button onClick={async () => {
  setRecalculating(true);
  const res = await api.post("/api/recalculate/customer-totals", {});
  if (res.success) {
    refetch(true);
    toast.success(`Fixed ${d?.updated || 0} customer records`);
  }
  setRecalculating(false);
}} disabled={recalculating}>
  {recalculating ? "Fixing..." : "Fix Data"}
</button>
```

### Anti-Pattern

```tsx
// WRONG — no empty state, blank page when no data
return (
  <div>
    {list.map(c => <div key={c._id}>{c.name}</div>)}
    {/* If list is empty, user sees a blank page */}
  </div>
);

// WRONG — no loading indicator
const [data, setData] = useState(null);
return <div>{data ? data.name : ""}</div>; // Blank flash while loading
```

### Tradeoffs

- `PageSkeleton` provides perceived performance — users see layout structure immediately.
- Empty states differentiate between "no data yet" and "no search results" — important UX.
- Background actions (recalculate, fix data) use separate loading states from page loading.

### Related Patterns

- Toast Patterns (section 7)
- Table Patterns (section 8)

---

## 6. Modal Patterns

**Purpose:** Reusable, accessible modal with backdrop, escape-to-close, and click-outside
to dismiss.

**When to use:** Any overlay dialog (create/edit forms, detail views, confirmations).

### Reusable Modal Component

```tsx
// client/src/components/Modal.tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export default function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div ref={ref} className={`bg-th-surface rounded-[8px] w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col`}
           style={{ boxShadow: "var(--shadow-elevated)" }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-th-hover">
          <h3 className="text-[16px] font-semibold text-th-text">{title}</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-th-elevated rounded-full text-th-secondary">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}
```

### Usage — Detail View Modal

```tsx
<Modal open={showDetail} onClose={() => setShowDetail(false)} title="Customer Details" size="lg">
  {detailCustomer && (
    <div className="space-y-4">
      <div className="flex items-center gap-4 p-4 bg-th-elevated rounded-lg">
        {/* Customer avatar + name */}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {/* Stats cards */}
      </div>
      {/* Contact info, address, tags */}
    </div>
  )}
</Modal>
```

### Usage — Inline Modal (without reusable component)

```tsx
// Some pages build modals inline for more control
{showForm && (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
       onClick={() => setShowForm(false)}>
    <div className="bg-th-surface rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl"
         onClick={(e) => e.stopPropagation()}>
      {/* ... */}
    </div>
  </div>
)}
```

### Anti-Pattern

```tsx
// WRONG — no escape key handler
<div className="fixed inset-0 z-50 ...">
  <div className="bg-th-surface ...">
    {/* User can't close with Escape key */}
  </div>
</div>

// WRONG — no backdrop click handler
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="bg-th-surface ...">
    {/* User must click the X button to close */}
  </div>
</div>
```

### Tradeoffs

- The `Modal` component returns `null` when `!open` — no DOM overhead when closed.
- `backdrop-blur-sm` provides modern frosted glass effect on the overlay.
- `animate-fade-in` gives smooth appearance animation.
- Some pages (Customers) use inline modals for more control over the form layout.
- The reusable `Modal` is used for detail views and simpler forms.

### Related Patterns

- Form Handling (section 4)
- Loading/Error States (section 5)

---

## 7. Toast Notification Patterns

**Purpose:** Imperative, auto-dismissing notifications for success/error/info messages.

**When to use:** After any user action completes (create, update, delete, error).

### Toast Consumer Hook

```tsx
// Usage in any component
const toast = useToast();

// After successful action
toast.success("Customer created successfully");

// After failed action
toast.error(res.message || "Failed to create customer");

// Informational
toast.info("Data refreshed");
```

### Toast Component

```tsx
// client/src/components/Toast.tsx
interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}
```

### Toast in Customer Page

```tsx
// After recalculation
toast.success(`Fixed ${d?.updated || 0} customer records`);

// After failed recalculation
toast.error(`Recalculation failed: ${res.message || "Unknown error"}`);
```

### Anti-Pattern

```tsx
// WRONG — using alert() for notifications
alert("Customer created successfully");

// WRONG — using console.log for user feedback
console.log("Customer created");
```

### Tradeoffs

- Toasts are global via Context — any component can trigger them without prop drilling.
- Auto-dismiss (handled by Toast component) prevents notification fatigue.
- ToastProvider renders toasts as siblings to children — fixed positioning ensures they
  appear above everything.

### Related Patterns

- State Management (section 2)
- Error Handling (api-patterns.md)

---

## 8. Table Patterns with Sorting, Filtering, and Pagination

**Purpose:** Reusable data table with built-in search, column sorting, and client-side
pagination.

**When to use:** Any list view that displays tabular data.

### Table Component

```tsx
// client/src/components/Table.tsx
interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
  sortable?: boolean;
}

interface TableProps {
  columns: Column[];
  data: any[];
  actions?: (row: any) => React.ReactNode;
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  onRowClick?: (row: any) => void;
}
```

### Client-Side Search with useMemo

```tsx
const filtered = useMemo(() => {
  if (!search.trim()) return data;
  const q = search.toLowerCase();
  return data.filter((row) =>
    columns.some((col) => {
      const val = row[col.key];
      return val != null && String(val).toLowerCase().includes(q);
    })
  );
}, [data, search, columns]);
```

### Column Sorting

```tsx
const [sortKey, setSortKey] = useState<string>("");
const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

const sorted = useMemo(() => {
  if (!sortKey) return filtered;
  return [...filtered].sort((a, b) => {
    const av = a[sortKey] ?? "";
    const bv = b[sortKey] ?? "";
    const cmp = typeof av === "number"
      ? av - Number(bv)
      : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });
}, [filtered, sortKey, sortDir]);
```

### Client-Side Pagination

```tsx
const [page, setPage] = useState(0);
const totalPages = Math.ceil(sorted.length / pageSize);
const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);
```

### Pagination Controls

```tsx
{totalPages > 1 && (
  <div className="flex items-center justify-between">
    <p className="text-[14px] text-th-secondary">
      Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}
    </p>
    <div className="flex items-center gap-1">
      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
        const start = Math.max(0, Math.min(page - 2, totalPages - 5));
        const pg = start + i;
        return (
          <button key={pg} onClick={() => setPage(pg)}
            className={`w-8 h-8 rounded-full text-[14px] font-medium ${
              pg === page ? "bg-[#1ed760] text-black" : "hover:bg-th-elevated text-th-secondary"
            }`}>
            {pg + 1}
          </button>
        );
      })}
      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
        <ChevronRight size={16} />
      </button>
    </div>
  </div>
)}
```

### Custom Column Renderers

```tsx
<Table
  columns={[
    { key: "name", label: "Name" },
    { key: "mobile", label: "Mobile" },
    {
      key: "status",
      label: "Status",
      render: (val) => (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          val === "Delivered" ? "bg-green-500/20 text-green-400" :
          val === "Cancelled" ? "bg-red-500/20 text-red-400" :
          "bg-blue-500/20 text-blue-400"
        }`}>
          {val}
        </span>
      ),
    },
  ]}
  data={orders}
  actions={(row) => (
    <button onClick={() => handleDelete(row._id)} className="text-red-400 hover:text-red-300">
      <Trash2 size={14} />
    </button>
  )}
  onRowClick={(row) => navigate(`/orders/${row._id}`)}
/>
```

### Anti-Pattern

```tsx
// WRONG — no pagination, rendering thousands of rows
return (
  <table>
    <tbody>
      {data.map(row => <tr key={row._id}>...</tr>)}
    </tbody>
  </table>
);

// WRONG — re-sorting on every render
const sorted = [...data].sort((a, b) => a.name.localeCompare(b.name)); // Creates new array every render
```

### Tradeoffs

- Client-side search/sort/pagination is simpler and faster for <1000 rows.
- For larger datasets, server-side pagination (section 3 of api-patterns.md) is needed.
- `pageSize` defaults to 10 — configurable per table instance.
- Sort direction toggles on click — if already sorted by that column, flip direction.

### Related Patterns

- Search Input with Debounce (section 9)
- Data Fetching (section 3)

---

## 9. Search Input with Debounce Pattern

**Purpose:** Prevent excessive API calls while user types by debouncing the input.

**When to use:** Search inputs that trigger API requests.

### useDebounce Hook

```tsx
// client/src/hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

### Layout Search — Manual Debounce with useRef

```tsx
// client/src/components/Layout.tsx
const searchTimer = useRef<ReturnType<typeof setTimeout>>();

const handleSearch = useCallback((value: string) => {
  const trimmed = value.trim();
  setSearchQuery(value);
  setHighlightedIndex(-1);
  if (searchTimer.current) clearTimeout(searchTimer.current);

  if (!trimmed) {
    setSearchResults([]);
    setSearchOpen(false);
    return;
  }

  setSearchLoading(true);
  searchTimer.current = setTimeout(async () => {
    const res = await get<Array<Record<string, unknown>>>('/api/customers?search=' + encodeURIComponent(trimmed));
    if (res.success) {
      const list = (res.data as any)?.data || res.data || [];
      setSearchResults(Array.isArray(list) ? list : []);
      setSearchOpen(true);
    }
    setSearchLoading(false);
  }, 250);
}, []);
```

### Customer Search — Client-Side Filter (No Debounce)

```tsx
// client/src/pages/Customers.tsx — client-side filtering, no debounce needed
const filteredList = useMemo(() => {
  const q = searchQuery.trim();
  if (!q) return list;
  const lower = q.toLowerCase();
  return list.filter((c) =>
    c.name?.toLowerCase().includes(lower) || c.mobile?.includes(q) ||
    c.customerId?.toLowerCase().includes(lower) || c.email?.toLowerCase().includes(lower)
  );
}, [searchQuery, list]);
```

### Keyboard Navigation in Search Results

```tsx
const handleSearchKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
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
    }
  } else if (event.key === "Escape") {
    setSearchOpen(false);
  }
}, [/* deps */]);
```

### Anti-Pattern

```tsx
// WRONG — no debounce, fires API call on every keystroke
<input onChange={async (e) => {
  const res = await api.get(`/api/customers?search=${e.target.value}`);
  setResults(res.data);
}} />

// WRONG — debounce delay too long
const debouncedSearch = useDebounce(searchQuery, 1000); // 1 second feels sluggish
```

### Tradeoffs

- 250ms debounce is the sweet spot — fast enough to feel responsive, slow enough to
  prevent excessive API calls.
- Layout search uses `useRef` timer pattern instead of `useDebounce` hook because it
  needs to manage loading state alongside the debounce.
- Client-side search (Customers page) needs no debounce because it filters in-memory.

### Related Patterns

- API Client Patterns (api-patterns.md)
- Data Fetching (section 3)

---

## 10. Theme / Dark Mode Patterns

**Purpose:** System-wide dark/light mode toggle with CSS custom properties and localStorage
persistence.

**When to use:** Global theme switching.

### ThemeContext Provider

```tsx
// client/src/context/ThemeContext.tsx
function loadTheme(): boolean {
  const stored = localStorage.getItem("theme");
  if (stored === "light") return false;
  return true; // Default to dark
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(loadTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  const toggle = useCallback(() => setDark((d) => !d), []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

### CSS Custom Properties Convention

All components use `th-*` CSS classes for theme-aware colors:

```tsx
// Theme tokens used throughout the UI
className="bg-th-base"        // Page background
className="bg-th-surface"     // Card/surface background
className="bg-th-elevated"    // Elevated element background
className="bg-th-hover"       // Hover state background
className="text-th-text"      // Primary text
className="text-th-secondary" // Secondary text
className="text-th-muted"     // Muted/placeholder text
className="border-th-border"  // Default border
className="border-th-hover"   // Hover border
```

### Brand Color (Theme-Independent)

```tsx
// Primary brand color — always green regardless of theme
className="bg-[#1ed760] text-black"  // Buttons
className="text-[#1ed760]"           // Highlights
className="focus:ring-[#1ed760]"     // Focus states
```

### Anti-Pattern

```tsx
// WRONG — hardcoded light/dark colors instead of theme tokens
className="bg-white text-black"  // Doesn't work in dark mode
className="bg-gray-900 text-gray-100"  // Doesn't work in light mode

// WRONG — no localStorage persistence
const [dark, setDark] = useState(true); // Resets on every page load
```

### Tradeoffs

- Default to dark mode — optical shop environments are often dimly lit.
- `th-*` tokens are Tailwind CSS custom properties — switching theme is instant with no
  flash of unstyled content.
- Brand color `#1ed760` (green) is consistent across both themes.
- Theme toggle is not shown in the UI by default — it's managed via the context.

### Related Patterns

- Auth Context (section 2)
- Layout Patterns (section 1)

---

## 11. Client-Side Caching Patterns

**Purpose:** In-memory cache with TTL to avoid re-fetching data that hasn't changed.

**When to use:** Data that is fetched multiple times across component lifecycles.

### Cache Store

```tsx
// client/src/hooks/useCache.ts
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
const store = new Map<string, CacheEntry<unknown>>();

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now(), promise: null });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function useCache<T>(key: string | null) {
  const [, forceRender] = useState(0);

  const get = useCallback((): T | null => {
    if (!key) return null;
    const entry = store.get(key);
    if (!entry || isExpired(entry)) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  }, []);

  const set = useCallback((data: T) => {
    if (!key) return;
    setCache(key, data);
    forceRender((n) => n + 1);
  }, [key]);

  const invalidate = useCallback(() => {
    if (!key) return;
    invalidateCache(key);
    forceRender((n) => n + 1);
  }, [key]);

  return { get, set, invalidate };
}
```

### Integration with useApi

```tsx
// useApi checks cache before fetching
const snapshot = cacheKey ? getCacheSnapshot<T>(cacheKey) : null;
if (snapshot?.exists && !snapshot.expired) {
  setData(snapshot.data);
  setLoading(false);
  fetch(true); // Background refresh
} else {
  fetch(); // Full loading
}
```

### Manual Cache Invalidation

```tsx
// After mutations, invalidate related cache keys
const refetch = useCallback((invalidate?: boolean) => {
  if (invalidate) invalidateCache("/api/customers?limit=1000");
  fetchCustomers();
}, [fetchCustomers]);

// After create/edit/delete
invalidateCache("/api/customers?limit=1000");
```

### Deduplication of In-Flight Requests

```tsx
// client/src/hooks/useCache.ts
export function getCachedPromise<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = store.get(key);
  if (existing?.promise) return existing.promise; // Return existing in-flight promise
  if (existing && !isExpired(existing)) return Promise.resolve(existing.data);

  const promise = fetcher().then((data) => {
    store.set(key, { data, timestamp: Date.now(), promise: null });
    return data;
  });

  store.set(key, { data: null, timestamp: 0, promise });
  return promise;
}
```

### Anti-Pattern

```tsx
// WRONG — no caching, refetches on every mount
useEffect(() => {
  api.get("/api/customers").then(res => setList(res.data));
}, []); // Runs on every mount, even when navigating back

// WRONG — cache without TTL, stale data forever
const store = new Map<string, any>(); // No expiration
```

### Tradeoffs

- 5-minute TTL is generous for an ERP — data doesn't change that fast in an optical shop.
- `forceRender` ensures components re-render when cache is set/invalidated.
- Cache is a simple `Map` — no persistence across page reloads (by design, since auth
  tokens also expire).
- `getCachedPromise` prevents duplicate in-flight requests — important when multiple
  components mount simultaneously.

### Related Patterns

- useApi Hook (section 3)
- Server-Side Cache (performance-patterns.md)

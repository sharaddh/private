# 08 - Frontend

## Purpose

This document defines the frontend architecture, patterns, and conventions for the KMJ Optical ERP React client. Every frontend change must follow these guidelines.

## Architecture Overview

### Client Stack

- **Framework**: React 18.2
- **Language**: TypeScript
- **Build Tool**: Vite 4.5
- **Routing**: React Router 6
- **Styling**: Tailwind CSS 3
- **Charts**: Recharts
- **PDF**: jsPDF
- **QR**: html5-qrcode
- **Animations**: Framer Motion

### Application Structure

```
App
├── AppProviders (Context providers)
│   ├── AuthProvider
│   ├── ThemeProvider
│   ├── ToastProvider
│   └── TranslateProvider
│       └── BrowserRouter
│           └── Layout (Sidebar + Header)
│               ├── Routes
│               │   ├── Dashboard
│               │   ├── Customers
│               │   ├── CustomerDetail
│               │   ├── Orders
│               │   ├── Bills
│               │   ├── Payments
│               │   ├── Inventory
│               │   ├── Delivery
│               │   ├── Pickup
│               │   ├── Reports
│               │   ├── Settings
│               │   ├── WhatsApp
│               │   └── Workspace
│               └── ErrorBoundary
```

## Component Standards

### Component File Structure

```typescript
import React, { useState, useEffect } from 'react';

interface Props {
  title: string;
  onClose: () => void;
}

export default function Modal({ title, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ×
          </button>
        </div>
        <div className="p-4">
          {/* Content */}
        </div>
      </div>
    </div>
  );
}
```

### Component Rules

1. **Always use functional components** with hooks
2. **Always use TypeScript** for props and state
3. **Always use default exports** for components
4. **Always use named interfaces** for props (e.g., `Props`)
5. **Always destructure props** in function parameters
6. **Never use class components** (except ErrorBoundary)
7. **Never use inline styles** - use Tailwind classes
8. **Always handle loading states**
9. **Always handle error states**
10. **Always handle empty states**

### Component Organization

**Shared Components** (`components/`):
- Used across multiple pages
- Generic, reusable UI elements
- Examples: `Modal.tsx`, `Table.tsx`, `Toast.tsx`

**Page Components** (`pages/`):
- Specific to a single page
- Compose shared components
- Examples: `Dashboard.tsx`, `Customers.tsx`

**Sub-components** (`pages/*/`):
- Components specific to a page
- Not used elsewhere
- Examples: `CustomerNewVisit/` directory

## State Management Standards

### Local State

**Use `useState`** for component-local state:

```typescript
const [customers, setCustomers] = useState<Customer[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

**Rules**:
- Keep state as close to where it's used as possible
- Don't lift state up unnecessarily
- Use `useState` for simple state
- Use `useReducer` for complex state

### Global State

**Use React Context** for global state:

```typescript
// AuthContext.tsx
interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));

  // ... implementation

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

**Rules**:
- Use Context for global state (auth, theme, translations)
- Don't put frequently changing state in Context
- Don't put complex state in Context
- Always provide a custom hook for consuming Context

### State Lifting

**Lift state up** when:
- Multiple components need the same data
- Child components need to communicate through parent
- State needs to persist across route changes

**Don't lift state up** when:
- Only one component needs the data
- State is UI-specific (modals, forms)
- State is temporary (loading, errors)

## Hook Standards

### Custom Hook File Structure

```typescript
import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface UseCustomersResult {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useCustomers(): UseCustomersResult {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/customers');
      if (response.success) {
        setCustomers(response.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  return { customers, loading, error, refetch: fetchCustomers };
}
```

### Hook Rules

1. **Always use `use` prefix** for custom hooks
2. **Always return consistent types** (data, loading, error, refetch)
3. **Always handle loading and error states**
4. **Always use `useCallback`** for functions in dependencies
5. **Always clean up side effects** in `useEffect` return
6. **Never call hooks conditionally**
7. **Never call hooks in loops**
8. **Always document hook purpose** in comments

## API Integration Standards

### API Client

```typescript
// api.ts
const API_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
      ...options?.headers
    }
  });

  if (response.status === 401) {
    // Try refresh token
    const refreshed = await refreshToken();
    if (refreshed) {
      return request<T>(endpoint, options);
    }
    window.location.href = '/#/login';
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),
  post: <T>(endpoint: string, data: any) => request<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: any) => request<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  del: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' })
};
```

### API Rules

1. **Always use the centralized API client**
2. **Always handle 401 errors** (token refresh or redirect)
3. **Always handle loading states**
4. **Always handle error states**
5. **Always send branch ID header** for branch-scoped requests
6. **Never hardcode API URLs**
7. **Never expose sensitive data** in logs

### Data Fetching Pattern

```typescript
// GOOD: Consistent data fetching pattern
function CustomerList() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await api.get('/api/customers');
        if (response.success) {
          setCustomers(response.data);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (customers.length === 0) return <EmptyState />;

  return (
    <div>
      {customers.map(customer => (
        <CustomerCard key={customer._id} customer={customer} />
      ))}
    </div>
  );
}
```

## Routing Standards

### Route Definitions

```typescript
// App.tsx
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
// ... other imports

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/staff-login" element={<StaffLogin />} />
      
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
      <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/bills" element={<ProtectedRoute><Bills /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
      <Route path="/delivery" element={<ProtectedRoute><Delivery /></ProtectedRoute>} />
      <Route path="/pickup" element={<ProtectedRoute><Pickup /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
      <Route path="/workspace" element={<ProtectedRoute><Workspace /></ProtectedRoute>} />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}
```

### Routing Rules

1. **Always use hash routing** (`/#/path`) for SPA compatibility
2. **Always wrap protected routes** with `ProtectedRoute`
3. **Always use `Navigate`** for redirects
4. **Always use `*` catch-all** for 404 pages
5. **Never nest routes unnecessarily**
6. **Always use consistent URL patterns**

## Form Standards

### Form Component Structure

```typescript
interface CustomerFormProps {
  initialData?: Partial<Customer>;
  onSubmit: (data: CustomerInput) => Promise<void>;
  onCancel: () => void;
}

export default function CustomerForm({ initialData, onSubmit, onCancel }: CustomerFormProps) {
  const [formData, setFormData] = useState<CustomerInput>({
    name: '',
    mobile: '',
    ...initialData
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.mobile.trim()) newErrors.mobile = 'Mobile is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Mobile</label>
          <input
            type="tel"
            value={formData.mobile}
            onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 ${errors.mobile ? 'border-red-500' : ''}`}
          />
          {errors.mobile && <p className="mt-1 text-sm text-red-500">{errors.mobile}</p>}
        </div>
      </div>

      <div className="mt-6 flex justify-end space-x-3">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
          Cancel
        </button>
        <button type="submit" disabled={loading} className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
          {loading ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  );
}
```

### Form Rules

1. **Always validate inputs** before submission
2. **Always show loading state** during submission
3. **Always show validation errors** inline
4. **Always handle submission errors** gracefully
5. **Always reset form** after successful submission
6. **Never submit on Enter** unless it's a single-field form
7. **Always use controlled components** for form inputs
8. **Always debounce search inputs**

## Styling Standards

### Tailwind Usage

**Always use Tailwind utility classes** for styling:

```typescript
// BAD
<div style={{ padding: '16px', backgroundColor: 'white' }}>

// GOOD
<div className="p-4 bg-white">
```

**Always use consistent spacing**:
- `p-1` / `m-1` = 4px
- `p-2` / `m-2` = 8px
- `p-3` / `m-3` = 12px
- `p-4` / `m-4` = 16px
- `p-6` / `m-6` = 24px
- `p-8` / `m-8` = 32px

**Always use consistent colors**:
- Primary: `indigo-*`
- Success: `green-*`
- Warning: `yellow-*`
- Error: `red-*`
- Gray: `gray-*`

### Responsive Design

**Always use responsive classes**:

```typescript
// Mobile-first approach
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-lg md:text-xl lg:text-2xl">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
```

### Dark Mode

**Always support dark mode**:

```typescript
<div className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
```

## Loading States

### Loading Spinner

```typescript
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
    </div>
  );
}
```

### Skeleton Loading

```typescript
function CustomerSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
}
```

## Error States

### Error Message

```typescript
function ErrorMessage({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-md p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">{message}</h3>
          {onRetry && (
            <button onClick={onRetry} className="mt-2 text-sm text-red-600 hover:text-red-500">
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### Empty State

```typescript
function EmptyState({ title, message, action }: { title: string; message: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="text-center py-12">
      <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
      </svg>
      <h3 className="mt-2 text-sm font-medium text-gray-900">{title}</h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {action && (
        <div className="mt-6">
          <button onClick={action.onClick} className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700">
            {action.label}
          </button>
        </div>
      )}
    </div>
  );
}
```

## Performance Standards

### Memoization

**Use `React.memo`** for expensive components:

```typescript
const CustomerCard = React.memo(function CustomerCard({ customer }: { customer: Customer }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-medium">{customer.name}</h3>
      <p className="text-gray-500">{customer.mobile}</p>
    </div>
  );
});
```

**Use `useMemo`** for expensive computations:

```typescript
const filteredCustomers = useMemo(() => {
  return customers.filter(customer => 
    customer.name.toLowerCase().includes(search.toLowerCase())
  );
}, [customers, search]);
```

**Use `useCallback`** for functions in dependencies:

```typescript
const handleDelete = useCallback(async (id: string) => {
  await api.del(`/api/customers/${id}`);
  setCustomers(customers.filter(c => c._id !== id));
}, [customers]);
```

### Lazy Loading

**Use `React.lazy`** for route components:

```typescript
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Customers = React.lazy(() => import('./pages/Customers'));

// In Routes
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/" element={<Dashboard />} />
    <Route path="/customers" element={<Customers />} />
  </Routes>
</Suspense>
```

## Accessibility Standards

### ARIA Labels

**Always add ARIA labels** for interactive elements:

```typescript
<button aria-label="Close modal" onClick={onClose}>
  ×
</button>

<input aria-label="Search customers" type="text" />
```

### Keyboard Navigation

**Always support keyboard navigation**:

```typescript
<div onKeyDown={(e) => {
  if (e.key === 'Enter') handleSubmit();
  if (e.key === 'Escape') onClose();
}}>
```

### Color Contrast

**Always ensure sufficient color contrast**:
- Normal text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

## Cross-References

- **React patterns**: See `patterns/react-patterns.md`
- **Component templates**: See `templates/component.md`
- **UI design system**: See `docs/34-ui-design-system.md`
- **Accessibility**: See `docs/35-accessibility.md`
- **Performance**: See `docs/21-performance.md`

## AI Instructions

When working on frontend code:
1. Follow these standards exactly
2. Always use functional components
3. Always use TypeScript
4. Always handle loading/error/empty states
5. Always support responsive design
6. Always support dark mode
7. Always use Tailwind classes
8. Never use inline styles
9. Never use class components (except ErrorBoundary)
10. Always run linting after changes

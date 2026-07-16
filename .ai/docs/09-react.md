# 09 - React

## Purpose

This document defines React-specific patterns, conventions, and best practices for the KMJ Optical ERP frontend. It covers component architecture, hooks, context, and performance optimization.

## Component Architecture

### Component Types

#### 1. Page Components

**Location**: `client/src/pages/`

**Purpose**: Represent a full page in the application

**Characteristics**:
- Composed of multiple sub-components
- Handle route-level data fetching
- Manage page-level state
- Include layout wrappers

**Example**:
```typescript
export default function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchCustomers();
  }, [page, search]);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/api/customers?page=${page}&search=${search}`);
      if (response.success) setCustomers(response.data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Customers" action={{ label: 'Add Customer', onClick: () => setShowForm(true) }} />
      <SearchInput value={search} onChange={setSearch} placeholder="Search customers..." />
      {loading ? <CustomerSkeleton /> : <CustomerList customers={customers} />}
      <Pagination page={page} onChange={setPage} />
    </div>
  );
}
```

#### 2. Shared Components

**Location**: `client/src/components/`

**Purpose**: Reusable UI elements used across multiple pages

**Characteristics**:
- Generic, not tied to specific business logic
- Accept props for configuration
- Pure presentational when possible
- Well-documented props interface

**Example**:
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />
      <div className={`relative bg-white rounded-lg shadow-xl ${sizeClasses[size]}`}>
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">×</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
```

#### 3. Sub-Components

**Location**: `client/src/pages/*/` or `client/src/components/*/`

**Purpose**: Components specific to a single page or feature

**Characteristics**:
- Tightly coupled to parent component
- Not used elsewhere
- Can access parent state directly

**Example**:
```typescript
// client/src/pages/CustomerNewVisit/CustomerNewVisit.tsx
// Contains sub-components like PrescriptionForm, OrderForm, etc.
```

### Component Composition

**Always compose components** instead of creating monolithic components:

```typescript
// BAD: Monolithic component
function CustomerDetail() {
  return (
    <div>
      {/* 500 lines of JSX */}
    </div>
  );
}

// GOOD: Composed components
function CustomerDetail() {
  return (
    <div className="space-y-6">
      <CustomerHeader customer={customer} />
      <CustomerTabs>
        <CustomerVisits customer={customer} />
        <CustomerPrescriptions customer={customer} />
        <CustomerOrders customer={customer} />
        <CustomerBills customer={customer} />
      </CustomerTabs>
    </div>
  );
}
```

## Hooks Standards

### Built-in Hooks

#### useState

```typescript
// GOOD: Destructured state
const [customers, setCustomers] = useState<Customer[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// GOOD: Functional updates
setCustomers(prev => [...prev, newCustomer]);
setLoading(prev => !prev);

// BAD: State based on previous state without functional update
setCount(count + 1); // May cause issues in concurrent mode
setCount(prev => prev + 1); // Correct
```

#### useEffect

```typescript
// GOOD: Cleanup function
useEffect(() => {
  const controller = new AbortController();
  
  fetch('/api/customers', { signal: controller.signal })
    .then(res => res.json())
    .then(data => setCustomers(data));
  
  return () => controller.abort();
}, []);

// GOOD: Dependency array
useEffect(() => {
  fetchCustomers();
}, [page, search]); // Only re-run when page or search changes

// BAD: Missing dependency
useEffect(() => {
  fetchCustomers();
}, []); // Missing page and search dependencies
```

#### useCallback

```typescript
// GOOD: Memoized callback
const handleSubmit = useCallback(async (data: CustomerInput) => {
  await api.post('/api/customers', data);
  refetch();
}, [refetch]);

// BAD: Unnecessary memoization
const handleClick = useCallback(() => {
  console.log('clicked');
}, []); // This function doesn't depend on anything
```

#### useMemo

```typescript
// GOOD: Expensive computation
const filteredCustomers = useMemo(() => {
  return customers.filter(customer => 
    customer.name.toLowerCase().includes(search.toLowerCase())
  );
}, [customers, search]);

// BAD: Simple computation
const fullName = useMemo(() => `${firstName} ${lastName}`, [firstName, lastName]); // Unnecessary
```

### Custom Hooks

#### Data Fetching Hook

```typescript
interface UseApiOptions<T> {
  url: string;
  initialData?: T;
  immediate?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApi<T>({ url, initialData = null, immediate = true }: UseApiOptions<T>): UseApiResult<T> {
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(url);
      if (response.success) {
        setData(response.data);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [fetchData, immediate]);

  return { data, loading, error, refetch: fetchData };
}
```

#### Debounce Hook

```typescript
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage
const [search, setSearch] = useState('');
const debouncedSearch = useDebounce(search, 300);

useEffect(() => {
  fetchCustomers(debouncedSearch);
}, [debouncedSearch]);
```

#### Local Storage Hook

```typescript
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}
```

## Context Standards

### Context File Structure

```typescript
// AuthContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../api';

interface User {
  _id: string;
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => 
    localStorage.getItem('accessToken')
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get('/api/auth/me');
        if (response.success) {
          setUser(response.data);
        } else {
          localStorage.removeItem('accessToken');
          setToken(null);
        }
      } catch {
        localStorage.removeItem('accessToken');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const login = async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    if (response.success) {
      localStorage.setItem('accessToken', response.data.accessToken);
      localStorage.setItem('refreshToken', response.data.refreshToken);
      setToken(response.data.accessToken);
      setUser(response.data.user);
    } else {
      throw new Error(response.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### Context Rules

1. **Always create a custom hook** for consuming context
2. **Always throw an error** if hook is used outside provider
3. **Always split contexts** for different concerns (auth, theme, etc.)
4. **Never put frequently changing state** in context
5. **Always provide default values** or use undefined check

## Performance Optimization

### React.memo

**Use for components that re-render frequently with same props**:

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

### useMemo

**Use for expensive computations**:

```typescript
const expensiveResult = useMemo(() => {
  return data.reduce((acc, item) => {
    // Complex computation
    return acc;
  }, initialValue);
}, [data]);
```

### useCallback

**Use for functions passed as props or in dependencies**:

```typescript
const handleDelete = useCallback(async (id: string) => {
  await api.del(`/api/customers/${id}`);
  refetch();
}, [refetch]);

// Pass to child component
<CustomerList onDelete={handleDelete} />
```

### Lazy Loading

**Use for route components**:

```typescript
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Customers = React.lazy(() => import('./pages/Customers'));

function App() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
      </Routes>
    </Suspense>
  );
}
```

### Virtualization

**Use for long lists**:

```typescript
import { FixedSizeList } from 'react-window';

function CustomerList({ customers }: { customers: Customer[] }) {
  return (
    <FixedSizeList
      height={600}
      itemCount={customers.length}
      itemSize={100}
      width="100%"
    >
      {({ index, style }) => (
        <div style={style}>
          <CustomerCard customer={customers[index]} />
        </div>
      )}
    </FixedSizeList>
  );
}
```

## Error Handling

### Error Boundary

```typescript
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <h2 className="text-lg font-semibold text-red-800">Something went wrong</h2>
          <p className="text-red-600">{this.state.error?.message}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Error Handling Rules

1. **Always wrap page components** with ErrorBoundary
2. **Always handle async errors** with try/catch
3. **Always show user-friendly error messages**
4. **Always provide retry mechanisms**
5. **Never expose internal errors** to users

## Testing

### Component Testing

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CustomerList from './CustomerList';

describe('CustomerList', () => {
  it('renders customers correctly', async () => {
    const customers = [
      { _id: '1', name: 'John', mobile: '1234567890' },
      { _id: '2', name: 'Jane', mobile: '0987654321' }
    ];

    render(
      <MemoryRouter>
        <CustomerList customers={customers} />
      </MemoryRouter>
    );

    expect(screen.getByText('John')).toBeInTheDocument();
    expect(screen.getByText('Jane')).toBeInTheDocument();
  });

  it('handles empty state', () => {
    render(
      <MemoryRouter>
        <CustomerList customers={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText('No customers found')).toBeInTheDocument();
  });
});
```

### Hook Testing

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useCustomers } from './useCustomers';

describe('useCustomers', () => {
  it('fetches customers successfully', async () => {
    const { result } = renderHook(() => useCustomers());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.customers).toBeDefined();
    expect(result.current.error).toBeNull();
  });
});
```

## Cross-References

- **React patterns**: See `patterns/react-patterns.md`
- **Component templates**: See `templates/component.md`
- **Frontend architecture**: See `docs/08-frontend.md`
- **Performance**: See `docs/21-performance.md`
- **Testing**: See `docs/23-testing.md`

## AI Instructions

When working on React code:
1. Always use functional components with hooks
2. Always use TypeScript for props and state
3. Always handle loading, error, and empty states
4. Always use React.memo for expensive components
5. Always use useCallback for functions in dependencies
6. Always use useMemo for expensive computations
7. Always use lazy loading for route components
8. Never use class components (except ErrorBoundary)
9. Never put business logic in components
10. Always run linting after changes

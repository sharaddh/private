import { lazy, Suspense, useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/errors/ErrorBoundary';
import PageSkeleton from './components/PageSkeleton';
import RoleGuard from './components/RoleGuard';

type ComponentType<T> = React.ComponentType<T>;

const routeLoaders: Record<string, () => Promise<unknown>> = {};

function lazyPage<T>(name: string, loader: () => Promise<{ default: ComponentType<T> }>) {
  routeLoaders[name] = loader;
  return lazy(loader);
}

const Dashboard = lazyPage('Dashboard', () => import('./pages/Dashboard'));
const Customers = lazyPage('Customers', () => import('./pages/Customers'));
const CustomerDetail = lazyPage('CustomerDetail', () => import('./pages/CustomerDetail'));
const Orders = lazyPage('Orders', () => import('./pages/Orders'));
const Bills = lazyPage('Bills', () => import('./pages/Bills'));
const Payments = lazyPage('Payments', () => import('./pages/Payments'));
const CollectPayment = lazyPage('CollectPayment', () => import('./pages/CollectPayment'));
const InventoryPage = lazyPage('InventoryPage', () => import('./pages/InventoryPage'));
const InventoryV2 = lazyPage('InventoryV2', () => import('./pages/InventoryV2'));
const Delivery = lazyPage('Delivery', () => import('./pages/Delivery'));
const Pickup = lazyPage('Pickup', () => import('./pages/Pickup'));
const Announcement = lazyPage('Announcement', () => import('./pages/Announcement'));
const Reports = lazyPage('Reports', () => import('./pages/Reports'));
const Settings = lazyPage('Settings', () => import('./pages/Settings'));
const WhatsAppPage = lazyPage('WhatsApp', () => import('./pages/WhatsApp'));
const Cameras = lazyPage('Cameras', () => import('./pages/Cameras'));
const Workspace = lazyPage('Workspace', () => import('./pages/Workspace'));
const NewVisit = lazyPage('NewVisit', () => import('./pages/NewVisit'));
const CustomerNewVisit = lazyPage('CustomerNewVisit', () => import('./pages/CustomerNewVisit'));
const ItemScan = lazyPage('ItemScan', () => import('./pages/ItemScan'));
const Withdraw = lazyPage('Withdraw', () => import('./pages/Withdraw'));
const WithdrawHistory = lazyPage('WithdrawHistory', () => import('./pages/WithdrawHistory'));
const Login = lazyPage('Login', () => import('./pages/Login'));
const StaffLogin = lazyPage('StaffLogin', () => import('./pages/StaffLogin'));
const NotFound = lazyPage('NotFound', () => import('./pages/NotFound'));

function SuspendedPage({ children, page }: { children: React.ReactNode; page: string }) {
  return (
    <Suspense fallback={<PageSkeleton page={page} />}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </Suspense>
  );
}

export default function App() {
  const prefetched = useRef(false);

  useEffect(() => {
    if (prefetched.current) return;
    prefetched.current = true;
    const timer = setTimeout(() => {
      Object.values(routeLoaders).forEach((load) => {
        load().catch(() => {
          /* prefetch failure is non-fatal */
        });
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route
            path="/"
            element={
              <SuspendedPage page="dashboard">
                <Dashboard />
              </SuspendedPage>
            }
          />
          <Route
            path="/customers"
            element={
              <SuspendedPage page="customers">
                <Customers />
              </SuspendedPage>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <SuspendedPage page="customerdetail">
                <CustomerDetail />
              </SuspendedPage>
            }
          />
          <Route
            path="/customers/:id/create-visit"
            element={
              <SuspendedPage page="customerdetail">
                <CustomerNewVisit />
              </SuspendedPage>
            }
          />
          <Route
            path="/customers/:id/new-visit"
            element={
              <SuspendedPage page="newvisit">
                <NewVisit />
              </SuspendedPage>
            }
          />
          <Route path="/visits" element={<Navigate to="/customers" replace />} />
          <Route path="/prescriptions" element={<Navigate to="/customers" replace />} />
          <Route
            path="/orders"
            element={
              <SuspendedPage page="orders">
                <Orders />
              </SuspendedPage>
            }
          />
          <Route
            path="/bills"
            element={
              <SuspendedPage page="bills">
                <Bills />
              </SuspendedPage>
            }
          />
          <Route
            path="/collect"
            element={
              <SuspendedPage page="bills">
                <CollectPayment />
              </SuspendedPage>
            }
          />
          <Route
            path="/payments"
            element={
              <RoleGuard path="/payments">
                <SuspendedPage page="payments">
                  <Payments />
                </SuspendedPage>
              </RoleGuard>
            }
          />
          <Route
            path="/inventory"
            element={
              <RoleGuard path="/inventory">
                <SuspendedPage page="inventory">
                  <InventoryPage />
                </SuspendedPage>
              </RoleGuard>
            }
          />
          <Route
            path="/inventory/scan/:code"
            element={
              <SuspendedPage page="inventory">
                <ItemScan />
              </SuspendedPage>
            }
          />
          <Route
            path="/inventory/withdraw"
            element={
              <SuspendedPage page="inventory">
                <Withdraw />
              </SuspendedPage>
            }
          />
          <Route
            path="/inventory/withdraw/history"
            element={
              <SuspendedPage page="inventory">
                <WithdrawHistory />
              </SuspendedPage>
            }
          />
          <Route
            path="/inventory-v2"
            element={
              <RoleGuard path="/inventory-v2">
                <SuspendedPage page="inventory-v2">
                  <InventoryV2 />
                </SuspendedPage>
              </RoleGuard>
            }
          />
          <Route
            path="/delivery"
            element={
              <RoleGuard path="/delivery">
                <SuspendedPage page="delivery">
                  <Delivery />
                </SuspendedPage>
              </RoleGuard>
            }
          />
          <Route
            path="/pickup"
            element={
              <SuspendedPage page="pickup">
                <Pickup />
              </SuspendedPage>
            }
          />
          <Route
            path="/announcements"
            element={
              <RoleGuard path="/announcements">
                <SuspendedPage page="announcement">
                  <Announcement />
                </SuspendedPage>
              </RoleGuard>
            }
          />
          <Route
            path="/workspace"
            element={
              <SuspendedPage page="workspace">
                <Workspace />
              </SuspendedPage>
            }
          />
          <Route
            path="/reports"
            element={
              <RoleGuard path="/reports">
                <SuspendedPage page="reports">
                  <Reports />
                </SuspendedPage>
              </RoleGuard>
            }
          />
          <Route
            path="/settings"
            element={
              <SuspendedPage page="settings">
                <Settings />
              </SuspendedPage>
            }
          />
          <Route
            path="/whatsapp"
            element={
              <SuspendedPage page="settings">
                <WhatsAppPage />
              </SuspendedPage>
            }
          />
          <Route
            path="/cameras"
            element={
              <SuspendedPage page="cameras">
                <Cameras />
              </SuspendedPage>
            }
          />
          <Route
            path="/login"
            element={
              <SuspendedPage page="login">
                <Login />
              </SuspendedPage>
            }
          />
          <Route
            path="/staff-login"
            element={
              <SuspendedPage page="login">
                <StaffLogin />
              </SuspendedPage>
            }
          />
          <Route
            path="*"
            element={
              <SuspendedPage page="dashboard">
                <NotFound />
              </SuspendedPage>
            }
          />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

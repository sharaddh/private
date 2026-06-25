import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ErrorBoundary from "./components/errors/ErrorBoundary";
import PageSkeleton from "./components/PageSkeleton";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() => import("./pages/CustomerDetail"));
const Orders = lazy(() => import("./pages/Orders"));
const Bills = lazy(() => import("./pages/Bills"));
const Payments = lazy(() => import("./pages/Payments"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const Delivery = lazy(() => import("./pages/Delivery"));
const Pickup = lazy(() => import("./pages/Pickup"));
const Announcement = lazy(() => import("./pages/Announcement"));
const Reports = lazy(() => import("./pages/Reports"));
const Settings = lazy(() => import("./pages/Settings"));
const WhatsAppPage = lazy(() => import("./pages/WhatsApp"));
const Workspace = lazy(() => import("./pages/Workspace"));
const NewVisit = lazy(() => import("./pages/NewVisit"));
const ItemScan = lazy(() => import("./pages/ItemScan"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

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
          <Route path="/customers/:id" element={<SuspendedPage page="customerdetail"><CustomerDetail /></SuspendedPage>} />
          <Route path="/customers/:id/new-visit" element={<SuspendedPage page="newvisit"><NewVisit /></SuspendedPage>} />
          <Route path="/visits" element={<Navigate to="/customers" replace />} />
          <Route path="/prescriptions" element={<Navigate to="/customers" replace />} />
          <Route path="/orders" element={<SuspendedPage page="orders"><Orders /></SuspendedPage>} />
          <Route path="/bills" element={<SuspendedPage page="bills"><Bills /></SuspendedPage>} />
          <Route path="/payments" element={<SuspendedPage page="payments"><Payments /></SuspendedPage>} />
          <Route path="/inventory" element={<SuspendedPage page="inventory"><InventoryPage /></SuspendedPage>} />
          <Route path="/delivery" element={<SuspendedPage page="delivery"><Delivery /></SuspendedPage>} />
          <Route path="/pickup" element={<SuspendedPage page="pickup"><Pickup /></SuspendedPage>} />
          <Route path="/announcements" element={<SuspendedPage page="announcement"><Announcement /></SuspendedPage>} />
          <Route path="/workspace" element={<SuspendedPage page="workspace"><Workspace /></SuspendedPage>} />
          <Route path="/reports" element={<SuspendedPage page="reports"><Reports /></SuspendedPage>} />
          <Route path="/settings" element={<SuspendedPage page="settings"><Settings /></SuspendedPage>} />
          <Route path="/whatsapp" element={<SuspendedPage page="settings"><WhatsAppPage /></SuspendedPage>} />
          <Route path="/login" element={<SuspendedPage page="login"><Login /></SuspendedPage>} />
          <Route path="/register" element={<SuspendedPage page="register"><Register /></SuspendedPage>} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

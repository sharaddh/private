import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import PageLoader from "./components/errors/PageLoader";
import ErrorBoundary from "./components/errors/ErrorBoundary";

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
const Workspace = lazy(() => import("./pages/Workspace"));
const NewVisit = lazy(() => import("./pages/NewVisit"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));

function SuspendedPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Layout>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<SuspendedPage><Dashboard /></SuspendedPage>} />
          <Route path="/customers" element={<SuspendedPage><Customers /></SuspendedPage>} />
          <Route path="/customers/:id" element={<SuspendedPage><CustomerDetail /></SuspendedPage>} />
          <Route path="/customers/:id/new-visit" element={<SuspendedPage><NewVisit /></SuspendedPage>} />
          <Route path="/visits" element={<Navigate to="/customers" replace />} />
          <Route path="/prescriptions" element={<Navigate to="/customers" replace />} />
          <Route path="/orders" element={<SuspendedPage><Orders /></SuspendedPage>} />
          <Route path="/bills" element={<SuspendedPage><Bills /></SuspendedPage>} />
          <Route path="/payments" element={<SuspendedPage><Payments /></SuspendedPage>} />
          <Route path="/inventory" element={<SuspendedPage><InventoryPage /></SuspendedPage>} />
          <Route path="/delivery" element={<SuspendedPage><Delivery /></SuspendedPage>} />
          <Route path="/pickup" element={<SuspendedPage><Pickup /></SuspendedPage>} />
          <Route path="/announcements" element={<SuspendedPage><Announcement /></SuspendedPage>} />
          <Route path="/workspace" element={<SuspendedPage><Workspace /></SuspendedPage>} />
          <Route path="/reports" element={<SuspendedPage><Reports /></SuspendedPage>} />
          <Route path="/settings" element={<SuspendedPage><Settings /></SuspendedPage>} />
          <Route path="/login" element={<SuspendedPage><Login /></SuspendedPage>} />
          <Route path="/register" element={<SuspendedPage><Register /></SuspendedPage>} />
        </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

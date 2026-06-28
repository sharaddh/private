import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));

function SuspendedPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/login" element={<SuspendedPage><Login /></SuspendedPage>} />
        <Route path="/" element={<ProtectedRoute><SuspendedPage><Dashboard /></SuspendedPage></ProtectedRoute>} />
        <Route path="/inventory" element={<ProtectedRoute><SuspendedPage><Inventory /></SuspendedPage></ProtectedRoute>} />
        <Route path="/inventory/new" element={<ProtectedRoute><SuspendedPage><Inventory /></SuspendedPage></ProtectedRoute>} />
        <Route path="/inventory/edit/:id" element={<ProtectedRoute><SuspendedPage><Inventory /></SuspendedPage></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

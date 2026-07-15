import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Spinner from "./components/Spinner";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Users = lazy(() => import("./pages/Users"));
const Register = lazy(() => import("./pages/Register"));

function SuspendedPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
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
        <Route path="/users" element={<ProtectedRoute><SuspendedPage><Users /></SuspendedPage></ProtectedRoute>} />
        <Route path="/users/new" element={<ProtectedRoute><SuspendedPage><Register /></SuspendedPage></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

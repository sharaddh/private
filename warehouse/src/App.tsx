import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { PageLoader } from "./components";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));
const LensStock = lazy(() => import("./pages/LensStock"));
const UpdateStock = lazy(() => import("./pages/UpdateStock"));
const Users = lazy(() => import("./pages/Users"));
const Register = lazy(() => import("./pages/Register"));
const Cart = lazy(() => import("./pages/Cart"));
const FogMarks = lazy(() => import("./pages/FogMarks"));

function SuspendedPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<PageLoader />}>
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
        <Route path="/lens-stock" element={<ProtectedRoute><SuspendedPage><LensStock /></SuspendedPage></ProtectedRoute>} />
        <Route path="/update-stock" element={<ProtectedRoute><SuspendedPage><UpdateStock /></SuspendedPage></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><SuspendedPage><Users /></SuspendedPage></ProtectedRoute>} />
        <Route path="/users/new" element={<ProtectedRoute><SuspendedPage><Register /></SuspendedPage></ProtectedRoute>} />
        <Route path="/cart" element={<ProtectedRoute><SuspendedPage><Cart /></SuspendedPage></ProtectedRoute>} />
        <Route path="/fog-marks" element={<ProtectedRoute><SuspendedPage><FogMarks /></SuspendedPage></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

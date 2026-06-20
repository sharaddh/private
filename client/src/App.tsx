import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Orders from "./pages/Orders";
import Bills from "./pages/Bills";
import Payments from "./pages/Payments";
import InventoryPage from "./pages/InventoryPage";
import Delivery from "./pages/Delivery";
import Pickup from "./pages/Pickup";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Workspace from "./pages/Workspace";
import Login from "./pages/Login";
import Register from "./pages/Register";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/visits" element={<Navigate to="/customers" replace />} />
        <Route path="/prescriptions" element={<Navigate to="/customers" replace />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/delivery" element={<Delivery />} />
        <Route path="/pickup" element={<Pickup />} />
        <Route path="/workspace" element={<Workspace />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Layout>
  );
}

import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
import Bills from "./pages/Bills";
import Payments from "./pages/Payments";
import InventoryPage from "./pages/InventoryPage";
import Delivery from "./pages/Delivery";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/bills" element={<Bills />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/delivery" element={<Delivery />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </Layout>
  );
}

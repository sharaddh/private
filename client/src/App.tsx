import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Customers from "./pages/Customers";
import Orders from "./pages/Orders";
import Bills from "./pages/Bills";
import Payments from "./pages/Payments";
import InventoryPage from "./pages/InventoryPage";
import Delivery from "./pages/Delivery";

export default function App() {
  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">KMJ Optical ERP</h1>
        <nav className="mt-2">
          <Link to="/customers" className="mr-4">
            Customers
          </Link>
          <Link to="/orders" className="mr-4">
            Orders
          </Link>
          <Link to="/bills" className="mr-4">
            Bills
          </Link>
          <Link to="/payments" className="mr-4">
            Payments
          </Link>
          <Link to="/inventory" className="mr-4">
            Inventory
          </Link>
          <Link to="/delivery" className="mr-4">
            Delivery
          </Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/customers" element={<Customers />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/bills" element={<Bills />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route index element={<div>Welcome to KMJ ERP</div>} />
        </Routes>
      </main>
    </div>
  );
}

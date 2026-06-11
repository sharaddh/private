import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Customers from "./pages/Customers";

export default function App() {
  return (
    <div className="min-h-screen p-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">KMJ Optical ERP</h1>
        <nav className="mt-2">
          <Link to="/customers" className="mr-4">
            Customers
          </Link>
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/customers" element={<Customers />} />
          <Route index element={<div>Welcome to KMJ ERP</div>} />
        </Routes>
      </main>
    </div>
  );
}

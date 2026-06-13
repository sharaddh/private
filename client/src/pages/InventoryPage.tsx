import React, { useEffect, useState } from "react";
import api from "../api";
import Form, { Input } from "../components/Form";
import Table from "../components/Table";

export default function InventoryPage() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({
    sku: "",
    brand: "",
    model: "",
    quantity: 0,
    purchasePrice: 0,
    sellingPrice: 0,
  });
  const [adjust, setAdjust] = useState({ id: "", qty: 0 });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  function fetchInventory() {
    api.get("/api/inventory").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post("/api/inventory", form);
      if (res.success) {
        setList([res.data, ...list]);
        setForm({
          sku: "",
          brand: "",
          model: "",
          quantity: 0,
          purchasePrice: 0,
          sellingPrice: 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAdjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (!adjust.id) return;
    setIsLoading(true);
    try {
      const res = await api.put(`/api/inventory/${adjust.id}/stock`, { quantity: adjust.qty });
      if (res.success) {
        fetchInventory();
        setAdjust({ id: "", qty: 0 });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form onSubmit={handleCreate} title="Add Inventory Item" submitLabel="Add Item" isLoading={isLoading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="SKU"
            placeholder="Product SKU"
            value={form.sku}
            onChange={(e) => setForm({ ...form, sku: e.target.value })}
            required
          />
          <Input
            label="Brand"
            placeholder="Brand name"
            value={form.brand}
            onChange={(e) => setForm({ ...form, brand: e.target.value })}
            required
          />
          <Input
            label="Model"
            placeholder="Model number"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            required
          />
          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            min="0"
          />
          <Input
            label="Purchase Price"
            type="number"
            placeholder="0.00"
            value={form.purchasePrice}
            onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
            step="0.01"
          />
          <Input
            label="Selling Price"
            type="number"
            placeholder="0.00"
            value={form.sellingPrice}
            onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
            step="0.01"
          />
        </div>
      </Form>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4">Adjust Stock</h3>
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Item
              </label>
              <select
                value={adjust.id}
                onChange={(e) => setAdjust({ ...adjust, id: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select item</option>
                {list.map((it) => (
                  <option key={it._id} value={it._id}>
                    {it.sku} - {it.brand} ({it.quantity})
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Quantity Delta"
              type="number"
              value={adjust.qty}
              onChange={(e) => setAdjust({ ...adjust, qty: Number(e.target.value) })}
              placeholder="+5 or -3"
            />
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Adjust Stock
              </button>
            </div>
          </div>
        </form>
      </div>

      <div>
        <h2 className="text-2xl font-bold mb-4">Inventory Items ({list.length})</h2>
        <Table
          columns={[
            { key: "sku", label: "SKU" },
            { key: "brand", label: "Brand" },
            { key: "model", label: "Model" },
            { key: "quantity", label: "Qty" },
            { key: "purchasePrice", label: "Purchase Price" },
            { key: "sellingPrice", label: "Selling Price" },
          ]}
          data={list}
          actions={(row) => (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              row.quantity > 10 ? "bg-green-100 text-green-800" :
              row.quantity > 0 ? "bg-yellow-100 text-yellow-800" :
              "bg-red-100 text-red-800"
            }`}>
              {row.quantity === 0 ? "Out of Stock" : `${row.quantity} units`}
            </span>
          )}
        />
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import api from "../api";

export default function InventoryPage() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ sku: "", brand: "", model: "", quantity: 0, purchasePrice: 0, sellingPrice: 0 });
  const [adjust, setAdjust] = useState({ id: "", qty: 0 });

  useEffect(() => {
    api.get("/api/inventory").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.post("/api/inventory", form);
    if (res.success) setList((s) => [res.data, ...s]);
  }

  async function adjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (!adjust.id) return;
    const res = await api.post(`/api/inventory/${adjust.id}/stock`, { quantity: adjust.qty });
    if (res.success) {
      // refresh
      api.get("/api/inventory").then((d) => { if (d.success) setList(d.data || []); });
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Inventory</h2>
      <form onSubmit={create} className="mb-4 grid grid-cols-2 gap-2">
        <input value={form.sku} onChange={(e)=>setForm({...form, sku:e.target.value})} placeholder="SKU" className="border p-2" />
        <input value={form.brand} onChange={(e)=>setForm({...form, brand:e.target.value})} placeholder="Brand" className="border p-2" />
        <input value={form.model} onChange={(e)=>setForm({...form, model:e.target.value})} placeholder="Model" className="border p-2" />
        <input type="number" value={form.quantity} onChange={(e)=>setForm({...form, quantity: Number(e.target.value)})} placeholder="Quantity" className="border p-2" />
        <input type="number" value={form.purchasePrice} onChange={(e)=>setForm({...form, purchasePrice: Number(e.target.value)})} placeholder="Purchase price" className="border p-2" />
        <input type="number" value={form.sellingPrice} onChange={(e)=>setForm({...form, sellingPrice: Number(e.target.value)})} placeholder="Selling price" className="border p-2" />
        <button type="submit" className="col-span-2 bg-blue-600 text-white p-2">Add Inventory Item</button>
      </form>

      <form onSubmit={adjustStock} className="mb-4 grid grid-cols-3 gap-2">
        <select value={adjust.id} onChange={(e)=>setAdjust({...adjust, id:e.target.value})} className="border p-2">
          <option value="">Select item</option>
          {list.map(it => <option key={it._id} value={it._id}>{it.sku} - {it.brand}</option>)}
        </select>
        <input type="number" value={adjust.qty} onChange={(e)=>setAdjust({...adjust, qty: Number(e.target.value)})} placeholder="Quantity delta" className="border p-2" />
        <button type="submit" className="bg-green-600 text-white p-2">Adjust Stock</button>
      </form>

      <ul>
        {list.map((it) => (
          <li key={it._id} className="py-2 border-b">
            {it.sku} - {it.brand} - <strong>{it.quantity}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

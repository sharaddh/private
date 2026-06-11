import React, { useEffect, useState } from "react";
import api from "../api";

export default function Orders() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ customerId: "", frame: "", lens: "", quantity: 1, deliveryDate: "", status: "Draft" });

  useEffect(() => {
    api.get("/api/orders").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.post("/api/orders", form);
    if (res.success) setList((s) => [res.data, ...s]);
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Orders</h2>
      <form onSubmit={submit} className="mb-4 grid grid-cols-2 gap-2">
        <input value={form.customerId} onChange={(e)=>setForm({...form, customerId:e.target.value})} placeholder="Customer ID" className="border p-2" />
        <input value={form.frame} onChange={(e)=>setForm({...form, frame:e.target.value})} placeholder="Frame" className="border p-2" />
        <input value={form.lens} onChange={(e)=>setForm({...form, lens:e.target.value})} placeholder="Lens" className="border p-2" />
        <input type="number" value={form.quantity} onChange={(e)=>setForm({...form, quantity: Number(e.target.value)})} placeholder="Quantity" className="border p-2" />
        <input value={form.deliveryDate} onChange={(e)=>setForm({...form, deliveryDate:e.target.value})} placeholder="Delivery Date" className="border p-2" />
        <select value={form.status} onChange={(e)=>setForm({...form, status:e.target.value})} className="border p-2">
          <option>Draft</option>
          <option>Ordered</option>
          <option>In Lab</option>
          <option>Ready</option>
          <option>Delivered</option>
          <option>Cancelled</option>
        </select>
        <button type="submit" className="col-span-2 bg-blue-600 text-white p-2">Create Order</button>
      </form>

      <ul>
        {list.map((o) => (
          <li key={o._id} className="py-2 border-b">
            {o.frame || o.lens} - <small>{o.status}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

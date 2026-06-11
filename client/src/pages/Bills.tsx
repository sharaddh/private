import React, { useEffect, useState } from "react";
import api from "../api";

export default function Bills() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ customerId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, advancePaid: 0 });

  useEffect(() => {
    api.get("/api/bills").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { customerId: form.customerId, items: [{ description: form.description, quantity: form.quantity, unitPrice: form.unitPrice }], discount: form.discount, tax: form.tax, advancePaid: form.advancePaid };
    const res = await api.post("/api/bills", body);
    if (res.success) setList((s) => [res.data, ...s]);
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Bills</h2>
      <form onSubmit={submit} className="mb-4 grid grid-cols-2 gap-2">
        <input value={form.customerId} onChange={(e)=>setForm({...form, customerId:e.target.value})} placeholder="Customer ID" className="border p-2" />
        <input value={form.description} onChange={(e)=>setForm({...form, description:e.target.value})} placeholder="Item description" className="border p-2" />
        <input type="number" value={form.quantity} onChange={(e)=>setForm({...form, quantity: Number(e.target.value)})} placeholder="Quantity" className="border p-2" />
        <input type="number" value={form.unitPrice} onChange={(e)=>setForm({...form, unitPrice: Number(e.target.value)})} placeholder="Unit price" className="border p-2" />
        <input type="number" value={form.discount} onChange={(e)=>setForm({...form, discount: Number(e.target.value)})} placeholder="Discount" className="border p-2" />
        <input type="number" value={form.tax} onChange={(e)=>setForm({...form, tax: Number(e.target.value)})} placeholder="Tax" className="border p-2" />
        <input type="number" value={form.advancePaid} onChange={(e)=>setForm({...form, advancePaid: Number(e.target.value)})} placeholder="Advance paid" className="border p-2" />
        <button type="submit" className="col-span-2 bg-blue-600 text-white p-2">Create Bill</button>
      </form>

      <ul>
        {list.map((b) => (
          <li key={b._id} className="py-2 border-b">
            {b.billNumber} - <strong>{b.totalAmount}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

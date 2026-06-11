import React, { useEffect, useState } from "react";
import api from "../api";

export default function Payments() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ customerId: "", billId: "", amount: 0, paymentMode: "Cash" });

  useEffect(() => {
    api.get("/api/payments").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await api.post("/api/payments", form);
    if (res.success) setList((s) => [res.data, ...s]);
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Payments</h2>
      <form onSubmit={submit} className="mb-4 grid grid-cols-2 gap-2">
        <input value={form.customerId} onChange={(e)=>setForm({...form, customerId:e.target.value})} placeholder="Customer ID" className="border p-2" />
        <input value={form.billId} onChange={(e)=>setForm({...form, billId:e.target.value})} placeholder="Bill ID" className="border p-2" />
        <input type="number" value={form.amount} onChange={(e)=>setForm({...form, amount: Number(e.target.value)})} placeholder="Amount" className="border p-2" />
        <select value={form.paymentMode} onChange={(e)=>setForm({...form, paymentMode:e.target.value})} className="border p-2">
          <option>Cash</option>
          <option>UPI</option>
          <option>Card</option>
          <option>Bank Transfer</option>
        </select>
        <button type="submit" className="col-span-2 bg-blue-600 text-white p-2">Record Payment</button>
      </form>

      <ul>
        {list.map((p) => (
          <li key={p._id} className="py-2 border-b">
            {p.amount} - <small>{p.paymentMode}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

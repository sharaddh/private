import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2 } from "lucide-react";

export default function Payments() {
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "", billId: "", amount: 0, paymentMode: "Cash", notes: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { fetchPayments(); }, []);

  function fetchPayments() {
    api.get("/api/payments").then((d) => { if (d.success) setList(d.data || []); });
  }

  function openCreate() {
    setEditing(null);
    setForm({ customerId: "", billId: "", amount: 0, paymentMode: "Cash", notes: "" });
    setShowForm(true);
  }

  function openEdit(p: any) {
    setEditing(p);
    setForm({
      customerId: p.customerId || "",
      billId: p.billId || "",
      amount: p.amount || 0,
      paymentMode: p.paymentMode || "Cash",
      notes: p.notes || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = editing
        ? await api.put(`/api/payments/${editing._id}`, form)
        : await api.post("/api/payments", form);
      if (res.success) { fetchPayments(); setShowForm(false); }
    } finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this payment?")) return;
    const res = await api.del(`/api/payments/${id}`);
    if (res.success) setList((prev) => prev.filter((p) => p._id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Payments</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Record and manage payments.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> <span className="hidden sm:inline">Record Payment</span>
        </button>
      </div>

      <Table
        columns={[
          { key: "customerId", label: "Customer ID" },
          { key: "billId", label: "Bill ID" },
          { key: "amount", label: "Amount", render: (v) => <span className="font-semibold">₹{(v || 0).toFixed(2)}</span> },
          { key: "paymentMode", label: "Mode", render: (v) => (
            <span className={`badge ${
              v === "Cash" ? "badge-green" :
              v === "UPI" ? "badge-blue" :
              v === "Card" ? "badge-purple" :
              "badge-yellow"
            }`}>{v || "Cash"}</span>
          )},
          { key: "paymentDate", label: "Date", render: (v) => v ? new Date(v).toLocaleDateString() : "—" },
          { key: "notes", label: "Notes" },
        ]}
        data={list}
        searchPlaceholder="Search payments..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400"><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"><Trash2 size={15} /></button>
          </div>
        )}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Payment" : "Record Payment"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Customer ID *</label>
              <input className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Bill ID</label>
              <input className="input-field" value={form.billId} onChange={(e) => setForm({ ...form, billId: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Amount *</label>
              <input type="number" step="0.01" className="input-field" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Payment Mode</label>
              <select className="input-field" value={form.paymentMode} onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}>
                {["Cash", "UPI", "Card", "Bank Transfer"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
              <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Record Payment"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

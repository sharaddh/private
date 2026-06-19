import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2, Printer, FileDown } from "lucide-react";

export default function Bills() {
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "", description: "", quantity: 1, unitPrice: 0,
    discount: 0, tax: 0, advancePaid: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { fetchBills(); }, []);

  function fetchBills() {
    api.get("/api/bills").then((d) => { if (d.success) setList(d.data || []); });
  }

  function openCreate() {
    setEditing(null);
    setForm({ customerId: "", description: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0, advancePaid: 0 });
    setShowForm(true);
  }

  function openEdit(b: any) {
    setEditing(b);
    const item = b.items?.[0] || {};
    setForm({
      customerId: b.customerId || "",
      description: item.description || "",
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      discount: b.discount || 0,
      tax: b.tax || 0,
      advancePaid: b.advancePaid || 0,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const body = {
        customerId: form.customerId,
        items: [{ description: form.description, quantity: form.quantity, unitPrice: form.unitPrice }],
        discount: form.discount,
        tax: form.tax,
        advancePaid: form.advancePaid,
      };
      const res = editing
        ? await api.put(`/api/bills/${editing._id}`, body)
        : await api.post("/api/bills", body);
      if (res.success) { fetchBills(); setShowForm(false); }
    } finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this bill?")) return;
    const res = await api.del(`/api/bills/${id}`);
    if (res.success) setList((prev) => prev.filter((b) => b._id !== id));
  }

  function handlePrint(bill: any) {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Bill ${bill.billNumber}</title>
      <style>body{font-family:system-ui;padding:40px;max-width:800px;margin:auto}
      table{width:100%;border-collapse:collapse;margin:20px 0}
      th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
      th{background:#f5f5f5}.right{text-align:right}
      h1{font-size:24px;margin-bottom:4px}
      .meta{color:#666;font-size:14px}</style></head><body>
      <h1>KMJ Optical</h1>
      <p class="meta">${bill.billNumber || ""}</p>
      <p class="meta">Date: ${new Date(bill.createdAt).toLocaleDateString()}</p>
      <p class="meta">Customer ID: ${bill.customerId || ""}</p>
      <table>
        <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
        ${(bill.items || []).map((it: any) => `
          <tr><td>${it.description || ""}</td><td>${it.quantity || 1}</td>
          <td class="right">₹${(it.unitPrice || 0).toFixed(2)}</td>
          <td class="right">₹${((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}</td></tr>
        `).join("")}
      </table>
      <p class="right">Subtotal: ₹${(bill.subtotal || 0).toFixed(2)}</p>
      ${bill.discount ? `<p class="right">Discount: -₹${bill.discount.toFixed(2)}</p>` : ""}
      ${bill.tax ? `<p class="right">Tax: +₹${bill.tax.toFixed(2)}</p>` : ""}
      <p class="right" style="font-size:18px;font-weight:bold">Total: ₹${(bill.totalAmount || 0).toFixed(2)}</p>
      ${bill.advancePaid ? `<p class="right">Advance: ₹${bill.advancePaid.toFixed(2)}</p>` : ""}
      ${bill.pendingAmount ? `<p class="right">Pending: ₹${bill.pendingAmount.toFixed(2)}</p>` : ""}
      <script>window.print()</script></body></html>
    `);
    w.document.close();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Bills</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage billing invoices.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> <span className="hidden sm:inline">New Bill</span>
        </button>
      </div>

      <Table
        columns={[
          { key: "billNumber", label: "Bill #" },
          { key: "customerId", label: "Customer ID" },
          { key: "subtotal", label: "Subtotal", render: (v) => `₹${(v || 0).toFixed(2)}` },
          { key: "discount", label: "Discount", render: (v) => v ? `-₹${v.toFixed(2)}` : "—" },
          { key: "totalAmount", label: "Total", render: (v) => <span className="font-semibold">₹{(v || 0).toFixed(2)}</span> },
          { key: "pendingAmount", label: "Pending", render: (v) => (
            <span className={v > 0 ? "text-amber-600 font-medium" : "text-emerald-600"}>{v > 0 ? `₹${v.toFixed(2)}` : "Paid"}</span>
          )},
        ]}
        data={list}
        searchPlaceholder="Search bills..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => handlePrint(row)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600" title="Print">
              <Printer size={15} />
            </button>
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600"><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"><Trash2 size={15} /></button>
          </div>
        )}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Bill" : "Create New Bill"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer ID *</label>
              <input className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Item Description *</label>
              <input className="input-field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
              <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Unit Price</label>
              <input type="number" step="0.01" className="input-field" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Discount</label>
              <input type="number" step="0.01" className="input-field" value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tax</label>
              <input type="number" step="0.01" className="input-field" value={form.tax} onChange={(e) => setForm({ ...form, tax: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Advance Paid</label>
              <input type="number" step="0.01" className="input-field" value={form.advancePaid} onChange={(e) => setForm({ ...form, advancePaid: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update Bill" : "Create Bill"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

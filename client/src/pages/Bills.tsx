import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2, Printer, MessageCircle, FileDown } from "lucide-react";

export default function Bills() {
  const [list, setList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "", description: "", quantity: 1, unitPrice: 0,
    discount: 0, tax: 0, advancePaid: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { fetchBills(); fetchCustomers(); fetchSettings(); }, []);

  function fetchBills() {
    api.get("/api/bills").then((d) => { if (d.success) setList(d.data || []); });
  }

  function fetchCustomers() {
    api.get("/api/customers").then((d) => { if (d.success) setCustomers(d.data || []); });
  }

  function fetchSettings() {
    api.get("/api/settings").then((d) => { if (d.success) setSettings(d.data); });
  }

  function getCustomerByMobileOrId(val: string) {
    return customers.find((c) => c._id === val || c.mobile === val || c.customerId === val);
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
    const shop = settings?.shopName || "KMJ Optical";
    const address = settings?.shopAddress || "";
    const phone = settings?.shopPhone || "";
    const logo = settings?.logo || "";
    const customer = getCustomerByMobileOrId(bill.customerId);
    w.document.write(`
      <html><head><title>Bill ${bill.billNumber}</title>
      <style>
        body{font-family:system-ui;padding:40px;max-width:800px;margin:auto;color:#333}
        .header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #eee}
        .logo{max-width:120px;max-height:120px;margin-bottom:10px}
        h1{font-size:26px;margin:4px 0;color:#111}
        .shop-info{color:#666;font-size:13px;line-height:1.6}
        .bill-meta{display:flex;justify-content:space-between;margin:20px 0;font-size:14px;color:#555}
        table{width:100%;border-collapse:collapse;margin:20px 0}
        th,td{border:1px solid #ddd;padding:10px 14px;text-align:left}
        th{background:#f8f8f8;font-weight:600;font-size:13px}
        .right{text-align:right}
        .totals{text-align:right;font-size:15px;margin-top:20px}
        .totals p{margin:4px 0}
        .grand-total{font-size:20px;font-weight:bold;margin-top:8px;padding-top:8px;border-top:2px solid #333}
        .footer{text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #eee;color:#999;font-size:12px}
      </style></head><body>
      <div class="header">
        ${logo ? `<img src="${logo}" class="logo" alt="Logo" />` : ""}
        <h1>${shop}</h1>
        ${address ? `<p class="shop-info">${address}</p>` : ""}
        ${phone ? `<p class="shop-info">${phone}</p>` : ""}
      </div>
      <div class="bill-meta">
        <div><strong>${bill.billNumber || ""}</strong></div>
        <div>Date: ${new Date(bill.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
      </div>
      ${customer ? `<p style="font-size:14px;color:#555;margin-bottom:16px"><strong>Customer:</strong> ${customer.name || ""} ${customer.mobile ? `(${customer.mobile})` : ""}</p>` : ""}
      <table>
        <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
        ${(bill.items || []).map((it: any) => `
          <tr><td>${it.description || ""}</td><td>${it.quantity || 1}</td>
          <td class="right">₹${(it.unitPrice || 0).toFixed(2)}</td>
          <td class="right">₹${((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}</td></tr>
        `).join("")}
      </table>
      <div class="totals">
        <p>Subtotal: ₹${(bill.subtotal || 0).toFixed(2)}</p>
        ${bill.discount ? `<p>Discount: -₹${bill.discount.toFixed(2)}</p>` : ""}
        ${bill.tax ? `<p>Tax: +₹${bill.tax.toFixed(2)}</p>` : ""}
        <p class="grand-total">Total: ₹${(bill.totalAmount || 0).toFixed(2)}</p>
        ${bill.advancePaid ? `<p style="color:#059669">Advance Paid: ₹${bill.advancePaid.toFixed(2)}</p>` : ""}
        ${bill.pendingAmount ? `<p style="color:#d97706">Pending: ₹${bill.pendingAmount.toFixed(2)}</p>` : ""}
      </div>
      <div class="footer">Thank you for your visit!</div>
      <script>window.print()</script></body></html>
    `);
    w.document.close();
  }

  function sendWhatsApp(bill: any) {
    const customer = getCustomerByMobileOrId(bill.customerId);
    const num = customer?.mobile?.replace(/\D/g, "");
    if (!num) return;
    const adminNum = settings?.adminWhatsApp?.replace(/\D/g, "") || "91";
    const shop = settings?.shopName || "KMJ Optical";
    const items = (bill.items || []).map((i: any) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("%0a");
    const msg = `*${shop}* 🕶%0a%0a*Bill:* ${bill.billNumber || ""}%0a*Date:* ${new Date().toLocaleDateString("en-IN")}%0a%0a*Customer:* ${customer?.name || ""}%0a*Mobile:* ${customer?.mobile || ""}%0a%0a*Items:*%0a${items}%0a%0a*Subtotal:* ₹${(bill.subtotal || 0).toFixed(0)}%0a${bill.discount ? `*Discount:* -₹${bill.discount.toFixed(0)}%0a` : ""}${bill.tax ? `*Tax:* +₹${bill.tax.toFixed(0)}%0a` : ""}*Total:* ₹${(bill.totalAmount || 0).toFixed(0)}%0a*Paid:* ₹${(bill.advancePaid || 0).toFixed(0)}%0a*Pending:* ₹${(bill.pendingAmount || 0).toFixed(0)}%0a%0aThank you! 🙏`;
    window.open(`https://wa.me/${adminNum}?text=${msg}`, "_blank");
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
          { key: "customerId", label: "Customer", render: (v) => {
            const c = getCustomerByMobileOrId(v);
            return c ? c.name : v;
          }},
          { key: "subtotal", label: "Subtotal", render: (v) => `₹${(v || 0).toFixed(2)}` },
          { key: "totalAmount", label: "Total", render: (v) => <span className="font-semibold">₹{(v || 0).toFixed(2)}</span> },
          { key: "pendingAmount", label: "Pending", render: (v) => (
            <span className={v > 0 ? "text-amber-600 font-medium" : "text-emerald-600"}>{v > 0 ? `₹${v.toFixed(2)}` : "Paid"}</span>
          )},
        ]}
        data={list}
        searchPlaceholder="Search bills..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => sendWhatsApp(row)} className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Send WhatsApp">
              <MessageCircle size={15} />
            </button>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer *</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} ({c.mobile || c.customerId})</option>
                ))}
              </select>
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

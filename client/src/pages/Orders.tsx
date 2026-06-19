import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2 } from "lucide-react";

export default function Orders() {
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "", frame: "", lens: "", coating: "", accessories: "",
    quantity: 1, deliveryDate: "", status: "Draft",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { fetchOrders(); }, []);

  function fetchOrders() {
    api.get("/api/orders").then((d) => { if (d.success) setList(d.data || []); });
  }

  function openCreate() {
    setEditing(null);
    setForm({ customerId: "", frame: "", lens: "", coating: "", accessories: "", quantity: 1, deliveryDate: "", status: "Draft" });
    setShowForm(true);
  }

  function openEdit(o: any) {
    setEditing(o);
    setForm({
      customerId: o.customerId || "",
      frame: o.frame || "",
      lens: o.lens || "",
      coating: o.coating || "",
      accessories: o.accessories?.join(", ") || "",
      quantity: o.quantity || 1,
      deliveryDate: o.deliveryDate ? new Date(o.deliveryDate).toISOString().split("T")[0] : "",
      status: o.status || "Draft",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        ...form,
        accessories: form.accessories.split(",").map((s) => s.trim()).filter(Boolean),
        deliveryDate: form.deliveryDate || undefined,
      };
      const res = editing
        ? await api.put(`/api/orders/${editing._id}`, payload)
        : await api.post("/api/orders", payload);
      if (res.success) { fetchOrders(); setShowForm(false); }
    } finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this order?")) return;
    const res = await api.del(`/api/orders/${id}`);
    if (res.success) setList((prev) => prev.filter((o) => o._id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer orders and track status.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> <span className="hidden sm:inline">New Order</span>
        </button>
      </div>

      <Table
        columns={[
          { key: "customerId", label: "Customer ID" },
          { key: "frame", label: "Frame" },
          { key: "lens", label: "Lens" },
          { key: "coating", label: "Coating" },
          { key: "quantity", label: "Qty" },
          { key: "deliveryDate", label: "Delivery", render: (v) => v ? new Date(v).toLocaleDateString() : "—" },
          { key: "status", label: "Status", render: (v) => (
            <span className={`badge ${
              v === "Delivered" ? "badge-green" :
              v === "Cancelled" ? "badge-red" :
              v === "Ready" ? "badge-blue" :
              v === "Ordered" ? "badge-purple" :
              v === "In Lab" ? "badge-yellow" :
              "badge-gray"
            }`}>{v || "Draft"}</span>
          )},
        ]}
        data={list}
        searchPlaceholder="Search orders..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600"><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600"><Trash2 size={15} /></button>
          </div>
        )}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Order" : "Create New Order"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer ID *</label>
              <input className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Frame</label>
              <input className="input-field" placeholder="Frame model" value={form.frame} onChange={(e) => setForm({ ...form, frame: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Lens</label>
              <input className="input-field" placeholder="Lens type" value={form.lens} onChange={(e) => setForm({ ...form, lens: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Coating</label>
              <input className="input-field" placeholder="Coating type" value={form.coating} onChange={(e) => setForm({ ...form, coating: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
              <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} min="1" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Date</label>
              <input type="date" className="input-field" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["Draft", "Ordered", "In Lab", "Ready", "Delivered", "Cancelled"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Accessories</label>
              <input className="input-field" placeholder="comma, separated" value={form.accessories} onChange={(e) => setForm({ ...form, accessories: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Create Order"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2, Truck } from "lucide-react";

export default function Delivery() {
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [filter, setFilter] = useState<string>("all");
  const [form, setForm] = useState({
    customerId: "", orderId: "", address: "", expectedDeliveryDate: "", status: "Pending",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { fetchDeliveries(); }, []);

  function fetchDeliveries() {
    api.get("/api/delivery").then((d) => { if (d.success) setList(d.data || []); });
  }

  const today = new Date().toISOString().split("T")[0];
  const todayDeliveries = list.filter((d) => {
    if (!d.expectedDeliveryDate) return false;
    return new Date(d.expectedDeliveryDate).toISOString().split("T")[0] === today;
  });
  const overdue = list.filter((d) => {
    if (!d.expectedDeliveryDate || d.status === "Delivered") return false;
    return new Date(d.expectedDeliveryDate) < new Date();
  });

  const filteredList = filter === "today" ? todayDeliveries : filter === "ready" ? list.filter((d) => d.status === "Ready") : filter === "overdue" ? overdue : list;

  function openCreate() {
    setEditing(null);
    setForm({ customerId: "", orderId: "", address: "", expectedDeliveryDate: "", status: "Pending" });
    setShowForm(true);
  }

  function openEdit(d: any) {
    setEditing(d);
    setForm({
      customerId: d.customerId || "", orderId: d.orderId || "", address: d.address || "",
      expectedDeliveryDate: d.expectedDeliveryDate ? new Date(d.expectedDeliveryDate).toISOString().split("T")[0] : "",
      status: d.status || "Pending",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = editing
        ? await api.put(`/api/delivery/${editing._id}`, form)
        : await api.post("/api/delivery", form);
      if (res.success) { fetchDeliveries(); setShowForm(false); }
    } finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this delivery entry?")) return;
    const res = await api.del(`/api/delivery/${id}`);
    if (res.success) setList((prev) => prev.filter((d) => d._id !== id));
  }

  const statusColor: Record<string, string> = {
    Pending: "badge-yellow", "In Transit": "badge-blue", Ready: "badge-green", Delivered: "badge-gray", Cancelled: "badge-red",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Delivery</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage and track order deliveries.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> <span className="hidden sm:inline">New Delivery</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("all")}>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{list.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
        </div>
        <div className="card text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("today")}>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{todayDeliveries.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Today</p>
        </div>
        <div className="card text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("ready")}>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{list.filter((d) => d.status === "Ready").length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Ready</p>
        </div>
        <div className="card text-center cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("overdue")}>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{overdue.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Overdue</p>
        </div>
      </div>

      <div className="flex gap-2">
        {[
          { key: "all", label: "All" },
          { key: "today", label: "Today" },
          { key: "ready", label: "Ready" },
          { key: "overdue", label: "Overdue" },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f.key ? "bg-indigo-600 text-white" : "bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-dark-700 hover:bg-gray-50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <Table
        columns={[
          { key: "customerId", label: "Customer ID" },
          { key: "orderId", label: "Order ID" },
          { key: "address", label: "Address" },
          { key: "expectedDeliveryDate", label: "Expected", render: (v) => v ? new Date(v).toLocaleDateString() : "—" },
          { key: "status", label: "Status", render: (v) => (
            <span className={`badge ${statusColor[v] || "badge-gray"}`}>{v || "Pending"}</span>
          )},
        ]}
        data={filteredList}
        searchPlaceholder="Search deliveries..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 dark:text-indigo-400"><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 dark:text-red-400"><Trash2 size={15} /></button>
          </div>
        )}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Delivery" : "New Delivery Entry"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Customer ID *</label>
              <input className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Order ID</label>
              <input className="input-field" value={form.orderId} onChange={(e) => setForm({ ...form, orderId: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Delivery Address</label>
              <textarea className="input-field" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Expected Delivery Date</label>
              <input type="date" className="input-field" value={form.expectedDeliveryDate} onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
              <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {["Pending", "In Transit", "Ready", "Delivered", "Cancelled"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Create Delivery"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

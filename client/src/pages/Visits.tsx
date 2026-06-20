import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2 } from "lucide-react";

export default function Visits() {
  const [list, setList] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "", visitDate: new Date().toISOString().split("T")[0],
    doctorName: "", remarks: "",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.get("/api/visits").then((d) => { if (d.success) setList(d.data || []); });
    api.get("/api/customers").then((d) => { if (d.success) setCustomers(d.data || []); });
  }, []);

  function openCreate() {
    setEditing(null);
    setForm({ customerId: "", visitDate: new Date().toISOString().split("T")[0], doctorName: "", remarks: "" });
    setShowForm(true);
  }

  function openEdit(v: any) {
    setEditing(v);
    setForm({
      customerId: v.customerId || "",
      visitDate: v.visitDate ? new Date(v.visitDate).toISOString().split("T")[0] : "",
      doctorName: v.doctorName || "",
      remarks: v.remarks || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = editing
        ? await api.put(`/api/visits/${editing._id}`, form)
        : await api.post("/api/visits", form);
      if (res.success) {
        const d = await api.get("/api/visits");
        if (d.success) setList(d.data || []);
        setShowForm(false);
      }
    } finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this visit?")) return;
    const res = await api.del(`/api/visits/${id}`);
    if (res.success) setList((prev) => prev.filter((v) => v._id !== id));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Visits</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track customer visits to the store.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> <span className="hidden sm:inline">New Visit</span>
        </button>
      </div>

      <Table
        columns={[
          { key: "customerId", label: "Customer ID" },
          { key: "visitDate", label: "Visit Date", render: (v) => v ? new Date(v).toLocaleDateString() : "—" },
          { key: "doctorName", label: "Doctor" },
          { key: "remarks", label: "Remarks" },
        ]}
        data={list}
        searchPlaceholder="Search visits..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400"><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"><Trash2 size={15} /></button>
          </div>
        )}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Visit" : "Record New Visit"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Customer *</label>
              <select className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required>
                <option value="">Select customer</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>{c.name} ({c.mobile || "—"})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Visit Date</label>
              <input type="date" className="input-field" value={form.visitDate} onChange={(e) => setForm({ ...form, visitDate: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Doctor Name</label>
              <input className="input-field" value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Remarks</label>
              <input className="input-field" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Record Visit"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

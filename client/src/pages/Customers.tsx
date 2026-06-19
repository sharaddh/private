import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2, UserPlus } from "lucide-react";

interface Customer {
  _id: string;
  customerId: string;
  name: string;
  email?: string;
  mobile?: string;
  alternateMobile?: string;
  address?: string;
  city?: string;
  age?: number;
  gender?: string;
  tags?: string[];
  totalVisits?: number;
  totalSpent?: number;
  pendingAmount?: number;
  createdAt: string;
}

export default function Customers() {
  const [list, setList] = useState<Customer[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", mobile: "", alternateMobile: "", address: "",
    city: "", age: "", gender: "", tags: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const fetchCustomers = useCallback(async () => {
    const res = await api.get("/api/customers");
    if (res.success) setList(res.data || []);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", mobile: "", alternateMobile: "", address: "", city: "", age: "", gender: "", tags: "" });
    setShowForm(true);
    setError("");
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name || "",
      email: c.email || "",
      mobile: c.mobile || "",
      alternateMobile: c.alternateMobile || "",
      address: c.address || "",
      city: c.city || "",
      age: c.age?.toString() || "",
      gender: c.gender || "",
      tags: c.tags?.join(", ") || "",
    });
    setShowForm(true);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const payload = {
        ...form,
        age: form.age ? Number(form.age) : undefined,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        email: form.email || undefined,
        mobile: form.mobile || undefined,
      };
      const res = editing
        ? await api.put(`/api/customers/${editing._id}`, payload)
        : await api.post("/api/customers", payload);
      if (res.success) {
        await fetchCustomers();
        setShowForm(false);
      } else {
        setError(res.message || "Operation failed");
      }
    } catch {
      setError("An error occurred");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    const res = await api.del(`/api/customers/${id}`);
    if (res.success) {
      setList((prev) => prev.filter((c) => c._id !== id));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer profiles and contact details.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <UserPlus size={18} />
          <span className="hidden sm:inline">Add Customer</span>
        </button>
      </div>

      <Table
        columns={[
          { key: "name", label: "Name", render: (v, row) => (
            <span
              onClick={() => navigate(`/customers/${row._id}`)}
              className="text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
            >
              {v || "—"}
            </span>
          )},
          { key: "mobile", label: "Mobile" },
          { key: "email", label: "Email" },
          { key: "city", label: "City" },
          { key: "gender", label: "Gender" },
          { key: "totalVisits", label: "Visits" },
          { key: "totalSpent", label: "Total Spent", render: (v) => v ? `₹${v.toLocaleString()}` : "—" },
        ]}
        data={list}
        searchPlaceholder="Search by name, mobile, email..."
        actions={(row: Customer) => (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); openEdit(row); }}
              className="p-1.5 hover:bg-indigo-50 rounded-lg text-indigo-600 transition-colors"
              title="Edit"
            >
              <Edit2 size={16} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(row._id); }}
              className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
        onRowClick={(row) => navigate(`/customers/${row._id}`)}
      />

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Customer" : "Add New Customer"}
        size="lg"
      >
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mobile</label>
              <input className="input-field" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Alternate Mobile</label>
              <input className="input-field" value={form.alternateMobile} onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
              <input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Age</label>
              <input type="number" className="input-field" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
              <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
              <input className="input-field" placeholder="tag1, tag2" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <textarea className="input-field" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">
              {isLoading ? "Saving..." : editing ? "Update Customer" : "Add Customer"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

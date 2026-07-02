import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useCachedData } from "../hooks/useCachedData";
import { invalidateCache } from "../hooks/useCache";
import Modal from "../components/Modal";
import PageSkeleton from "../components/PageSkeleton";
import { useAuth } from "../context/AuthContext";
import { Plus, Edit2, Trash2, UserPlus, Search, Phone, ArrowRight, Users } from "lucide-react";

interface Customer {
  _id: string; customerId: string; name: string; email?: string;
  mobile?: string; alternateMobile?: string; address?: string; city?: string;
  age?: number; gender?: string; tags?: string[];
  totalVisits?: number; totalSpent?: number; pendingAmount?: number; createdAt: string;
}

export default function Customers() {
  const [list, setList] = useState<Customer[]>([]);
  const [filteredList, setFilteredList] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", alternateMobile: "", address: "", city: "", age: "", gender: "", tags: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { isStaff } = useAuth();
  const { data: rawList, loading } = useCachedData<Customer[]>("/api/customers", () => api.get("/api/customers"));

  useEffect(() => {
    if (rawList) {
      const customers = Array.isArray(rawList) ? rawList : (rawList as any).data || [];
      setList(customers);
      setFilteredList(customers);
    }
  }, [rawList]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setFilteredList(list); return; }
    const lower = q.toLowerCase();
    setFilteredList(list.filter((c) =>
      c.name?.toLowerCase().includes(lower) || c.mobile?.includes(q) ||
      c.customerId?.toLowerCase().includes(lower) || c.email?.toLowerCase().includes(lower)
    ));
  }, [searchQuery, list]);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", email: "", mobile: "", alternateMobile: "", address: "", city: "", age: "", gender: "", tags: "" });
    setShowForm(true); setError("");
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name || "", email: c.email || "", mobile: c.mobile || "",
      alternateMobile: c.alternateMobile || "", address: c.address || "",
      city: c.city || "", age: c.age?.toString() || "", gender: c.gender || "",
      tags: c.tags?.join(", ") || "",
    });
    setShowForm(true); setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true); setError("");
    try {
      const payload = { ...form, age: form.age ? Number(form.age) : undefined, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean), email: form.email || undefined, mobile: form.mobile || undefined };
      const res = editing ? await api.put(`/api/customers/${editing._id}`, payload) : await api.post("/api/customers", payload);
      if (res.success) { invalidateCache("/api/customers"); setShowForm(false); if (!editing && res.data?._id) navigate(`/customers/${res.data._id}`); }
      else setError(res.message || "Operation failed");
    } catch { setError("An error occurred"); }
    finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this customer?")) return;
    const res = await api.del(`/api/customers/${id}`);
    if (res.success) setList((prev) => prev.filter((c) => c._id !== id));
  }

  if (loading) return <PageSkeleton page="customers" />;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Search, view, and manage customer profiles.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <UserPlus size={18} />
          <span className="hidden sm:inline">Add Customer</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search by name, mobile, email, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-11 text-base bg-white dark:bg-dark-800"
        />
      </div>

      {filteredList.length === 0 ? (
        <div className="card text-center py-16 border-dashed border-gray-300 dark:border-dark-500 bg-surface-50/50 dark:bg-dark-750/50">
          <div className="w-16 h-16 bg-gray-50 dark:bg-dark-750 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-gray-300 dark:text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-1">
            {searchQuery ? "No customers found" : "No customers yet"}
          </h3>
          <p className="text-sm text-gray-500 mb-5">
            {searchQuery ? `No results matching "${searchQuery}"` : "Start by adding your first customer."}
          </p>
          <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
            <UserPlus size={18} /> Add Customer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{filteredList.length} customer(s)</p>
          {filteredList.map((c) => (
            <div key={c._id} onClick={() => navigate(`/customers/${c._id}`)}
              className="card cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-750 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm flex-shrink-0">
                    {c.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{c.name}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-gray-500">
                      {c.mobile && <span className="flex items-center gap-1"><Phone size={12} /> {c.mobile}</span>}
                      {c.email && <span className="truncate">{c.email}</span>}
                      {c.customerId && <span className="text-xs text-gray-400">ID: {c.customerId}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm text-gray-500">{c.totalVisits || 0} visits</p>
                    <p className="text-sm font-semibold text-emerald-600">₹{(c.totalSpent || 0).toLocaleString()}</p>
                    {(c.pendingAmount || 0) > 0 && <p className="text-xs text-amber-500 font-medium">₹{c.pendingAmount} due</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      className="p-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-primary-600 dark:text-primary-400 transition-colors" title="Edit">
                      <Edit2 size={16} />
                    </button>
                    {!isStaff && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-colors" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    )}
                    <ArrowRight size={18} className="text-gray-300 dark:text-gray-600 ml-1" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Customer" : "Add Customer"} size="lg">
        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-3 py-2.5 rounded-lg text-sm mb-3">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name *</label>
              <input className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile *</label>
              <input className="input-field" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Alt Mobile</label>
              <input className="input-field" value={form.alternateMobile} onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
              <input className="input-field" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age</label>
              <input type="number" className="input-field" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
              <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tags</label>
              <input className="input-field" placeholder="tag1, tag2" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
              <textarea className="input-field" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-3 border-t border-gray-200 dark:border-dark-600">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Add Customer"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

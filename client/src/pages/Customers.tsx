import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useCachedData } from "../hooks/useCachedData";
import { invalidateCache } from "../hooks/useCache";
import Modal from "../components/Modal";
import PageSkeleton from "../components/PageSkeleton";
import { useAuth } from "../context/AuthContext";
import { Edit2, Trash2, UserPlus, Search, Phone, ArrowRight, Users, Plus, X, MapPin, Tag, Activity, IndianRupee, Eye, Calendar, MapPinned } from "lucide-react";

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
  const [showDetail, setShowDetail] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", alternateMobile: "", address: "", city: "", age: "", gender: "", tags: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { isStaff, user } = useAuth();
  const { data: rawList, loading, refetch } = useCachedData<Customer[]>("/api/customers?limit=1000", () => api.get("/api/customers?limit=1000"));
  const [recalculating, setRecalculating] = useState(false);

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
      if (res.success) { invalidateCache("/api/customers?limit=1000"); setShowForm(false); if (!editing && res.data?._id) navigate(`/customers/${res.data._id}`); }
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
        <div className="flex items-center gap-2">
          {!isStaff && (
            <button onClick={async () => {
              setRecalculating(true);
              const res = await api.post("/api/recalculate/customer-totals", {});
              if (res.success) {
                refetch(true);
                const d = res.data as any;
                alert(`Fixed ${d?.updated || 0} customer records`);
              } else {
                alert("Recalculation failed: " + (res.message || "Unknown error"));
              }
              setRecalculating(false);
            }} disabled={recalculating}
              className="btn-secondary flex items-center gap-1.5 text-sm">
              <Activity size={16} />
              {recalculating ? "Fixing..." : "Fix Data"}
            </button>
          )}
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 shadow-sm hover:shadow-lg">
            <Plus size={18} />
            <span className="hidden sm:inline">Add Customer</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input type="text" placeholder="Search by name, mobile, email, or ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="input-field pl-11 text-base"
        />
      </div>

      {filteredList.length === 0 ? (
        <div className="card text-center py-16 border-dashed border-slate-300 dark:border-slate-600">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={32} className="text-slate-300 dark:text-slate-500" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">
            {searchQuery ? "No customers found" : "No customers yet"}
          </h3>
          <p className="text-sm text-slate-500 mb-5">
            {searchQuery ? `No results matching "${searchQuery}"` : "Start by adding your first customer."}
          </p>
          <button onClick={openCreate} className="btn-primary inline-flex items-center gap-2">
            <UserPlus size={18} /> Add Customer
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">{filteredList.length} customer(s)</p>
          {filteredList.map((c) => (
            <div key={c._id} onClick={() => navigate(`/customers/${c._id}`)}
              className="group relative card cursor-pointer hover:-translate-y-0.5 hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-primary-500/[0.02] dark:to-primary-400/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

              <div className="relative flex items-center gap-4">
                <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base flex-shrink-0 shadow-sm overflow-hidden ${
                  (c.pendingAmount || 0) > 0
                    ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white"
                    : "bg-gradient-to-br from-primary-500 to-primary-600 text-white"
                }`}>
                  {c.name?.charAt(0)?.toUpperCase() || "?"}
                  {(c.pendingAmount || 0) > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{c.name}</h3>
                    {c.customerId && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono bg-slate-100 dark:bg-slate-700/50 px-1.5 py-0.5 rounded shrink-0">
                        #{c.customerId.replace("CUST-", "").slice(-6)}
                      </span>
                    )}
                    {c.age && (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">{c.age}y{c.gender ? `, ${c.gender}` : ""}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {c.mobile && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <Phone size={11} className="text-slate-400 dark:text-slate-500" />
                        {c.mobile.replace(/^0+/, "")}
                      </span>
                    )}
                    {c.city && (
                      <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <MapPinned size={11} className="text-slate-400 dark:text-slate-500" /> {c.city}
                      </span>
                    )}
                  </div>

                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.tags.slice(0, 3).map((t, i) => (
                        <span key={i} className="px-2 py-0.5 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-full text-[10px] font-medium">{t}</span>
                      ))}
                      {c.tags.length > 3 && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1">+{c.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-700/50 px-2.5 py-1 rounded-lg">
                      <Calendar size={12} className="text-slate-400 dark:text-slate-500" />
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{c.totalVisits || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">₹{(c.totalSpent || 0).toLocaleString()}</span>
                    </div>
                    {(c.pendingAmount || 0) > 0 ? (
                      <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-lg">
                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400">₹{(c.pendingAmount || 0).toLocaleString()} due</span>
                      </div>
                    ) : (c.totalVisits || 0) > 0 ? (
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium">Cleared</span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-0.5 -mr-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors" title="Edit">
                      <Edit2 size={13} />
                    </button>
                    {!isStaff && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
                        <Trash2 size={13} />
                      </button>
                    )}
                    <ArrowRight size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-primary-500 transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700/50 w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/50">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{editing ? "Edit Customer" : "Add Customer"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-300 px-3 py-2.5 rounded-xl text-sm mb-3">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="card p-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <UserPlus size={16} className="text-primary-500" /> Personal Info
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Name *</label>
                      <input className="input-field text-sm" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Age</label>
                      <input type="number" className="input-field text-sm" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Gender</label>
                      <select className="input-field text-sm" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                        <option value="">Select</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="card p-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <Phone size={16} className="text-primary-500" /> Contact
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Mobile *</label>
                      <input className="input-field text-sm" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Alt Mobile</label>
                      <input className="input-field text-sm" value={form.alternateMobile} onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Email</label>
                      <input type="email" className="input-field text-sm" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="card p-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <MapPin size={16} className="text-primary-500" /> Address
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Address</label>
                      <textarea className="input-field text-sm" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">City</label>
                      <input className="input-field text-sm" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="card p-4">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <Tag size={16} className="text-primary-500" /> Tags
                  </h3>
                  <input className="input-field text-sm" placeholder="tag1, tag2" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                  <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
                  <button type="submit" disabled={isLoading} className="btn-primary shadow-sm">{isLoading ? "Saving..." : editing ? "Update Customer" : "Add Customer"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Modal open={showDetail} onClose={() => setShowDetail(false)} title="Customer Details" size="lg">
        {detailCustomer && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-gradient-to-br from-primary-500/5 to-primary-500/10 rounded-2xl border border-primary-200/50 dark:border-primary-500/10">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
                {detailCustomer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{detailCustomer.name}</h2>
                <p className="text-sm text-slate-500">{detailCustomer.customerId && `ID: ${detailCustomer.customerId}`}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-emerald-50 dark:bg-emerald-500/5 rounded-xl p-3 border border-emerald-100 dark:border-emerald-500/10 text-center">
                <Activity size={16} className="text-emerald-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{detailCustomer.totalVisits || 0}</p>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-medium">Visits</p>
              </div>
              <div className="bg-blue-50 dark:bg-blue-500/5 rounded-xl p-3 border border-blue-100 dark:border-blue-500/10 text-center">
                <IndianRupee size={16} className="text-blue-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">₹{(detailCustomer.totalSpent || 0).toLocaleString()}</p>
                <p className="text-[10px] text-blue-600/70 dark:text-blue-400/70 font-medium">Spent</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-500/5 rounded-xl p-3 border border-amber-100 dark:border-amber-500/10 text-center">
                <IndianRupee size={16} className="text-amber-600 mx-auto mb-1" />
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">₹{(detailCustomer.pendingAmount || 0).toLocaleString()}</p>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-medium">Pending</p>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <UserPlus size={16} className="text-primary-500" /> Personal Info
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Age</p>
                  <p className="text-slate-700 dark:text-slate-300">{detailCustomer.age || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Gender</p>
                  <p className="text-slate-700 dark:text-slate-300">{detailCustomer.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Member Since</p>
                  <p className="text-slate-700 dark:text-slate-300">{detailCustomer.createdAt ? new Date(detailCustomer.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <Phone size={16} className="text-primary-500" /> Contact
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Mobile</p>
                  <p className="text-slate-700 dark:text-slate-300">{detailCustomer.mobile || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Alt Mobile</p>
                  <p className="text-slate-700 dark:text-slate-300">{detailCustomer.alternateMobile || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] text-slate-400 font-medium">Email</p>
                  <p className="text-slate-700 dark:text-slate-300">{detailCustomer.email || "—"}</p>
                </div>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <MapPin size={16} className="text-primary-500" /> Address
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300">{detailCustomer.address ? `${detailCustomer.address}${detailCustomer.city ? `, ${detailCustomer.city}` : ""}` : "—"}</p>
            </div>

            {detailCustomer.tags && detailCustomer.tags.length > 0 && (
              <div className="card p-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <Tag size={16} className="text-primary-500" /> Tags
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {detailCustomer.tags.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 rounded-lg text-[11px] font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/50">
              <button onClick={() => setShowDetail(false)} className="btn-secondary">Close</button>
              <button onClick={() => { setShowDetail(false); openEdit(detailCustomer); }}
                className="btn-primary flex items-center gap-2 shadow-sm">
                <Edit2 size={16} /> Edit
              </button>
              <button onClick={() => { setShowDetail(false); navigate(`/customers/${detailCustomer._id}`); }}
                className="btn-primary flex items-center gap-2 shadow-sm bg-gradient-to-r from-primary-500 to-primary-600">
                <Eye size={16} /> View Full Profile
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

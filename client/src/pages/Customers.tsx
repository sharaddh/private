import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { invalidateCache } from "../hooks/useCache";
import Modal from "../components/Modal";
import PageSkeleton from "../components/PageSkeleton";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useTranslate } from "../context/TranslateContext";
import { Edit2, Trash2, UserPlus, Search, Phone, ArrowRight, Users, Plus, X, MapPin, Tag, Activity, IndianRupee, Eye, Calendar, MapPinned } from "lucide-react";

interface Customer {
  _id: string; customerId: string; name: string; email?: string;
  mobile?: string; alternateMobile?: string; address?: string; city?: string;
  age?: number; gender?: string; tags?: string[];
  totalVisits?: number; totalSpent?: number; pendingAmount?: number; createdAt: string;
}

export default function Customers() {
  const toast = useToast();
  const [list, setList] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
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
  const { uiT } = useTranslate();
  const [recalculating, setRecalculating] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/customers?limit=1000");
      const raw = res.data as any;
      const customers = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
      setList(customers);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const refetch = useCallback((invalidate?: boolean) => {
    if (invalidate) invalidateCache("/api/customers?limit=1000");
    fetchCustomers();
  }, [fetchCustomers]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return list;
    const lower = q.toLowerCase();
    return list.filter((c) =>
      c.name?.toLowerCase().includes(lower) || c.mobile?.includes(q) ||
      c.customerId?.toLowerCase().includes(lower) || c.email?.toLowerCase().includes(lower)
    );
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
      else setError(res.message || uiT("Operation failed", "ऑपरेशन विफल"));
    } catch { setError(uiT("An error occurred", "एक त्रुटि हुई")); }
    finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm(uiT("Are you sure you want to delete this customer?", "क्या आप वाकई इस ग्राहक को हटाना चाहते हैं?"))) return;
    const res = await api.del(`/api/customers/${id}`);
    if (res.success) setList((prev) => prev.filter((c) => c._id !== id));
  }

  if (loading) return <PageSkeleton page="customers" />;

  return (
    <div className="min-h-screen bg-th-base text-th-text p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-th-text tracking-tight">{uiT("Customers", "ग्राहक")}</h1>
          <p className="text-sm text-th-secondary mt-0.5">{uiT("Search, view, and manage customer profiles.", "ग्राहक प्रोफ़ाइल खोजें, देखें और प्रबंधित करें।")}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isStaff && (
            <button onClick={async () => {
              setRecalculating(true);
              const res = await api.post("/api/recalculate/customer-totals", {});
              if (res.success) {
                refetch(true);
                const d = res.data as any;
                toast.success(`${uiT("Fixed", "ठीक किया")} ${d?.updated || 0} ${uiT("customer records", "ग्राहक रिकॉर्ड")}`);
              } else {
                toast.error(`${uiT("Recalculation failed", "पुनर्गणना विफल")}: ` + (res.message || uiT("Unknown error", "अज्ञात त्रुटि")));
              }
              setRecalculating(false);
            }} disabled={recalculating}
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-colors disabled:opacity-50">
              <Activity size={14} />
              {recalculating ? uiT("Fixing...", "सुधार हो रहा है...") : uiT("Fix Data", "डेटा ठीक करें")}
            </button>
          )}
          <button onClick={openCreate} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
            <Plus size={16} />
            <span>{uiT("Add Customer", "ग्राहक जोड़ें")}</span>
          </button>
        </div>
      </div>

      <div className="relative mt-6">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-th-secondary pointer-events-none" />
        <input type="text" placeholder={uiT("Search by name, mobile, email, or ID...", "नाम, मोबाइल, ईमेल या आईडी से खोजें...")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-th-elevated text-th-text placeholder-[#a7a7a7] pl-11 pr-4 py-3 rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#1ed760] transition-shadow"
        />
        {searchQuery.trim() && (
          <div className="absolute z-40 top-full mt-1 w-full bg-th-hover rounded-lg max-h-80 overflow-y-auto shadow-xl">
            {filteredList.length > 0 ? (
              <>
                <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-th-secondary border-b border-th-border">
                  {filteredList.length} {uiT("matching customer(s)", "मिलान हो रहा है ग्राहक")}
                </div>
                {filteredList.map((c) => (
                  <div key={c._id}
                    onClick={() => navigate(`/customers/${c._id}`)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-th-elevated cursor-pointer transition-colors border-b border-th-border last:border-b-0"
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                      (c.pendingAmount || 0) > 0
                        ? "bg-[#e8a427] text-black"
                        : "bg-[#1ed760] text-black"
                    }`}>
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-th-text truncate">{c.name}</span>
                        {c.customerId && (
                          <span className="text-[10px] text-th-secondary font-mono bg-th-elevated px-1.5 py-0.5 rounded-lg">
                            #{c.customerId.replace("CUST-", "").slice(-6)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.mobile && (
                          <span className="flex items-center gap-1 text-xs text-th-secondary">
                            <Phone size={10} /> {c.mobile.replace(/^0+/, "")}
                          </span>
                        )}
                        {c.city && (
                          <span className="flex items-center gap-1 text-xs text-th-secondary">
                            <MapPinned size={10} /> {c.city}
                          </span>
                        )}
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-[#535353] flex-shrink-0" />
                  </div>
                ))}
              </>
            ) : (
              <div className="px-4 py-3 text-sm text-th-secondary">
                {uiT("No customers matching", "कोई ग्राहक मेल नहीं खा रहा")} "{searchQuery}"
              </div>
            )}
            <div
              onClick={() => { setSearchQuery(""); openCreate(); }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-th-elevated cursor-pointer transition-colors rounded-b-lg"
            >
              <div className="w-9 h-9 rounded-full bg-[#1ed760] text-black flex items-center justify-center flex-shrink-0">
                <Plus size={16} />
              </div>
              <span className="font-semibold text-sm text-[#1ed760]">{uiT("Add Customer", "ग्राहक जोड़ें")}</span>
            </div>
          </div>
        )}
      </div>

      {filteredList.length === 0 ? (
        <div className="bg-th-surface rounded-lg text-center py-16 mt-6">
          <div className="w-16 h-16 bg-th-hover rounded-full flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-[#535353]" />
          </div>
          <h3 className="text-lg font-bold text-th-text mb-1">
            {searchQuery ? uiT("No customers found", "कोई ग्राहक नहीं मिला") : uiT("No customers yet", "अभी तक कोई ग्राहक नहीं")}
          </h3>
          <p className="text-sm text-th-secondary mb-5">
            {searchQuery ? `${uiT("No results matching", "कोई परिणाम मेल नहीं खा रहा")} "${searchQuery}"` : uiT("Start by adding your first customer.", "अपना पहला ग्राहक जोड़कर शुरू करें।")}
          </p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-colors">
            <UserPlus size={16} /> {uiT("Add Customer", "ग्राहक जोड़ें")}
          </button>
        </div>
      ) : (
        <div className="space-y-2 mt-6">
          <p className="text-[11px] font-bold uppercase tracking-wider text-th-secondary">{filteredList.length} {uiT("customer(s)", "ग्राहक")}</p>
          {filteredList.map((c) => (
            <div key={c._id} onClick={() => navigate(`/customers/${c._id}`)}
              className="group relative bg-th-surface rounded-lg cursor-pointer hover:bg-th-hover active:scale-[0.99] transition-all duration-150 overflow-hidden"
            >
              <div className="relative flex items-center gap-4 p-4">
                <div className={`relative w-11 h-11 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 overflow-hidden ${
                  (c.pendingAmount || 0) > 0
                    ? "bg-[#e8a427] text-black"
                    : "bg-[#1ed760] text-black"
                }`}>
                  {c.name?.charAt(0)?.toUpperCase() || "?"}
                  {(c.pendingAmount || 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-th-surface" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-th-text truncate">{c.name}</h3>
                    {c.customerId && (
                      <span className="text-[10px] text-th-secondary font-mono bg-th-elevated px-1.5 py-0.5 rounded-lg shrink-0">
                        #{c.customerId.replace("CUST-", "").slice(-6)}
                      </span>
                    )}
                    {c.age && (
                      <span className="text-[11px] text-th-secondary shrink-0">{c.age}y{c.gender ? `, ${c.gender}` : ""}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                    {c.mobile && (
                      <span className="flex items-center gap-1 text-xs text-th-secondary">
                        <Phone size={11} className="text-th-secondary" />
                        {c.mobile.replace(/^0+/, "")}
                      </span>
                    )}
                    {c.city && (
                      <span className="flex items-center gap-1 text-xs text-th-secondary">
                        <MapPinned size={11} className="text-th-secondary" /> {c.city}
                      </span>
                    )}
                  </div>

                  {c.tags && c.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {c.tags.slice(0, 3).map((t, i) => (
                        <span key={t} className="px-2 py-0.5 bg-[#1ed760]/10 text-[#1ed760] rounded-lg text-[10px] font-medium">{t}</span>
                      ))}
                      {c.tags.length > 3 && (
                        <span className="text-[10px] text-th-secondary px-1">+{c.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="flex items-center gap-1.5 bg-th-elevated px-2.5 py-1 rounded-lg">
                      <Calendar size={11} className="text-th-secondary" />
                      <span className="text-xs font-bold text-th-secondary">{c.totalVisits || 0}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-[#1ed760]/10 px-2.5 py-1 rounded-lg">
                      <span className="text-xs font-bold text-[#1ed760]">₹{(c.totalSpent || 0).toLocaleString()}</span>
                    </div>
                    {(c.pendingAmount || 0) > 0 ? (
                      <div className="flex items-center gap-1 bg-[#e8a427]/10 px-2 py-0.5 rounded-lg">
                        <span className="text-[10px] font-semibold text-[#e8a427]">₹{(c.pendingAmount || 0).toLocaleString()} {uiT("due", "बकाया")}</span>
                      </div>
                    ) : (c.totalVisits || 0) > 0 ? (
                      <span className="text-[10px] text-[#1ed760] font-medium">{uiT("Cleared", "चुकता")}</span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-0.5 -mr-1">
                    <button onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      className="p-1.5 hover:bg-th-elevated rounded-full text-th-secondary hover:text-[#1ed760] transition-colors" title={uiT("Edit", "संपादित करें")}>
                      <Edit2 size={13} />
                    </button>
                    {!isStaff && (
                      <button onClick={(e) => { e.stopPropagation(); handleDelete(c._id); }}
                        className="p-1.5 hover:bg-red-500/10 rounded-full text-th-secondary hover:text-red-400 transition-colors" title={uiT("Delete", "हटाएं")}>
                        <Trash2 size={13} />
                      </button>
                    )}
                    <ArrowRight size={14} className="text-[#535353] group-hover:text-[#1ed760] transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-th-surface rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
              <h3 className="text-base font-bold text-th-text">{editing ? uiT("Edit", "संपादित करें") : uiT("Add Customer", "ग्राहक जोड़ें")}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-th-elevated rounded-full text-th-secondary hover:text-th-text transition-colors"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {error && <div className="bg-red-500/10 border border-red-500/20 text-red-300 px-3 py-2.5 rounded-lg text-sm mb-3">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <UserPlus size={14} className="text-[#1ed760]" /> {uiT("Personal Info", "व्यक्तिगत जानकारी")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1">{uiT("Name", "नाम")} *</label>
                      <input className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1">{uiT("Age", "आयु")}</label>
                      <input type="number" className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1">{uiT("Gender", "लिंग")}</label>
                      <select className="w-full bg-th-hover text-th-text px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                        <option value="">{uiT("Select", "चुनें")}</option>
                        <option value="Male">{uiT("Male", "पुरुष")}</option>
                        <option value="Female">{uiT("Female", "महिला")}</option>
                        <option value="Other">{uiT("Other", "अन्य")}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <Phone size={14} className="text-[#1ed760]" /> {uiT("Contact", "संपर्क")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1">{uiT("Mobile", "मोबाइल")} *</label>
                      <input className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1">{uiT("Alt Mobile", "वैकल्पिक मोबाइल")}</label>
                      <input className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={form.alternateMobile} onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1">{uiT("Email", "ईमेल")}</label>
                      <input type="email" className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <MapPin size={14} className="text-[#1ed760]" /> {uiT("Address", "पता")}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1">{uiT("Address", "पता")}</label>
                      <textarea className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1">{uiT("City", "शहर")}</label>
                      <input className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </div>
                  </div>
                </div>

                <div className="bg-th-elevated rounded-lg p-4">
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                    <Tag size={14} className="text-[#1ed760]" /> {uiT("Tags", "टैग")}
                  </h3>
                  <input className="w-full bg-th-hover text-th-text placeholder-[#a7a7a7] px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" placeholder="tag1, tag2" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-th-border">
                  <button type="button" onClick={() => setShowForm(false)} className="text-[11px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-colors">{uiT("Cancel", "रद्द करें")}</button>
                  <button type="submit" disabled={isLoading} className="text-[11px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform disabled:opacity-50">{isLoading ? uiT("Saving...", "सहेजा जा रहा है...") : editing ? uiT("Edit", "संपादित करें") : uiT("Add Customer", "ग्राहक जोड़ें")}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <Modal open={showDetail} onClose={() => setShowDetail(false)} title={uiT("Customer Details", "ग्राहक विवरण")} size="lg">
        {detailCustomer && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-th-elevated rounded-lg">
              <div className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center text-black font-bold text-xl">
                {detailCustomer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <h2 className="text-xl font-bold text-th-text">{detailCustomer.name}</h2>
                <p className="text-sm text-th-secondary">{detailCustomer.customerId && `ID: ${detailCustomer.customerId}`}</p>
              </div>
            </div>

              <div className="grid grid-cols-3 gap-3">
              <div className="bg-th-elevated rounded-lg p-3 text-center">
                <Activity size={16} className="text-[#1ed760] mx-auto mb-1" />
                <p className="text-lg font-bold text-th-text">{detailCustomer.totalVisits || 0}</p>
                <p className="text-[10px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Visits", "विज़िट")}</p>
              </div>
              <div className="bg-th-elevated rounded-lg p-3 text-center">
                <IndianRupee size={16} className="text-[#1ed760] mx-auto mb-1" />
                <p className="text-lg font-bold text-[#1ed760]">₹{(detailCustomer.totalSpent || 0).toLocaleString()}</p>
                <p className="text-[10px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Spent", "खर्च")}</p>
              </div>
              <div className="bg-th-elevated rounded-lg p-3 text-center">
                <IndianRupee size={16} className="text-[#e8a427] mx-auto mb-1" />
                <p className="text-lg font-bold text-[#e8a427]">₹{(detailCustomer.pendingAmount || 0).toLocaleString()}</p>
                <p className="text-[10px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Pending", "बाकी")}</p>
              </div>
            </div>

            <div className="bg-th-surface rounded-lg p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                <UserPlus size={14} className="text-[#1ed760]" /> {uiT("Personal Info", "व्यक्तिगत जानकारी")}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Age", "आयु")}</p>
                  <p className="text-th-text">{detailCustomer.age || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Gender", "लिंग")}</p>
                  <p className="text-th-text">{detailCustomer.gender || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Member Since", "सदस्य तब से")}</p>
                  <p className="text-th-text">{detailCustomer.createdAt ? new Date(detailCustomer.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                </div>
              </div>
            </div>

            <div className="bg-th-surface rounded-lg p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                <Phone size={14} className="text-[#1ed760]" /> {uiT("Contact", "संपर्क")}
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Mobile", "मोबाइल")}</p>
                  <p className="text-th-text">{detailCustomer.mobile || "—"}</p>
                </div>
                <div>
                  <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Alt Mobile", "वैकल्पिक मोबाइल")}</p>
                  <p className="text-th-text">{detailCustomer.alternateMobile || "—"}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Email", "ईमेल")}</p>
                  <p className="text-th-text">{detailCustomer.email || "—"}</p>
                </div>
              </div>
            </div>

            <div className="bg-th-surface rounded-lg p-4">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                <MapPin size={14} className="text-[#1ed760]" /> {uiT("Address", "पता")}
              </h3>
              <p className="text-sm text-th-secondary">{detailCustomer.address ? `${detailCustomer.address}${detailCustomer.city ? `, ${detailCustomer.city}` : ""}` : "—"}</p>
            </div>

            {detailCustomer.tags && detailCustomer.tags.length > 0 && (
              <div className="bg-th-surface rounded-lg p-4">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                  <Tag size={14} className="text-[#1ed760]" /> {uiT("Tags", "टैग")}
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {detailCustomer.tags.map((t, i) => (
                    <span key={t} className="px-2 py-0.5 bg-[#1ed760]/10 text-[#1ed760] rounded-lg text-[11px] font-medium">{t}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-th-border">
              <button onClick={() => setShowDetail(false)} className="text-[11px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-colors">{uiT("Close", "बंद करें")}</button>
              <button onClick={() => { setShowDetail(false); openEdit(detailCustomer); }}
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
                <Edit2 size={14} /> {uiT("Edit", "संपादित करें")}
              </button>
              <button onClick={() => { setShowDetail(false); navigate(`/customers/${detailCustomer._id}`); }}
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
                <Eye size={14} /> {uiT("View Full Profile", "पूरी प्रोफ़ाइल देखें")}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

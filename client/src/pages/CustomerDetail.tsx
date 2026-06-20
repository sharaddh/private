import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, DollarSign, Eye, ClipboardList,
  ShoppingCart, Edit3, Plus, Save, X, MessageCircle, FileText, User
} from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [customer, setCustomer] = useState<any>(null);
  const [visits, setVisits] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [bills, setBills] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [tab, setTab] = useState<"overview" | "visits" | "prescriptions" | "bills" | "orders">("overview");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/customers/${id}`), api.get(`/api/visits?customerId=${id}`),
      api.get(`/api/prescriptions?customerId=${id}`), api.get(`/api/bills?customerId=${id}`),
      api.get(`/api/orders?customerId=${id}`), api.get("/api/settings"),
    ]).then(([c, v, p, b, o, s]) => {
      if (c.success) { setCustomer(c.data); setEditForm(c.data); }
      if (v.success) setVisits(v.data);
      if (p.success) setPrescriptions(p.data);
      if (b.success) setBills(b.data || []);
      if (o.success) setOrders(o.data || []);
      if (s.success) setSettings(s.data);
    });
  }, [id]);

  useEffect(() => {
    const visitId = searchParams.get("visitId");
    if (visitId && visits.length > 0) {
      setTab("visits");
      setTimeout(() => {
        const el = document.getElementById(`visit-${visitId}`);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
  }, [searchParams, visits]);

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-[3px] border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function handleEditSave() {
    setSaving(true);
    try {
      const payload = {
        name: editForm.name, email: editForm.email || undefined, mobile: editForm.mobile || undefined,
        alternateMobile: editForm.alternateMobile || undefined, address: editForm.address || undefined,
        city: editForm.city || undefined, age: editForm.age ? Number(editForm.age) : undefined,
        gender: editForm.gender || undefined, tags: editForm.tags || undefined,
      };
      const res = await api.put(`/api/customers/${id}`, payload);
      if (res.success) { setCustomer(res.data); setEditing(false); }
    } finally { setSaving(false); }
  }

  function sendWhatsApp(phone: string, bill: any) {
    const num = phone.replace(/\D/g, "");
    if (!num) return;
    const adminNum = settings?.adminWhatsApp?.replace(/\D/g, "") || "91";
    const items = (bill?.items || []).map((i: any) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("%0a");
    const msg = `*${settings?.shopName || "KMJ Optical"}* 🕶%0a%0a*Bill:* ${bill?.billNumber || ""}%0a*Date:* ${new Date().toLocaleDateString("en-IN")}%0a%0a*Customer:* ${customer?.name || ""}%0a*Mobile:* ${customer?.mobile || ""}%0a%0a*Items:*%0a${items}%0a%0a*Subtotal:* ₹${(bill?.subtotal || 0).toFixed(0)}%0a${bill?.discount ? `*Discount:* -₹${bill.discount.toFixed(0)}%0a` : ""}${bill?.tax ? `*Tax:* +₹${bill.tax.toFixed(0)}%0a` : ""}*Total:* ₹${(bill?.totalAmount || 0).toFixed(0)}%0a*Paid:* ₹${(bill?.advancePaid || 0).toFixed(0)}%0a*Pending:* ₹${(bill?.pendingAmount || 0).toFixed(0)}%0a%0aThank you! 🙏`;
    window.open(`https://wa.me/${adminNum}?text=${msg}`, "_blank");
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: User },
    { key: "visits", label: `Visits (${visits.length})`, icon: ClipboardList },
    { key: "prescriptions", label: `Prescriptions (${prescriptions.length})`, icon: Eye },
    { key: "bills", label: `Bills (${bills.length})`, icon: DollarSign },
    { key: "orders", label: `Orders (${orders.length})`, icon: ShoppingCart },
  ] as const;

  return (
    <div className="page-container">
      <button onClick={() => navigate("/customers")}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors mb-1">
        <ArrowLeft size={16} /> Back to Customers
      </button>

      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-2xl flex-shrink-0">
              {customer.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div className="flex-1">
              {editing ? (
                <div className="space-y-3 max-w-lg">
                  <input className="input-field text-lg font-bold" value={editForm.name || ""}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <input className="input-field" placeholder="Mobile" value={editForm.mobile || ""}
                      onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
                    <input className="input-field" placeholder="Email" value={editForm.email || ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    <input className="input-field" placeholder="Age" type="number" value={editForm.age || ""}
                      onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} />
                    <select className="input-field" value={editForm.gender || ""}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                      <option value="">Gender</option>
                      <option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                    </select>
                    <input className="input-field" placeholder="City" value={editForm.city || ""}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                    <input className="input-field" placeholder="Alt Mobile" value={editForm.alternateMobile || ""}
                      onChange={(e) => setEditForm({ ...editForm, alternateMobile: e.target.value })} />
                    <div className="col-span-2">
                      <textarea className="input-field" placeholder="Address" rows={2} value={editForm.address || ""}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleEditSave} disabled={saving} className="btn-success btn-sm flex items-center gap-1.5">
                      <Save size={15} /> {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-secondary btn-sm flex items-center gap-1.5">
                      <X size={15} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{customer.name}</h1>
                  <p className="text-sm text-gray-500">{customer.customerId || "—"}</p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3">
                    {customer.mobile && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <Phone size={14} className="text-gray-400" /> {customer.mobile}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <Mail size={14} className="text-gray-400" /> {customer.email}
                      </span>
                    )}
                    {customer.city && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                        <MapPin size={14} className="text-gray-400" /> {customer.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar size={14} className="text-gray-400" /> Joined {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </span>
                    {customer.age && <span className="text-sm text-gray-600 dark:text-gray-400">Age: {customer.age}</span>}
                    {customer.gender && <span className="text-sm text-gray-600 dark:text-gray-400">{customer.gender}</span>}
                  </div>
                  {customer.address && <p className="text-sm text-gray-500 mt-2">{customer.address}</p>}
                  {customer.alternateMobile && <p className="text-sm text-gray-500 mt-1">Alt: {customer.alternateMobile}</p>}
                  {customer.tags?.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {customer.tags.map((tag: string, i: number) => (
                        <span key={i} className="badge-blue">{tag}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-ghost text-sm gap-1.5">
              <Edit3 size={15} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center py-5">
          <p className="stat-value text-gray-900 dark:text-white">{customer.totalVisits || 0}</p>
          <p className="text-sm text-gray-500">Total Visits</p>
        </div>
        <div className="card text-center py-5">
          <p className="stat-value text-emerald-600">₹{(customer.totalSpent || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Total Spent</p>
        </div>
        <div className="card text-center py-5">
          <p className="stat-value text-amber-500">₹{(customer.pendingAmount || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Pending Amount</p>
        </div>
        <div className="card text-center py-5 flex flex-col items-center justify-center">
          <button onClick={() => navigate(`/customers/${id}/new-visit`)} className="btn-primary btn-sm flex items-center gap-2">
            <Plus size={16} /> New Visit
          </button>
          <p className="text-xs text-gray-400 mt-2">with prescription</p>
        </div>
      </div>

      <div className="border-b border-gray-100 dark:border-dark-700">
        <div className="flex gap-0 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                  isActive ? "border-primary-500 dark:border-primary-400 text-primary-600 dark:text-primary-400" : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                }`}>
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {tab === "overview" && (
          <div className="card space-y-5">
            <h3 className="section-title">Customer Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">Last 5 Visits</p>
                {visits.slice(0, 5).length > 0 ? (
                  <div className="space-y-2">
                    {visits.slice(0, 5).map((v: any) => (
                      <div key={v._id} className="flex items-center gap-2 text-sm">
                        <Calendar size={13} className="text-gray-400" />
                        <span className="font-medium text-gray-800 dark:text-gray-200">{new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {v.doctorName && <span className="text-gray-500">— {v.doctorName}</span>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400">No visits</p>}
              </div>
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">Latest Prescription</p>
                {prescriptions.length > 0 ? (
                  <div className="text-sm space-y-1">
                    <p className="text-gray-800 dark:text-gray-200">RE: SPH {prescriptions[0].rightEye?.dv?.sph ?? "—"} / CYL {prescriptions[0].rightEye?.dv?.cyl ?? "—"}</p>
                    <p className="text-gray-800 dark:text-gray-200">LE: SPH {prescriptions[0].leftEye?.dv?.sph ?? "—"} / CYL {prescriptions[0].leftEye?.dv?.cyl ?? "—"}</p>
                    {prescriptions[0].pd && <p className="text-gray-400">PD: {prescriptions[0].pd}</p>}
                  </div>
                ) : <p className="text-sm text-gray-400">No prescriptions</p>}
              </div>
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">Recent Orders</p>
                {orders.slice(0, 5).length > 0 ? (
                  <div className="space-y-2">
                    {orders.slice(0, 5).map((o: any) => (
                      <div key={o._id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800 dark:text-gray-200">{o.frame || o.lens || "Order"}</span>
                        <span className={`badge ${
                          o.status === "Delivered" ? "badge-green" :
                          o.status === "Ready" ? "badge-blue" :
                          o.status === "Cancelled" ? "badge-red" : "badge-yellow"
                        }`}>{o.status}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400">No orders</p>}
              </div>
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500 mb-3">Recent Bills</p>
                {bills.slice(0, 5).length > 0 ? (
                  <div className="space-y-2">
                    {bills.slice(0, 5).map((b: any) => (
                      <div key={b._id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-800 dark:text-gray-200">{b.billNumber}</span>
                        <span className="font-semibold text-gray-900 dark:text-white">₹{(b.totalAmount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400">No bills</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "visits" && (
          <div className="card">
            <div className="card-header">
              <h3 className="section-title">All Visits ({visits.length})</h3>
              <button onClick={() => navigate(`/customers/${id}/new-visit`)} className="btn-primary btn-sm flex items-center gap-1.5">
                <Plus size={15} /> Add Visit
              </button>
            </div>
            {visits.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No visits recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {visits.map((v: any) => (
                  <div key={v._id} id={`visit-${v._id}`}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-750 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-full flex items-center justify-center text-gray-400">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {v.visitType && <span className="badge-gray text-[10px]">{v.visitType}</span>}
                        </div>
                        {v.doctorName && <p className="text-xs text-gray-500 mt-0.5">Doctor: {v.doctorName}</p>}
                        {v.remarks && <p className="text-xs text-gray-500">{v.remarks}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "prescriptions" && (
          <div className="space-y-4">
            <div className="card-header">
              <h3 className="section-title">Prescriptions ({prescriptions.length})</h3>
              <button onClick={() => navigate(`/customers/${id}/new-visit`)} className="btn-primary btn-sm flex items-center gap-1.5">
                <Plus size={15} /> Add Prescription
              </button>
            </div>
            {prescriptions.length === 0 ? (
              <div className="card"><p className="text-gray-400 text-sm text-center py-8">No prescriptions yet.</p></div>
            ) : (
              prescriptions.map((p: any) => (
                <div key={p._id} className="card">
                  <p className="text-xs text-gray-400 mb-4">{new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Right Eye</p>
                      {p.rightEye?.dv && <EyeRow label="DV" data={p.rightEye.dv} />}
                      {p.rightEye?.nv && <EyeRow label="NV" data={p.rightEye.nv} />}
                      {p.rightEye?.pc && <EyeRow label="PC" data={p.rightEye.pc} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Left Eye</p>
                      {p.leftEye?.dv && <EyeRow label="DV" data={p.leftEye.dv} />}
                      {p.leftEye?.nv && <EyeRow label="NV" data={p.leftEye.nv} />}
                      {p.leftEye?.pc && <EyeRow label="PC" data={p.leftEye.pc} />}
                    </div>
                  </div>
                  {p.pd && <p className="text-sm text-gray-500 mt-3">PD: {p.pd}</p>}
                  {p.notes && <p className="text-sm text-gray-500 mt-1">Notes: {p.notes}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "bills" && (
          <div className="card">
            <h3 className="section-title mb-4">Bills ({bills.length})</h3>
            {bills.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No bills yet.</p>
            ) : (
              <div className="space-y-2">
                {bills.map((b: any) => (
                  <div key={b._id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-750">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-gray-400" />
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{b.billNumber || "—"}</p>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">₹{(b.totalAmount || 0).toLocaleString()}</p>
                      <p className="text-xs" style={{ color: (b.pendingAmount || 0) > 0 ? "#d97706" : "#059669" }}>
                        {(b.pendingAmount || 0) > 0 ? `Pending: ₹${b.pendingAmount}` : "Paid"}
                      </p>
                      <button onClick={() => sendWhatsApp(customer.mobile, b)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 mt-1 flex items-center gap-1">
                        <MessageCircle size={11} /> Send
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="card">
            <h3 className="section-title mb-4">Orders ({orders.length})</h3>
            {orders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {orders.map((o: any) => (
                  <div key={o._id} className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-750">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {[o.frameBrand, o.frame, o.lensBrand, o.lens].filter(Boolean).join(" / ") || "Order"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Qty: {o.quantity || 1}</p>
                      {o.deliveryDate && <p className="text-xs text-gray-400">Delivery: {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>}
                    </div>
                    <span className={`badge ${
                      o.status === "Delivered" ? "badge-green" :
                      o.status === "Cancelled" ? "badge-red" :
                      o.status === "Ready" ? "badge-blue" : "badge-yellow"
                    }`}>{o.status || "Draft"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EyeRow({ label, data }: { label: string; data: any }) {
  return (
    <div className="text-xs text-gray-600 dark:text-gray-400 mb-1.5">
      <span className="font-medium text-gray-700 dark:text-gray-300">{label}: </span>
      SPH: {data.sph ?? "—"} CYL: {data.cyl ?? "—"} AXIS: {data.axis ?? "—"} {data.va ? `VA: ${data.va}` : ""}
    </div>
  );
}

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Receipt, Eye, ClipboardList,
  ShoppingCart, Edit3, Plus, Save, X, MessageCircle, FileText, User,
  ChevronRight, Clock, Activity, AlertCircle, CheckCircle
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
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [editingVisit, setEditingVisit] = useState(false);
  const [editVisitForm, setEditVisitForm] = useState<any>({});
  const [savingVisit, setSavingVisit] = useState(false);
  const [editingBillAdvance, setEditingBillAdvance] = useState(false);
  const [editBillAdvanceAmount, setEditBillAdvanceAmount] = useState(0);
  const [savingBillAdvance, setSavingBillAdvance] = useState(false);

  const linkedPrescription = useMemo(() => {
    if (!selectedVisit) return null;
    return prescriptions.find((p: any) => p.visitId === selectedVisit._id) || null;
  }, [selectedVisit, prescriptions]);

  const linkedOrder = useMemo(() => {
    if (!selectedVisit) return null;
    return orders.find((o: any) => o.visitId === selectedVisit._id) || null;
  }, [selectedVisit, orders]);

  const linkedBill = useMemo(() => {
    if (!selectedVisit) return null;
    return bills.find((b: any) => b.visitId === selectedVisit._id) || null;
  }, [selectedVisit, bills]);

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

  if (!customer) return <PageSkeleton page="customerdetail" />;

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

  async function handleVisitSave() {
    setSavingVisit(true);
    try {
      const res = await api.put(`/api/visits/${selectedVisit._id}`, editVisitForm);
      if (res.success) {
        setSelectedVisit(res.data);
        setVisits((prev: any[]) => prev.map((v: any) => v._id === res.data._id ? res.data : v));
        setEditingVisit(false);
      }
    } finally {
      setSavingVisit(false);
    }
  }

  async function handleBillAdvanceSave() {
    setSavingBillAdvance(true);
    try {
      const res: any = await api.put(`/api/bills/${linkedBill._id}`, {
        advancePaid: Number(editBillAdvanceAmount),
      });
      if (res.success) {
        setBills((prev: any[]) => prev.map((b: any) => b._id === res.data._id ? res.data : b));
        setEditingBillAdvance(false);
        // Refresh customer to get updated pendingAmount
        const custRes: any = await api.get(`/api/customers/${id}`);
        if (custRes.success) setCustomer(custRes.data);
        // Also update linked payment if exists
        const paymentsRes: any = await api.get(`/api/payments?billId=${linkedBill._id}`);
        if (paymentsRes.success && paymentsRes.data?.length > 0) {
          const payment = paymentsRes.data[0];
          await api.put(`/api/payments/${payment._id}`, {
            amount: Number(editBillAdvanceAmount),
          });
        }
      }
    } finally {
      setSavingBillAdvance(false);
    }
  }

  function openVisitDetail(v: any) {
    setSelectedVisit(v);
    setEditVisitForm({ visitDate: v.visitDate?.split("T")[0] || "", doctorName: v.doctorName || "", remarks: v.remarks || "" });
    setEditingVisit(false);
    setEditingBillAdvance(false);
  }

  async function sendWhatsApp(phone: string, bill: any) {
    const num = phone.replace(/\D/g, "");
    if (!num) return;
    const fullNum = num.length === 10 ? `91${num}` : num;
    const shop = settings?.shopName || "KMJ Optical";
    const custData = { name: customer?.name, mobile: customer?.mobile, address: customer?.address, customerId: customer?.customerId };
    try {
      if (bill) {
        const { generateBillPdf } = await import("../utils/pdf");
        const doc = generateBillPdf(bill, custData, settings || {});
        const base64 = doc.output("datauristring").split(",")[1];
        const caption = `*${shop}*\n\nHi ${customer?.name || ""},\nPlease find your bill attached.\n\nThank you!`;
        const mediaRes = await api.post("/api/whatsapp/send-media", { phone: fullNum, base64, filename: `Bill-${bill.billNumber || "invoice"}.pdf`, caption });
        if (mediaRes.success) return;
        console.warn("WhatsApp PDF send failed:", mediaRes?.message);
      }
    } catch (e) {
      console.warn("WhatsApp PDF send error:", e);
    }
    const items = (bill?.items || []).map((i: any) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("\n");
    const msg = `*${shop}* 🕶\n\n*Bill:* ${bill?.billNumber || ""}\n*Date:* ${new Date().toLocaleDateString("en-IN")}\n\n*Customer:* ${customer?.name || ""}\n*Mobile:* ${customer?.mobile || ""}\n\n*Items:*\n${items}\n\n*Subtotal:* ₹${(bill?.subtotal || 0).toFixed(0)}${bill?.discount ? `\n*Discount:* -₹${bill.discount.toFixed(0)}` : ""}${bill?.tax ? `\n*Tax:* +₹${bill.tax.toFixed(0)}` : ""}\n*Total:* ₹${(bill?.totalAmount || 0).toFixed(0)}\n*Paid:* ₹${(bill?.advancePaid || 0).toFixed(0)}\n*Pending:* ₹${(bill?.pendingAmount || 0).toFixed(0)}\n\nThank you! 🙏`;
    try { await api.post("/api/whatsapp/send", { phone: fullNum, message: msg }); } catch {};
  }

  const tabs = [
    { key: "overview", label: "Overview", icon: User },
    { key: "visits", label: `Visits (${visits.length})`, icon: ClipboardList },
    { key: "prescriptions", label: `Prescriptions (${prescriptions.length})`, icon: Eye },
    { key: "bills", label: `Bills (${bills.length})`, icon: Receipt },
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
            <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-2xl flex-shrink-0">
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
            <button onClick={() => setEditing(true)} className="btn-primary btn-sm flex items-center gap-1.5">
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
          <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="btn-primary btn-sm flex items-center gap-2">
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
              <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="btn-primary btn-sm flex items-center gap-1.5">
                <Plus size={15} /> Add Visit
              </button>
            </div>
            {visits.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No visits recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {visits.map((v: any) => (
                  <div key={v._id} id={`visit-${v._id}`}
                    onClick={() => openVisitDetail(v)}
                    className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-dark-750 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-colors cursor-pointer group">
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
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); openVisitDetail(v); }}
                        className="btn-primary btn-xs flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye size={13} /> View
                      </button>
                      <span className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      <ChevronRight size={15} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                    </div>
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
              <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="btn-primary btn-sm flex items-center gap-1.5">
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

      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedVisit(null)} />
          <div className="relative w-full max-w-2xl bg-white dark:bg-dark-800 border-l border-gray-200 dark:border-dark-600 shadow-2xl overflow-y-auto animate-slide-in-right">
            <div className="sticky top-0 z-10 bg-white dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Calendar size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Visit Details</h2>
              </div>
              <div className="flex items-center gap-2">
                {!editingVisit && (
                  <button onClick={() => { setEditingVisit(true); }} className="btn-primary btn-sm flex items-center gap-1.5">
                    <Edit3 size={14} /> Edit
                  </button>
                )}
                <button onClick={() => setSelectedVisit(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {/* Visit Info */}
              <div className="card p-4">
                {editingVisit ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Visit Date</label>
                      <input type="date" className="input-field" value={editVisitForm.visitDate || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, visitDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Doctor Name</label>
                      <input className="input-field" placeholder="Doctor name" value={editVisitForm.doctorName || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, doctorName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">Remarks</label>
                      <textarea className="input-field" rows={2} placeholder="Remarks" value={editVisitForm.remarks || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, remarks: e.target.value })} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleVisitSave} disabled={savingVisit} className="btn-primary btn-sm flex items-center gap-1.5">
                        <Save size={14} /> {savingVisit ? "Saving..." : "Save"}
                      </button>
                      <button onClick={() => setEditingVisit(false)} className="btn-secondary btn-sm flex items-center gap-1.5">
                        <X size={14} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-11 h-11 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
                      <Calendar size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {new Date(selectedVisit.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        {selectedVisit.doctorName && (
                          <span className="flex items-center gap-1.5 text-xs text-gray-500">
                            <User size={12} className="text-gray-400" /> Dr. {selectedVisit.doctorName}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock size={12} className="text-gray-400" /> Created {new Date(selectedVisit.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {selectedVisit.remarks && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 bg-gray-50 dark:bg-dark-750 rounded-lg p-2.5">{selectedVisit.remarks}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Linked Prescription */}
              {linkedPrescription && (
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={16} className="text-primary-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Prescription</h3>
                    <span className="text-[10px] text-gray-400 ml-auto">
                      {new Date(linkedPrescription.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Right Eye</p>
                      {linkedPrescription.rightEye?.dv && <EyeRow label="DV" data={linkedPrescription.rightEye.dv} />}
                      {linkedPrescription.rightEye?.nv && <EyeRow label="NV" data={linkedPrescription.rightEye.nv} />}
                      {linkedPrescription.rightEye?.pc && <EyeRow label="PC" data={linkedPrescription.rightEye.pc} />}
                      {!linkedPrescription.rightEye?.dv && !linkedPrescription.rightEye?.nv && !linkedPrescription.rightEye?.pc && (
                        <p className="text-xs text-gray-400">No data</p>
                      )}
                    </div>
                    <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-3">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Left Eye</p>
                      {linkedPrescription.leftEye?.dv && <EyeRow label="DV" data={linkedPrescription.leftEye.dv} />}
                      {linkedPrescription.leftEye?.nv && <EyeRow label="NV" data={linkedPrescription.leftEye.nv} />}
                      {linkedPrescription.leftEye?.pc && <EyeRow label="PC" data={linkedPrescription.leftEye.pc} />}
                      {!linkedPrescription.leftEye?.dv && !linkedPrescription.leftEye?.nv && !linkedPrescription.leftEye?.pc && (
                        <p className="text-xs text-gray-400">No data</p>
                      )}
                    </div>
                  </div>
                  {linkedPrescription.pd && (
                    <p className="text-xs text-gray-500 mt-2">PD: {linkedPrescription.pd}</p>
                  )}
                  {linkedPrescription.notes && (
                    <p className="text-xs text-gray-500 mt-1">Notes: {linkedPrescription.notes}</p>
                  )}
                </div>
              )}

              {/* Linked Order */}
              {linkedOrder && (
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingCart size={16} className="text-amber-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Order</h3>
                    <span className={`badge ml-auto text-[10px] ${
                      linkedOrder.status === "Delivered" ? "badge-green" :
                      linkedOrder.status === "Ready" ? "badge-blue" :
                      linkedOrder.status === "Cancelled" ? "badge-red" : "badge-yellow"
                    }`}>{linkedOrder.status || "Draft"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {linkedOrder.frame && (
                      <>
                        <p className="text-xs text-gray-500">Frame</p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white text-right">
                          {[linkedOrder.frameBrand, linkedOrder.frameModel, linkedOrder.frameColor, linkedOrder.frameSize].filter(Boolean).join(" / ") || linkedOrder.frame}
                          {linkedOrder.framePrice ? ` (₹${linkedOrder.framePrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.lens && (
                      <>
                        <p className="text-xs text-gray-500">Lens</p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white text-right">
                          {[linkedOrder.lensBrand, linkedOrder.lensType, linkedOrder.lensIndex].filter(Boolean).join(" / ") || linkedOrder.lens}
                          {linkedOrder.lensPrice ? ` (₹${linkedOrder.lensPrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.coating && (
                      <>
                        <p className="text-xs text-gray-500">Coating</p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white text-right">
                          {linkedOrder.coating}{linkedOrder.coatingPrice ? ` (₹${linkedOrder.coatingPrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.accessories?.length > 0 && (
                      <>
                        <p className="text-xs text-gray-500">Accessories</p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white text-right">{linkedOrder.accessories.join(", ")}</p>
                      </>
                    )}
                    <p className="text-xs text-gray-500">Quantity</p>
                    <p className="text-xs font-medium text-gray-900 dark:text-white text-right">{linkedOrder.quantity || 1}</p>
                    {linkedOrder.deliveryDate && (
                      <>
                        <p className="text-xs text-gray-500">Delivery Date</p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white text-right">
                          {new Date(linkedOrder.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </>
                    )}
                    {linkedOrder.labAssigned && (
                      <>
                        <p className="text-xs text-gray-500">Lab</p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white text-right">{linkedOrder.labAssigned}{linkedOrder.labExpectedDate ? ` (by ${new Date(linkedOrder.labExpectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})` : ""}</p>
                      </>
                    )}
                  </div>
                  {linkedOrder.labRemarks && (
                    <p className="text-xs text-gray-500 mt-2">Lab Remarks: {linkedOrder.labRemarks}</p>
                  )}
                </div>
              )}

              {/* Linked Bill */}
              {linkedBill && (
                <div className="card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt size={16} className="text-emerald-500" />
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Bill</h3>
                    <span className="text-[10px] text-gray-400 ml-auto">{linkedBill.billNumber}</span>
                  </div>
                  {linkedBill.items?.length > 0 && (
                    <div className="overflow-x-auto mb-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 dark:border-dark-700">
                            <th className="text-left py-2 font-medium text-gray-500">Description</th>
                            <th className="text-center py-2 font-medium text-gray-500">Qty</th>
                            <th className="text-right py-2 font-medium text-gray-500">Price</th>
                            <th className="text-right py-2 font-medium text-gray-500">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-dark-700">
                          {linkedBill.items.map((it: any, i: number) => (
                            <tr key={i}>
                              <td className="py-2 pr-2 text-gray-800 dark:text-gray-200">{it.description || "Item"}</td>
                              <td className="py-2 text-center text-gray-600 dark:text-gray-400">{it.quantity || 1}</td>
                              <td className="py-2 text-right text-gray-600 dark:text-gray-400">₹{(it.unitPrice || 0).toFixed(2)}</td>
                              <td className="py-2 text-right font-medium text-gray-900 dark:text-white">₹{((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="border-t border-gray-200 dark:border-dark-700 pt-2 space-y-1 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Subtotal</span>
                      <span>₹{(linkedBill.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {linkedBill.discount ? (
                      <div className="flex justify-between text-red-500">
                        <span>Discount</span>
                        <span>-₹{linkedBill.discount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    {linkedBill.tax ? (
                      <div className="flex justify-between text-emerald-600">
                        <span>GST</span>
                        <span>+₹{linkedBill.tax.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-dark-700">
                      <span>Total</span>
                      <span>₹{(linkedBill.totalAmount || 0).toFixed(2)}</span>
                    </div>
                    {linkedBill.advancePaid !== undefined && (
                      <div className="flex justify-between text-emerald-600 items-center">
                        <span>Paid</span>
                        {editingBillAdvance ? (
                          <div className="flex items-center gap-1.5">
                            <input type="number" min="0" step="0.01"
                              className="input-field w-24 text-xs py-1 text-right"
                              value={editBillAdvanceAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setEditBillAdvanceAmount(Number(e.target.value))} />
                            <button onClick={handleBillAdvanceSave} disabled={savingBillAdvance}
                              className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded text-emerald-600">
                              {savingBillAdvance ? <div className="animate-spin w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full" /> : <Save size={13} />}
                            </button>
                            <button onClick={() => setEditingBillAdvance(false)}
                              className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span>₹{linkedBill.advancePaid.toFixed(2)}</span>
                            <button onClick={() => { setEditBillAdvanceAmount(linkedBill.advancePaid || 0); setEditingBillAdvance(true); }}
                              className="btn-primary btn-xs flex items-center gap-1 py-0.5 px-1.5">
                              <Edit3 size={11} /> Edit
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {(linkedBill.pendingAmount || 0) > 0 ? (
                      <div className="flex justify-between text-amber-600 font-semibold">
                        <span>Balance Due</span>
                        <span>₹{linkedBill.pendingAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => sendWhatsApp(customer?.mobile, linkedBill)}
                      className="btn-ghost btn-sm text-xs flex items-center gap-1.5">
                      <MessageCircle size={13} /> Send Bill
                    </button>
                  </div>
                </div>
              )}

              {/* No linked data */}
              {!linkedPrescription && !linkedOrder && !linkedBill && (
                <div className="card p-6 text-center">
                  <Activity size={24} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400">No linked prescription, order, or bill for this visit.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

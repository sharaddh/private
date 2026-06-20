import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import Modal from "../components/Modal";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, DollarSign, Eye, ClipboardList,
  ShoppingCart, FileText, Clock, Edit3, Plus, Trash2, Save, X, MessageCircle,
  ChevronRight, AlertCircle, Info
} from "lucide-react";

interface EyeData { sph?: number; cyl?: number; axis?: number; va?: string; }
interface EyeSet { dv?: EyeData; nv?: EyeData; pc?: EyeData; }

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
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

  // New Visit Modal
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [visitDoctor, setVisitDoctor] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [prevPrescription, setPrevPrescription] = useState<any>(null);
  const [prescription, setPrescription] = useState({
    rightEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    leftEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    pd: "", notes: "",
  });
  const [savingVisit, setSavingVisit] = useState(false);
  const [visitError, setVisitError] = useState("");

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/customers/${id}`),
      api.get(`/api/visits?customerId=${id}`),
      api.get(`/api/prescriptions?customerId=${id}`),
      api.get("/api/bills"),
      api.get("/api/orders"),
      api.get("/api/settings"),
    ]).then(([c, v, p, b, o, s]) => {
      if (c.success) { setCustomer(c.data); setEditForm(c.data); }
      if (v.success) setVisits(v.data);
      if (p.success) {
        setPrescriptions(p.data);
        if (p.data.length > 0) {
          const prev = p.data[0];
          setPrevPrescription(prev);
          setPrescription({
            rightEye: prev.rightEye || { dv: {}, nv: {}, pc: {} },
            leftEye: prev.leftEye || { dv: {}, nv: {}, pc: {} },
            pd: prev.pd || "", notes: prev.notes || "",
          });
        }
      }
      if (b.success) setBills(b.data.filter((bill: any) => bill.customerId === id));
      if (o.success) setOrders(o.data.filter((ord: any) => ord.customerId === id));
      if (s.success) setSettings(s.data);
    });
  }, [id]);

  if (!customer) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  async function handleEditSave() {
    setSaving(true);
    try {
      const payload = {
        name: editForm.name,
        email: editForm.email || undefined,
        mobile: editForm.mobile || undefined,
        alternateMobile: editForm.alternateMobile || undefined,
        address: editForm.address || undefined,
        city: editForm.city || undefined,
        age: editForm.age ? Number(editForm.age) : undefined,
        gender: editForm.gender || undefined,
        tags: editForm.tags || undefined,
      };
      const res = await api.put(`/api/customers/${id}`, payload);
      if (res.success) {
        setCustomer(res.data);
        setEditing(false);
      }
    } finally { setSaving(false); }
  }

  function openVisitModal() {
    setVisitDate(new Date().toISOString().split("T")[0]);
    setVisitDoctor("");
    setVisitRemarks("");
    setVisitError("");
    // Load latest prescription
    if (prescriptions.length > 0) {
      const prev = prescriptions[0];
      setPrevPrescription(prev);
      setPrescription({
        rightEye: prev.rightEye || { dv: {}, nv: {}, pc: {} },
        leftEye: prev.leftEye || { dv: {}, nv: {}, pc: {} },
        pd: prev.pd || "", notes: prev.notes || "",
      });
    }
    setShowVisitModal(true);
  }

  function updateEye(side: "rightEye" | "leftEye", type: "dv" | "nv" | "pc", field: string, value: string) {
    setPrescription((prev) => {
      const eyeSet = { ...prev[side] };
      eyeSet[type] = { ...eyeSet[type], [field]: value === "" ? undefined : field === "va" ? value : Number(value) };
      return { ...prev, [side]: eyeSet };
    });
  }

  function getPrevValue(side: string, type: string, field: string): string {
    if (!prevPrescription) return "";
    const val = prevPrescription[side]?.[type]?.[field];
    return val !== undefined && val !== 0 && val !== "" ? String(val) : "";
  }

  function isChanged(side: string, type: string, field: string): boolean {
    if (!prevPrescription) return false;
    const prev = prevPrescription[side]?.[type]?.[field];
    const curr = prescription[side as "rightEye" | "leftEye"]?.[type as "dv" | "nv" | "pc"]?.[field as "sph" | "cyl" | "axis" | "va"];
    if (field === "va") return prev !== curr && curr !== undefined && curr !== "";
    return Number(prev) !== Number(curr) && curr !== undefined && curr !== "";
  }

  async function handleSaveVisit() {
    setSavingVisit(true);
    setVisitError("");
    try {
      const payload: any = { customer: { _id: id, name: customer.name, mobile: customer.mobile } };

      payload.visit = { doctorName: visitDoctor || undefined, remarks: visitRemarks || undefined };
      payload.prescription = {
        rightEye: cleanEyeSet(prescription.rightEye),
        leftEye: cleanEyeSet(prescription.leftEye),
        pd: prescription.pd || undefined,
        notes: prescription.notes || undefined,
      };

      const res = await api.post("/api/workspace/transaction", payload);
      if (res.success) {
        // Refresh data
        const [v, p, c] = await Promise.all([
          api.get(`/api/visits?customerId=${id}`),
          api.get(`/api/prescriptions?customerId=${id}`),
          api.get(`/api/customers/${id}`),
        ]);
        if (v.success) setVisits(v.data);
        if (p.success) {
          setPrescriptions(p.data);
          if (p.data.length > 0) {
            setPrevPrescription(p.data[0]);
            setPrescription({
              rightEye: p.data[0].rightEye || { dv: {}, nv: {}, pc: {} },
              leftEye: p.data[0].leftEye || { dv: {}, nv: {}, pc: {} },
              pd: p.data[0].pd || "", notes: p.data[0].notes || "",
            });
          }
        }
        if (c.success) setCustomer(c.data);
        setShowVisitModal(false);
      } else {
        setVisitError(res.message || "Failed to save visit");
      }
    } catch (err: any) {
      setVisitError(err.message || "An error occurred");
    } finally { setSavingVisit(false); }
  }

  function cleanEyeSet(e: any): any {
    return {
      dv: cleanEye(e.dv), nv: cleanEye(e.nv), pc: cleanEye(e.pc),
    };
  }

  function cleanEye(e?: EyeData): EyeData | undefined {
    if (!e) return undefined;
    const out: EyeData = {};
    if (e.sph !== undefined && e.sph !== 0) out.sph = Number(e.sph);
    if (e.cyl !== undefined && e.cyl !== 0) out.cyl = Number(e.cyl);
    if (e.axis !== undefined && e.axis !== 0) out.axis = Number(e.axis);
    if (e.va) out.va = e.va;
    return Object.keys(out).length > 0 ? out : undefined;
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
    { key: "overview", label: "Overview", icon: Eye },
    { key: "visits", label: `Visits (${visits.length})`, icon: ClipboardList },
    { key: "prescriptions", label: `Prescriptions (${prescriptions.length})`, icon: Eye },
    { key: "bills", label: `Bills (${bills.length})`, icon: DollarSign },
    { key: "orders", label: `Orders (${orders.length})`, icon: ShoppingCart },
  ] as const;

  function renderEyeFields(side: "rightEye" | "leftEye", label: string) {
    const data = prescription[side];
    return (
      <div className="border border-gray-200 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">{label}</h4>
        {(["dv", "nv", "pc"] as const).map((type) => (
          <div key={type} className="mb-3">
            <p className="text-xs font-medium text-gray-400 mb-1">
              {type === "dv" ? "Distance Vision" : type === "nv" ? "Near Vision" : "Peripheral Curve"}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(["sph", "cyl", "axis", "va"] as const).map((field) => {
                const changed = isChanged(side, type, field);
                const prevVal = getPrevValue(side, type, field);
                return (
                  <div key={field}>
                    <label className="text-[10px] text-gray-400 block">{field.toUpperCase()}</label>
                    <input type={field === "va" ? "text" : "number"} step={field === "va" ? undefined : "0.25"}
                      className={`input-field py-1.5 text-xs ${changed ? "border-amber-400 bg-amber-50 ring-1 ring-amber-300" : ""}`}
                      value={data[type]?.[field] ?? ""}
                      onChange={(e) => updateEye(side, type, field, e.target.value)} />
                    {changed && prevVal && <span className="text-[9px] text-amber-500 block mt-0.5">was {prevVal}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button onClick={() => navigate("/customers")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft size={18} /> Back to Customers
      </button>

      {/* Customer Header */}
      <div className="card">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 font-bold text-2xl">
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
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                    <input className="input-field" placeholder="City" value={editForm.city || ""}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                    <input className="input-field" placeholder="Alternate Mobile" value={editForm.alternateMobile || ""}
                      onChange={(e) => setEditForm({ ...editForm, alternateMobile: e.target.value })} />
                    <div className="col-span-2">
                      <textarea className="input-field" placeholder="Address" rows={2} value={editForm.address || ""}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleEditSave} disabled={saving} className="btn-success flex items-center gap-1.5 text-sm">
                      <Save size={15} /> {saving ? "Saving..." : "Save"}
                    </button>
                    <button onClick={() => setEditing(false)} className="btn-secondary flex items-center gap-1.5 text-sm">
                      <X size={15} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
                  <p className="text-sm text-gray-500">{customer.customerId || "—"}</p>
                  <div className="flex flex-wrap gap-4 mt-3">
                    {customer.mobile && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Phone size={14} className="text-gray-400" /> {customer.mobile}
                      </span>
                    )}
                    {customer.email && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-600">
                        <Mail size={14} className="text-gray-400" /> {customer.email}
                      </span>
                    )}
                    {customer.city && (
                      <span className="flex items-center gap-1.5 text-sm text-gray-600">
                        <MapPin size={14} className="text-gray-400" /> {customer.city}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-sm text-gray-600">
                      <Calendar size={14} className="text-gray-400" /> Joined {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "—"}
                    </span>
                    {customer.age && <span className="text-sm text-gray-600">Age: {customer.age}</span>}
                    {customer.gender && <span className="text-sm text-gray-600">Gender: {customer.gender}</span>}
                  </div>
                  {customer.address && <p className="text-sm text-gray-500 mt-2">{customer.address}</p>}
                  {customer.alternateMobile && <p className="text-sm text-gray-500 mt-1">Alt: {customer.alternateMobile}</p>}
                  {customer.tags?.length > 0 && (
                    <div className="flex gap-2 mt-2">
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
            <button onClick={() => setEditing(true)} className="btn-secondary flex items-center gap-1.5 text-sm px-3 py-2">
              <Edit3 size={15} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{customer.totalVisits || 0}</p>
          <p className="text-sm text-gray-500">Total Visits</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-600">₹{(customer.totalSpent || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Total Spent</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-600">₹{(customer.pendingAmount || 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Pending Amount</p>
        </div>
        <div className="card text-center flex flex-col items-center justify-center">
          <button onClick={openVisitModal} className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
            <Plus size={16} /> Add New Visit
          </button>
          <p className="text-xs text-gray-400 mt-2">Pre-filled prescription</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? "border-indigo-600 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon size={16} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div>
        {tab === "overview" && (
          <div className="card space-y-4">
            <h3 className="font-semibold text-gray-900">Customer Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500">Last 5 Visits</p>
                {visits.slice(0, 5).length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {visits.slice(0, 5).map((v: any) => (
                      <div key={v._id} className="text-sm">
                        <span className="font-medium">{new Date(v.visitDate).toLocaleDateString()}</span>
                        {v.doctorName && <span className="text-gray-500"> — {v.doctorName}</span>}
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400 mt-2">No visits</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500">Latest Prescription</p>
                {prescriptions.length > 0 ? (
                  <div className="mt-2 text-sm">
                    <p>RE: SPH {prescriptions[0].rightEye?.dv?.sph ?? "—"} / CYL {prescriptions[0].rightEye?.dv?.cyl ?? "—"}</p>
                    <p>LE: SPH {prescriptions[0].leftEye?.dv?.sph ?? "—"} / CYL {prescriptions[0].leftEye?.dv?.cyl ?? "—"}</p>
                    {prescriptions[0].pd && <p>PD: {prescriptions[0].pd}</p>}
                  </div>
                ) : <p className="text-sm text-gray-400 mt-2">No prescriptions</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500">Recent Orders</p>
                {orders.slice(0, 5).length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {orders.slice(0, 5).map((o: any) => (
                      <div key={o._id} className="flex items-center justify-between text-sm">
                        <span>{o.frame || o.lens || "Order"}</span>
                        <span className={`badge ${
                          o.status === "Delivered" ? "badge-green" :
                          o.status === "Ready" ? "badge-blue" :
                          o.status === "Cancelled" ? "badge-red" : "badge-yellow"
                        }`}>{o.status}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400 mt-2">No orders</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-500">Recent Bills</p>
                {bills.slice(0, 5).length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {bills.slice(0, 5).map((b: any) => (
                      <div key={b._id} className="flex items-center justify-between text-sm">
                        <span>{b.billNumber}</span>
                        <span className="font-semibold">₹{(b.totalAmount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400 mt-2">No bills</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "visits" && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">All Visits ({visits.length})</h3>
              <button onClick={openVisitModal} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
                <Plus size={15} /> Add Visit
              </button>
            </div>
            {visits.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No visits recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {visits.map((v: any) => (
                  <div key={v._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-gray-400" />
                        <p className="text-sm font-medium text-gray-900">{new Date(v.visitDate).toLocaleDateString()}</p>
                      </div>
                      {v.doctorName && <p className="text-xs text-gray-500 mt-0.5">Doctor: {v.doctorName}</p>}
                      {v.remarks && <p className="text-xs text-gray-500">{v.remarks}</p>}
                    </div>
                    <span className="text-xs text-gray-400">{new Date(v.createdAt).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "prescriptions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Prescriptions ({prescriptions.length})</h3>
              <button onClick={openVisitModal} className="btn-primary flex items-center gap-1.5 text-sm px-3 py-2">
                <Plus size={15} /> Add Prescription
              </button>
            </div>
            {prescriptions.length === 0 ? (
              <div className="card"><p className="text-gray-400 text-sm text-center py-8">No prescriptions yet.</p></div>
            ) : (
              prescriptions.map((p: any) => (
                <div key={p._id} className="card">
                  <p className="text-xs text-gray-400 mb-3">{new Date(p.createdAt).toLocaleDateString()}</p>
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Right Eye</p>
                      {p.rightEye?.dv && <EyeRow label="DV" data={p.rightEye.dv} />}
                      {p.rightEye?.nv && <EyeRow label="NV" data={p.rightEye.nv} />}
                      {p.rightEye?.pc && <EyeRow label="PC" data={p.rightEye.pc} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Left Eye</p>
                      {p.leftEye?.dv && <EyeRow label="DV" data={p.leftEye.dv} />}
                      {p.leftEye?.nv && <EyeRow label="NV" data={p.leftEye.nv} />}
                      {p.leftEye?.pc && <EyeRow label="PC" data={p.leftEye.pc} />}
                    </div>
                  </div>
                  {p.pd && <p className="text-sm text-gray-500 mt-2">PD: {p.pd}</p>}
                  {p.notes && <p className="text-sm text-gray-500 mt-1">Notes: {p.notes}</p>}
                </div>
              ))
            )}
          </div>
        )}

        {tab === "bills" && (
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Bills ({bills.length})</h3>
            {bills.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No bills yet.</p>
            ) : (
              <div className="space-y-3">
                {bills.map((b: any) => (
                  <div key={b._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{b.billNumber || "—"}</p>
                      <p className="text-xs text-gray-500">{new Date(b.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">₹{(b.totalAmount || 0).toLocaleString()}</p>
                      <p className="text-xs" style={{color: (b.pendingAmount || 0) > 0 ? "#d97706" : "#059669"}}>
                        {(b.pendingAmount || 0) > 0 ? `Pending: ₹${b.pendingAmount}` : "Paid"}
                      </p>
                      <button
                        onClick={() => sendWhatsApp(customer.mobile, b)}
                        className="text-xs text-green-600 hover:text-green-800 mt-1 flex items-center gap-1"
                      >
                        <MessageCircle size={12} /> Send Bill
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
            <h3 className="font-semibold text-gray-900 mb-4">Orders ({orders.length})</h3>
            {orders.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-8">No orders yet.</p>
            ) : (
              <div className="space-y-3">
                {orders.map((o: any) => (
                  <div key={o._id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {[o.frameBrand, o.frame, o.lensBrand, o.lens].filter(Boolean).join(" / ") || "Order"}
                      </p>
                      <p className="text-xs text-gray-500">Qty: {o.quantity || 1}</p>
                      {o.deliveryDate && <p className="text-xs text-gray-400">Delivery: {new Date(o.deliveryDate).toLocaleDateString()}</p>}
                    </div>
                    <span className={`badge ${
                      o.status === "Delivered" ? "badge-green" :
                      o.status === "Cancelled" ? "badge-red" :
                      o.status === "Ready" ? "badge-blue" :
                      "badge-yellow"
                    }`}>{o.status || "Draft"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Visit Modal */}
      <Modal open={showVisitModal} onClose={() => setShowVisitModal(false)} title="Add New Visit" size="xl">
        {visitError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4 flex items-center gap-2">
            <AlertCircle size={16} /> {visitError}
          </div>
        )}
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Visit Date</label>
              <input type="date" className="input-field" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor</label>
              <input className="input-field" placeholder="Doctor name" value={visitDoctor} onChange={(e) => setVisitDoctor(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
              <input className="input-field" placeholder="Any notes" value={visitRemarks} onChange={(e) => setVisitRemarks(e.target.value)} />
            </div>
          </div>

          {prevPrescription && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 flex items-center gap-2 text-sm text-amber-700">
              <Info size={14} /> Previous prescription pre-filled below. Changed fields highlighted in amber.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderEyeFields("rightEye", "Right Eye")}
            {renderEyeFields("leftEye", "Left Eye")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">PD (Pupillary Distance)</label>
              <input className="input-field" placeholder="e.g. 62mm" value={prescription.pd}
                onChange={(e) => setPrescription({ ...prescription, pd: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input className="input-field" placeholder="Additional notes" value={prescription.notes}
                onChange={(e) => setPrescription({ ...prescription, notes: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button type="button" onClick={() => setShowVisitModal(false)} className="btn-secondary">Cancel</button>
            <button onClick={handleSaveVisit} disabled={savingVisit} className="btn-primary">
              {savingVisit ? "Saving..." : "Save Visit & Prescription"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function EyeRow({ label, data }: { label: string; data: any }) {
  return (
    <div className="text-xs text-gray-600 mb-1">
      <span className="font-medium text-gray-700">{label}: </span>
      SPH: {data.sph ?? "—"} CYL: {data.cyl ?? "—"} AXIS: {data.axis ?? "—"} {data.va ? `VA: ${data.va}` : ""}
    </div>
  );
}

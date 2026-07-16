import React, { useEffect, useRef, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import { useTranslate } from "../context/TranslateContext";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Receipt, Eye, ClipboardList,
  ShoppingCart, Edit3, Plus, Save, X, MessageCircle, FileText, User,
  ChevronRight, Clock, Activity, MapPinned,
  IdCard, Wallet, TrendingUp, Stethoscope, Sparkles
} from "lucide-react";
import { formatEyeRx, hasEyeData } from "../utils/rx";

function getVisitId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as Record<string, any>;
    if (obj._id) return getVisitId(obj._id);
    if (obj.toString && obj.toString !== Object.prototype.toString) return obj.toString();
  }
  return null;
}

function hasPrescriptionData(prescription: any): boolean {
  if (!prescription || typeof prescription !== "object") return false;

  const stack = [prescription];

  while (stack.length > 0) {
    const current = stack.pop();

    if (typeof current === "number") {
      return !Number.isNaN(current);
    }

    if (typeof current === "string") {
      const trimmed = current.trim();
      if (trimmed && !Number.isNaN(Number(trimmed))) return true;
      continue;
    }

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    if (current && typeof current === "object") {
      stack.push(...Object.values(current));
    }
  }

  return false;
}

function findLinkedPrescription(prescriptions: any[], visit: any) {
  const visitId = getVisitId(visit?._id);

  const exactMatch = prescriptions.find((p: any) => getVisitId(p.visitId) === visitId);
  if (exactMatch) return exactMatch;

  const dataPrescriptions = prescriptions.filter((p: any) => hasPrescriptionData(p));
  if (dataPrescriptions.length === 0) return null;

  const visitDate = visit?.visitDate ? new Date(visit.visitDate).toISOString().split("T")[0] : null;
  const dateMatch = visitDate
    ? dataPrescriptions.find((p: any) => {
        const createdDate = p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : null;
        return createdDate === visitDate;
      })
    : null;

  if (dateMatch) return dateMatch;

  return dataPrescriptions[0];
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, uiT } = useTranslate();
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
        const caption = t(
          `*${shop}*\n\nHi ${customer?.name || ""},\nPlease find your bill attached.\n\nThank you!`,
          `*${shop}*\n\nनमस्ते ${customer?.name || ""},\nकृपया अपना बिल संलग्न देखें।\n\nधन्यवाद!`
        );
        const mediaRes = await api.post("/api/whatsapp/send-media", { phone: fullNum, base64, filename: `Bill-${bill.billNumber || "invoice"}.pdf`, caption, mimetype: "application/pdf" });
        if (mediaRes.success) return;
        console.warn("WhatsApp PDF send failed:", mediaRes?.message);
      }
    } catch (e) {
      console.warn("WhatsApp PDF send error:", e);
    }
    const items = (bill?.items || []).map((i: any) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("\n");
    const billLabel = t("Bill", "बिल");
    const dateLabel = t("Date", "तारीख");
    const customerLabel = t("Customer", "ग्राहक");
    const mobileLabel = t("Mobile", "मोबाइल");
    const itemsLabel = t("Items", "आइटम");
    const subtotalLabel = t("Subtotal", "उप-कुल");
    const discountLabel = t("Discount", "छूट");
    const taxLabel = t("Tax", "कर");
    const totalLabel = t("Total", "कुल");
    const paidLabel = t("Paid", "भुगतान");
    const pendingLabel = t("Pending", "बाकी");
    const thankYou = t("Thank you!", "धन्यवाद!");
    const msg = `*${shop}* 🕶\n\n*${billLabel}:* ${bill?.billNumber || ""}\n*${dateLabel}:* ${new Date().toLocaleDateString("en-IN")}\n\n*${customerLabel}:* ${customer?.name || ""}\n*${mobileLabel}:* ${customer?.mobile || ""}\n\n*${itemsLabel}:*\n${items}\n\n*${subtotalLabel}:* ₹${(bill?.subtotal || 0).toFixed(0)}${bill?.discount ? `\n*${discountLabel}:* -₹${bill.discount.toFixed(0)}` : ""}${bill?.tax ? `\n*${taxLabel}:* +₹${bill.tax.toFixed(0)}` : ""}\n*${totalLabel}:* ₹${(bill?.totalAmount || 0).toFixed(0)}\n*${paidLabel}:* ₹${(bill?.advancePaid || 0).toFixed(0)}\n*${pendingLabel}:* ₹${(bill?.pendingAmount || 0).toFixed(0)}\n\n${thankYou} 🙏`;
    try { await api.post("/api/whatsapp/send", { phone: fullNum, message: msg }); } catch (e) { /* WhatsApp send is best-effort */ };
  }

  const tabs = [
    { key: "overview", label: uiT("Overview", "अवलोकन"), icon: User },
    { key: "visits", label: `${uiT("Visits", "विज़िट")} (${visits.length})`, icon: ClipboardList },
    { key: "prescriptions", label: `${uiT("Prescriptions", "प्रिस्क्रिप्शन")} (${prescriptions.length})`, icon: Eye },
    { key: "bills", label: `${uiT("Bills", "बिल")} (${bills.length})`, icon: Receipt },
    { key: "orders", label: `${uiT("Orders", "ऑर्डर")} (${orders.length})`, icon: ShoppingCart },
  ] as const;

  return (
    <div className="min-h-screen bg-th-base text-th-text p-6 max-w-7xl mx-auto">
      <button onClick={() => navigate("/customers")}
        className="inline-flex items-center gap-2 text-sm text-th-secondary hover:text-th-text transition-colors mb-4">
        <ArrowLeft size={16} /> {uiT("Back to Customers", "ग्राहकों पर वापस जाएं")}
      </button>

      <div className="relative overflow-hidden bg-th-surface rounded-xl mb-6 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-r from-[#1ed760]/10 to-transparent pointer-events-none" />
        <div className="relative p-6 lg:p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 bg-[#1ed760] rounded-full flex items-center justify-center text-black font-bold text-3xl flex-shrink-0">
                {customer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                {editing ? (
                  <div className="space-y-3 max-w-lg">
                    <input className="w-full bg-th-elevated text-th-text px-3 py-2.5 rounded-md text-lg font-bold outline-none focus:ring-1 focus:ring-[#1ed760]" value={editForm.name || ""}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                      <input className="w-full bg-th-elevated text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760]" placeholder={uiT("Mobile", "मोबाइल")} value={editForm.mobile || ""}
                        onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
                      <input className="w-full bg-th-elevated text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760]" placeholder={uiT("Email", "ईमेल")} value={editForm.email || ""}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      <input className="w-full bg-th-elevated text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760]" placeholder={uiT("Age", "आयु")} type="number" value={editForm.age || ""}
                        onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} />
                      <select className="w-full bg-th-elevated text-th-text px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760]" value={editForm.gender || ""}
                        onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                        <option value="">{uiT("Gender", "लिंग")}</option>
                        <option value="Male">{uiT("Male", "पुरुष")}</option><option value="Female">{uiT("Female", "महिला")}</option><option value="Other">{uiT("Other", "अन्य")}</option>
                      </select>
                      <input className="w-full bg-th-elevated text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760]" placeholder={uiT("City", "शहर")} value={editForm.city || ""}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                      <input className="w-full bg-th-elevated text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760]" placeholder={uiT("Alt Mobile", "वैकल्पिक मोबाइल")} value={editForm.alternateMobile || ""}
                        onChange={(e) => setEditForm({ ...editForm, alternateMobile: e.target.value })} />
                      <div className="col-span-2">
                        <textarea className="w-full bg-th-elevated text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760]" placeholder={uiT("Address", "पता")} rows={2} value={editForm.address || ""}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleEditSave} disabled={saving} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-all duration-150 disabled:opacity-50">
                        <Save size={14} /> {saving ? "Saving..." : uiT("Save", "सहेजें")}
                      </button>
                      <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-all duration-150">
                        <X size={14} /> {uiT("Cancel", "रद्द करें")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl lg:text-3xl font-bold text-th-text tracking-tight">{customer.name}</h1>
                    <p className="text-th-secondary text-sm flex items-center gap-1.5 mt-1">
                      <IdCard size={13} /> {customer.customerId || "—"}
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4">
                      {customer.mobile && (
                        <span className="flex items-center gap-1.5 text-sm text-th-secondary">
                          <Phone size={14} className="text-th-secondary" /> {customer.mobile}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1.5 text-sm text-th-secondary">
                          <Mail size={14} className="text-th-secondary" /> {customer.email}
                        </span>
                      )}
                      {customer.city && (
                        <span className="flex items-center gap-1.5 text-sm text-th-secondary">
                          <MapPinned size={14} className="text-th-secondary" /> {customer.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-sm text-th-secondary">
                        <Calendar size={14} className="text-th-secondary" /> {uiT("Joined", "शामिल हुए")} {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </span>
                      {customer.age && <span className="text-sm text-th-secondary"><User size={14} className="inline mr-1 text-th-secondary" />Age: {customer.age}</span>}
                      {customer.gender && <span className="text-sm text-th-secondary">{customer.gender}</span>}
                    </div>
                    {customer.address && <p className="text-sm text-th-secondary mt-2 flex items-center gap-1.5"><MapPin size={13} className="text-th-secondary" />{customer.address}</p>}
                    {customer.alternateMobile && <p className="text-sm text-th-secondary mt-1 flex items-center gap-1.5"><Phone size={13} className="text-th-secondary" />{uiT("Alt", "वैकल्पिक")}: {customer.alternateMobile}</p>}
                    {customer.tags?.length > 0 && (
                      <div className="flex gap-2 mt-4">
                        {customer.tags.map((tag: string, i: number) => (
                          <span key={tag} className="px-3 py-1 bg-[#1ed760]/10 text-[#1ed760] text-xs font-medium rounded-lg">{tag}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider px-5 py-2.5 rounded-lg bg-th-elevated text-th-text hover:bg-th-hover active:scale-95 transition-all duration-150">
                <Edit3 size={14} /> {uiT("Edit Profile", "प्रोफ़ाइल संपादित करें")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
        <div className="bg-th-surface rounded-lg flex items-center gap-4 p-5 hover:bg-th-hover active:scale-[0.99] transition-all duration-150 shadow-lg">
          <div className="w-12 h-12 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760] flex-shrink-0">
            <ClipboardList size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-th-text tracking-tight">{customer.totalVisits || 0}</p>
            <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider truncate">{uiT("Total Visits", "कुल विज़िट")}</p>
          </div>
        </div>
        <div className="bg-th-surface rounded-lg flex items-center gap-4 p-5 hover:bg-th-hover active:scale-[0.99] transition-all duration-150 shadow-lg">
          <div className="w-12 h-12 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760] flex-shrink-0">
            <TrendingUp size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-[#1ed760] tracking-tight">₹{(customer.totalSpent || 0).toLocaleString()}</p>
            <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider truncate">{uiT("Total Spent", "कुल खर्च")}</p>
          </div>
        </div>
        <div className="bg-th-surface rounded-lg flex items-center gap-4 p-5 hover:bg-th-hover active:scale-[0.99] transition-all duration-150 shadow-lg">
          <div className="w-12 h-12 bg-[#e8a427]/10 rounded-full flex items-center justify-center text-[#e8a427] flex-shrink-0">
            <Wallet size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-[#e8a427] tracking-tight">₹{(customer.pendingAmount || 0).toLocaleString()}</p>
            <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider truncate">{uiT("Pending Amount", "बाकी राशि")}</p>
          </div>
        </div>
        <div onClick={() => navigate(`/customers/${id}/create-visit`)}
          className="bg-[#1ed760] rounded-lg flex items-center gap-4 p-5 cursor-pointer active:scale-[0.99] transition-transform duration-150 group shadow-lg">
          <div className="w-12 h-12 bg-black/20 rounded-full flex items-center justify-center text-black flex-shrink-0">
            <Plus size={20} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-black tracking-tight">{uiT("New Visit", "नई विज़िट")}</p>
            <p className="text-xs text-black/60">{uiT("with prescription", "प्रिस्क्रिप्शन के साथ")}</p>
          </div>
        </div>
      </div>

      <div className="bg-th-surface rounded-lg p-1 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider rounded-lg transition-all duration-150 whitespace-nowrap flex-1 justify-center ${
                  isActive
                    ? "bg-white text-black"
                    : "text-th-secondary hover:text-th-text hover:bg-th-elevated"
                }`}>
                <Icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        {tab === "overview" && (
          <div className="space-y-5">
            <h3 className="text-base font-bold text-th-text tracking-tight flex items-center gap-2">
              <Sparkles size={16} className="text-[#1ed760]" /> {uiT("Customer Summary", "ग्राहक सारांश")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-th-surface rounded-lg p-5 hover:bg-th-hover transition-colors">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760]">
                    <Calendar size={14} />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-th-text">{uiT("Last 5 Visits", "अंतिम 5 विज़िट")}</p>
                </div>
                {visits.slice(0, 5).length > 0 ? (
                  <div className="space-y-2.5">
                    {visits.slice(0, 5).map((v: any) => (
                      <div key={v._id} className="flex items-center gap-3 text-sm group cursor-pointer hover:bg-th-elevated -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                        <div className="w-2 h-2 rounded-full bg-[#1ed760] flex-shrink-0" />
                        <span className="font-medium text-th-text">{new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {v.doctorName && <span className="text-th-secondary">— {v.doctorName}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Calendar size={24} className="text-[#535353]" />
                    <p className="text-sm text-th-secondary">{uiT("No visits yet", "अभी तक कोई विज़िट नहीं")}</p>
                  </div>
                )}
              </div>
              <div className="bg-th-surface rounded-lg p-5 hover:bg-th-hover transition-colors">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-400">
                    <Eye size={14} />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-th-text">{uiT("Latest Prescription", "नवीनतम प्रिस्क्रिप्शन")}</p>
                </div>
                {prescriptions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="bg-th-elevated rounded-lg p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6ea8fe] mb-1.5 flex items-center gap-1">{uiT("Right Eye", "दाहिनी आंख")}</p>
                      <p className="text-sm font-mono font-semibold text-th-text">{formatEyeRx(prescriptions[0].rightEye?.dv?.sph, prescriptions[0].rightEye?.dv?.cyl, prescriptions[0].rightEye?.dv?.axis)}</p>
                    </div>
                    <div className="bg-th-elevated rounded-lg p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#e8a427] mb-1.5 flex items-center gap-1">{uiT("Left Eye", "बाईं आंख")}</p>
                      <p className="text-sm font-mono font-semibold text-th-text">{formatEyeRx(prescriptions[0].leftEye?.dv?.sph, prescriptions[0].leftEye?.dv?.cyl, prescriptions[0].leftEye?.dv?.axis)}</p>
                    </div>
                    {prescriptions[0].pd && <p className="text-xs text-th-secondary">PD: {prescriptions[0].pd}</p>}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Eye size={24} className="text-[#535353]" />
                    <p className="text-sm text-th-secondary">{uiT("No prescriptions", "कोई प्रिस्क्रिप्शन नहीं")}</p>
                  </div>
                )}
              </div>
              <div className="bg-th-surface rounded-lg p-5 hover:bg-th-hover transition-colors">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-[#e8a427]/10 rounded-full flex items-center justify-center text-[#e8a427]">
                    <ShoppingCart size={14} />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-th-text">{uiT("Recent Orders", "हालिया ऑर्डर")}</p>
                </div>
                {orders.slice(0, 5).length > 0 ? (
                  <div className="space-y-2.5">
                    {orders.slice(0, 5).map((o: any) => (
                      <div key={o._id} className="flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-th-elevated transition-colors">
                        <span className="text-sm text-th-text truncate">{o.frame || o.lens || "Order"}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0 ${
                          o.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                          o.status === "Ready" ? "bg-[#6ea8fe]/10 text-[#6ea8fe]" :
                          o.status === "Cancelled" ? "bg-red-500/10 text-red-400" : "bg-[#e8a427]/10 text-[#e8a427]"
                        }`}>{o.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <ShoppingCart size={24} className="text-[#535353]" />
                    <p className="text-sm text-th-secondary">{uiT("No orders", "कोई ऑर्डर नहीं")}</p>
                  </div>
                )}
              </div>
              <div className="bg-th-surface rounded-lg p-5 hover:bg-th-hover transition-colors">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760]">
                    <Receipt size={14} />
                  </div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-th-text">{uiT("Recent Bills", "हालिया बिल")}</p>
                </div>
                {bills.slice(0, 5).length > 0 ? (
                  <div className="space-y-2.5">
                    {bills.slice(0, 5).map((b: any) => (
                      <div key={b._id} className="flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-th-elevated transition-colors">
                        <span className="text-sm text-th-text flex items-center gap-1.5">
                          <FileText size={13} className="text-th-secondary" /> {b.billNumber}
                        </span>
                        <span className="text-sm font-bold text-[#1ed760]">₹{(b.totalAmount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Receipt size={24} className="text-[#535353]" />
                    <p className="text-sm text-th-secondary">{uiT("No bills", "कोई बिल नहीं")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "visits" && (
          <div className="bg-th-surface rounded-lg p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-th-text tracking-tight flex items-center gap-2">
                <ClipboardList size={16} className="text-[#1ed760]" /> {uiT("All Visits", "सभी विज़िट")} ({visits.length})
              </h3>
              <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
                <Plus size={14} /> {uiT("Add Visit", "विज़िट जोड़ें")}
              </button>
            </div>
            {visits.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 bg-th-elevated rounded-full flex items-center justify-center">
                  <Calendar size={24} className="text-[#535353]" />
                </div>
                <p className="text-sm font-medium text-th-secondary">{uiT("No visits recorded yet", "अभी तक कोई विज़िट दर्ज नहीं")}</p>
                <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
                  <Plus size={14} /> {uiT("Create First Visit", "पहली विज़िट बनाएं")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {visits.map((v: any, idx: number) => (
                  <div key={v._id} id={`visit-${v._id}`}
                    onClick={() => openVisitDetail(v)}
                    className="flex items-center justify-between p-4 rounded-lg bg-th-elevated hover:bg-th-hover active:scale-[0.99] transition-all duration-150 cursor-pointer group">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 bg-th-hover rounded-full flex items-center justify-center text-th-secondary">
                          <Calendar size={16} />
                        </div>
                        {idx < visits.length - 1 && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-3 bg-th-border" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-th-text">
                            {new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {v.visitType && (
                            <span className="px-2 py-0.5 bg-th-hover text-th-secondary text-[10px] font-bold uppercase tracking-wider rounded-lg">{v.visitType}</span>
                          )}
                          {(() => {
                            const linkedPrescription = findLinkedPrescription(prescriptions, v);
                            const rightHas = linkedPrescription && hasEyeData(linkedPrescription.rightEye);
                            const leftHas = linkedPrescription && hasEyeData(linkedPrescription.leftEye);
                            if (rightHas && leftHas) return null;
                            return (
                              <>
                                {!rightHas && (
                                  <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] font-bold uppercase tracking-wider rounded-lg">{uiT("R: Plain", "R: प्लेन")}</span>
                                )}
                                {!leftHas && (
                                  <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-[10px] font-bold uppercase tracking-wider rounded-lg">{uiT("L: Plain", "L: प्लेन")}</span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        {v.doctorName && <p className="text-xs text-th-secondary mt-0.5 flex items-center gap-1"><Stethoscope size={11} /> Dr. {v.doctorName}</p>}
                        {v.remarks && <p className="text-xs text-th-secondary mt-0.5 line-clamp-1">{v.remarks}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={(e) => { e.stopPropagation(); openVisitDetail(v); }}
                        className="px-3 py-1.5 bg-th-hover rounded-lg text-xs font-medium text-th-secondary hover:bg-[#1ed760]/10 hover:text-[#1ed760] transition-all duration-150 opacity-0 group-hover:opacity-100 flex items-center gap-1">
                        <Eye size={12} /> {uiT("View", "देखें")}
                      </button>
                      <span className="text-[11px] text-th-secondary">{new Date(v.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      <ChevronRight size={15} className="text-[#535353] group-hover:text-th-secondary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "prescriptions" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-th-text tracking-tight flex items-center gap-2">
                <Eye size={16} className="text-purple-400" /> {uiT("Prescriptions", "प्रिस्क्रिप्शन")} ({prescriptions.length})
              </h3>
              <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
                <Plus size={14} /> {uiT("Add Prescription", "प्रिस्क्रिप्शन जोड़ें")}
              </button>
            </div>
            {prescriptions.length === 0 ? (
              <div className="bg-th-surface rounded-lg flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 bg-th-elevated rounded-full flex items-center justify-center">
                  <Eye size={24} className="text-[#535353]" />
                </div>
                <p className="text-sm font-medium text-th-secondary">{uiT("No prescriptions yet", "अभी तक कोई प्रिस्क्रिप्शन नहीं")}</p>
                <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
                  <Plus size={14} /> {uiT("Create First Prescription", "पहला प्रिस्क्रिप्शन बनाएं")}
                </button>
              </div>
            ) : (
              prescriptions.map((p: any) => (
                <div key={p._id} className="bg-th-surface rounded-lg p-5 hover:bg-th-hover transition-colors">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-400">
                      <Eye size={14} />
                    </div>
                    <p className="text-sm font-semibold text-th-text">
                      {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <span className="text-[10px] text-th-secondary ml-auto font-mono">{p._id.slice(-6)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-th-elevated rounded-lg p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6ea8fe] mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#6ea8fe]" /> {uiT("Right Eye", "दाहिनी आंख")}
                      </p>
                      {p.rightEye?.dv && <EyeRow label="DV" data={p.rightEye.dv} />}
                      {p.rightEye?.nv && <EyeRow label="NV" data={p.rightEye.nv} />}
                      {p.rightEye?.pc && <EyeRow label="PC" data={p.rightEye.pc} />}
                      {!p.rightEye?.dv && !p.rightEye?.nv && !p.rightEye?.pc && (
                        <p className="text-xs text-th-secondary italic">{uiT("No prescription data", "कोई प्रिस्क्रिप्शन डेटा नहीं")}</p>
                      )}
                    </div>
                    <div className="bg-th-elevated rounded-lg p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#e8a427] mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#e8a427]" /> {uiT("Left Eye", "बाईं आंख")}
                      </p>
                      {p.leftEye?.dv && <EyeRow label="DV" data={p.leftEye.dv} />}
                      {p.leftEye?.nv && <EyeRow label="NV" data={p.leftEye.nv} />}
                      {p.leftEye?.pc && <EyeRow label="PC" data={p.leftEye.pc} />}
                      {!p.leftEye?.dv && !p.leftEye?.nv && !p.leftEye?.pc && (
                        <p className="text-xs text-th-secondary italic">{uiT("No prescription data", "कोई प्रिस्क्रिप्शन डेटा नहीं")}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4 pt-4 border-t border-th-border">
                    {p.pd && <p className="text-xs text-th-secondary"><span className="font-medium text-th-secondary">PD:</span> {p.pd}</p>}
                    {p.notes && <p className="text-xs text-th-secondary"><span className="font-medium text-th-secondary">{uiT("Notes:", "नोट्स:")}</span> {p.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "bills" && (
          <div className="bg-th-surface rounded-lg p-5">
            <h3 className="text-base font-bold text-th-text tracking-tight flex items-center gap-2 mb-5">
              <Receipt size={16} className="text-[#1ed760]" /> {uiT("Bills", "बिल")} ({bills.length})
            </h3>
            {bills.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 bg-th-elevated rounded-full flex items-center justify-center">
                  <Receipt size={24} className="text-[#535353]" />
                </div>
                <p className="text-sm font-medium text-th-secondary">{uiT("No bills yet", "अभी तक कोई बिल नहीं")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bills.map((b: any) => (
                  <div key={b._id} className="flex items-center justify-between p-4 rounded-lg bg-th-elevated hover:bg-th-hover active:scale-[0.99] transition-transform">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-th-hover rounded-full flex items-center justify-center text-th-secondary">
                        <FileText size={15} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-th-text">{b.billNumber || "—"}</p>
                        <p className="text-xs text-th-secondary">{new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-bold text-th-text">₹{(b.totalAmount || 0).toLocaleString()}</p>
                      <div className="flex items-center gap-2 justify-end">
                        {(b.pendingAmount || 0) > 0 ? (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#e8a427] bg-[#e8a427]/10 px-2 py-0.5 rounded-lg">₹{b.pendingAmount} due</span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#1ed760] bg-[#1ed760]/10 px-2 py-0.5 rounded-lg">{uiT("Paid", "भुगतान")}</span>
                        )}
                        <button onClick={() => sendWhatsApp(customer.mobile, b)}
                          className="text-[10px] font-bold uppercase tracking-wider text-[#1ed760] hover:bg-[#1ed760]/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
                          <MessageCircle size={11} /> Send
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="bg-th-surface rounded-lg p-5">
            <h3 className="text-base font-bold text-th-text tracking-tight flex items-center gap-2 mb-5">
              <ShoppingCart size={16} className="text-[#e8a427]" /> {uiT("Orders", "ऑर्डर")} ({orders.length})
            </h3>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 bg-th-elevated rounded-full flex items-center justify-center">
                  <ShoppingCart size={24} className="text-[#535353]" />
                </div>
                <p className="text-sm font-medium text-th-secondary">{uiT("No orders yet", "अभी तक कोई ऑर्डर नहीं")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map((o: any) => (
                  <div key={o._id} className="flex items-center justify-between p-4 rounded-lg bg-th-elevated hover:bg-th-hover active:scale-[0.99] transition-transform">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-th-hover rounded-full flex items-center justify-center text-th-secondary shrink-0">
                        <ShoppingCart size={15} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-th-text truncate">
                          {[o.frameBrand, o.frame, o.lensBrand, o.lens].filter(Boolean).join(" / ") || "Order"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-th-secondary mt-0.5">
                          <span>{uiT("Qty", "मात्रा")}: {o.quantity || 1}</span>
                          {o.deliveryDate && <span>{uiT("Delivery", "डिलीवरी")}: {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg shrink-0 ${
                      o.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                      o.status === "Cancelled" ? "bg-red-500/10 text-red-400" :
                      o.status === "Ready" ? "bg-[#6ea8fe]/10 text-[#6ea8fe]" : "bg-[#e8a427]/10 text-[#e8a427]"
                    }`}>{o.status || "Draft"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVisit(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl bg-th-surface rounded-xl max-h-[90vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-th-surface border-b border-th-border flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760]">
                  <Calendar size={16} />
                </div>
                <h2 className="text-lg font-bold text-th-text">{uiT("Visit Details", "विज़िट विवरण")}</h2>
              </div>
              <div className="flex items-center gap-2">
                {!editingVisit && (
                  <button onClick={() => { setEditingVisit(true); }} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-colors">
                    <Edit3 size={13} /> {uiT("Edit", "संपादित करें")}
                  </button>
                )}
                <button onClick={() => setSelectedVisit(null)} className="p-2 hover:bg-th-elevated rounded-lg transition-colors">
                  <X size={18} className="text-th-secondary" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-th-elevated rounded-lg p-5">
                {editingVisit ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1.5 block">{uiT("Visit Date", "विज़िट तिथि")}</label>
                      <input type="date" className="w-full bg-th-hover text-th-text px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" value={editVisitForm.visitDate || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, visitDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1.5 block">{uiT("Doctor Name", "डॉक्टर का नाम")}</label>
                      <input className="w-full bg-th-hover text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" placeholder={uiT("Doctor name", "डॉक्टर का नाम")} value={editVisitForm.doctorName || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, doctorName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold uppercase tracking-wider text-th-secondary mb-1.5 block">{uiT("Remarks", "टिप्पणी")}</label>
                      <textarea className="w-full bg-th-hover text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-sm outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow" rows={2} placeholder={uiT("Remarks", "टिप्पणी")} value={editVisitForm.remarks || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, remarks: e.target.value })} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleVisitSave} disabled={savingVisit} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform disabled:opacity-50">
                        <Save size={13} /> {savingVisit ? "Saving..." : uiT("Save", "सहेजें")}
                      </button>
                      <button onClick={() => setEditingVisit(false)} className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-colors">
                        <X size={13} /> {uiT("Cancel", "रद्द करें")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760] flex-shrink-0">
                      <Calendar size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-th-text">
                        {new Date(selectedVisit.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {selectedVisit.doctorName && (
                          <span className="flex items-center gap-1.5 text-xs text-th-secondary">
                            <User size={12} className="text-th-secondary" /> Dr. {selectedVisit.doctorName}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-xs text-th-secondary">
                          <Clock size={12} className="text-th-secondary" /> Created {new Date(selectedVisit.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {selectedVisit.remarks && (
                        <p className="text-sm text-th-secondary mt-3 bg-th-hover rounded-lg p-3">{selectedVisit.remarks}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {linkedPrescription && (
                <div className="bg-th-elevated rounded-lg p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 bg-purple-500/10 rounded-full flex items-center justify-center text-purple-400">
                      <Eye size={14} />
                    </div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text">{uiT("Prescription", "प्रिस्क्रिप्शन")}</h3>
                    <span className="text-[10px] text-th-secondary ml-auto">
                      {new Date(linkedPrescription.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-th-hover rounded-lg p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6ea8fe] mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#6ea8fe]" /> {uiT("Right Eye", "दाहिनी आंख")}
                      </p>
                      {linkedPrescription.rightEye?.dv && <EyeRow label="DV" data={linkedPrescription.rightEye.dv} />}
                      {linkedPrescription.rightEye?.nv && <EyeRow label="NV" data={linkedPrescription.rightEye.nv} />}
                      {linkedPrescription.rightEye?.pc && <EyeRow label="PC" data={linkedPrescription.rightEye.pc} />}
                      {!linkedPrescription.rightEye?.dv && !linkedPrescription.rightEye?.nv && !linkedPrescription.rightEye?.pc && (
                        <p className="text-xs text-th-secondary italic">{uiT("No data", "कोई डेटा नहीं")}</p>
                      )}
                    </div>
                    <div className="bg-th-hover rounded-lg p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#e8a427] mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#e8a427]" /> {uiT("Left Eye", "बाईं आंख")}
                      </p>
                      {linkedPrescription.leftEye?.dv && <EyeRow label="DV" data={linkedPrescription.leftEye.dv} />}
                      {linkedPrescription.leftEye?.nv && <EyeRow label="NV" data={linkedPrescription.leftEye.nv} />}
                      {linkedPrescription.leftEye?.pc && <EyeRow label="PC" data={linkedPrescription.leftEye.pc} />}
                      {!linkedPrescription.leftEye?.dv && !linkedPrescription.leftEye?.nv && !linkedPrescription.leftEye?.pc && (
                        <p className="text-xs text-th-secondary italic">{uiT("No data", "कोई डेटा नहीं")}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4 pt-3 border-t border-th-border">
                    {linkedPrescription.pd && <p className="text-xs text-th-secondary"><span className="font-medium text-th-secondary">PD:</span> {linkedPrescription.pd}</p>}
                    {linkedPrescription.notes && <p className="text-xs text-th-secondary"><span className="font-medium text-th-secondary">{uiT("Notes:", "नोट्स:")}</span> {linkedPrescription.notes}</p>}
                  </div>
                </div>
              )}

              {linkedOrder && (
                <div className="bg-th-elevated rounded-lg p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 bg-[#e8a427]/10 rounded-full flex items-center justify-center text-[#e8a427]">
                      <ShoppingCart size={14} />
                    </div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text">{uiT("Order", "ऑर्डर")}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-lg ml-auto ${
                      linkedOrder.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                      linkedOrder.status === "Ready" ? "bg-[#6ea8fe]/10 text-[#6ea8fe]" :
                      linkedOrder.status === "Cancelled" ? "bg-red-500/10 text-red-400" : "bg-[#e8a427]/10 text-[#e8a427]"
                    }`}>{linkedOrder.status || "Draft"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    {linkedOrder.frame && (
                      <>
                        <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Frame", "फ्रेम")}</p>
                        <p className="text-xs font-semibold text-th-text text-right">
                          {[linkedOrder.frameBrand, linkedOrder.frameModel, linkedOrder.frameColor, linkedOrder.frameSize].filter(Boolean).join(" / ") || linkedOrder.frame}
                          {linkedOrder.framePrice ? ` (₹${linkedOrder.framePrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.lens && (
                      <>
                        <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Lens", "लेंस")}</p>
                        <p className="text-xs font-semibold text-th-text text-right">
                          {[linkedOrder.lensBrand, linkedOrder.lensType, linkedOrder.lensIndex].filter(Boolean).join(" / ") || linkedOrder.lens}
                          {linkedOrder.lensPrice ? ` (₹${linkedOrder.lensPrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.coating && (
                      <>
                        <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Coating", "कोटिंग")}</p>
                        <p className="text-xs font-semibold text-th-text text-right">
                          {linkedOrder.coating}{linkedOrder.coatingPrice ? ` (₹${linkedOrder.coatingPrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.accessories?.length > 0 && (
                      <>
                        <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Accessories", "सहायक उपकरण")}</p>
                        <p className="text-xs font-semibold text-th-text text-right">{linkedOrder.accessories.join(", ")}</p>
                      </>
                    )}
                    <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Quantity", "मात्रा")}</p>
                    <p className="text-xs font-semibold text-th-text text-right">{linkedOrder.quantity || 1}</p>
                    {linkedOrder.deliveryDate && (
                      <>
                        <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Delivery Date", "डिलीवरी तिथि")}</p>
                        <p className="text-xs font-semibold text-th-text text-right">
                          {new Date(linkedOrder.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </>
                    )}
                    {linkedOrder.labAssigned && (
                      <>
                        <p className="text-[11px] text-th-secondary font-bold uppercase tracking-wider">{uiT("Lab", "लैब")}</p>
                        <p className="text-xs font-semibold text-th-text text-right">{linkedOrder.labAssigned}{linkedOrder.labExpectedDate ? ` (by ${new Date(linkedOrder.labExpectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})` : ""}</p>
                      </>
                    )}
                  </div>
                  {linkedOrder.labRemarks && (
                    <p className="text-xs text-th-secondary mt-3 pt-3 border-t border-th-border">{uiT("Lab Remarks", "लैब टिप्पणी")}: {linkedOrder.labRemarks}</p>
                  )}
                </div>
              )}

              {linkedBill && (
                <div className="bg-th-elevated rounded-lg p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760]">
                      <Receipt size={14} />
                    </div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-th-text">{uiT("Bill", "बिल")}</h3>
                    <span className="text-[10px] text-th-secondary ml-auto font-mono">{linkedBill.billNumber}</span>
                  </div>
                  {linkedBill.items?.length > 0 && (
                    <div className="overflow-x-auto mb-4 rounded-lg">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-th-border">
                            <th className="text-left py-2.5 px-3 font-bold uppercase tracking-wider text-th-secondary text-[10px]">{uiT("Description", "विवरण")}</th>
                            <th className="text-center py-2.5 px-3 font-bold uppercase tracking-wider text-th-secondary text-[10px]">{uiT("Qty", "मात्रा")}</th>
                            <th className="text-right py-2.5 px-3 font-bold uppercase tracking-wider text-th-secondary text-[10px]">{uiT("Price", "मूल्य")}</th>
                            <th className="text-right py-2.5 px-3 font-bold uppercase tracking-wider text-th-secondary text-[10px]">{uiT("Total", "कुल")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-th-border">
                          {linkedBill.items.map((it: any, i: number) => (
                            <tr key={it._id || it.description || i}>
                              <td className="py-2.5 px-3 text-th-text">{it.description || uiT("Item", "आइटम")}</td>
                              <td className="py-2.5 px-3 text-center text-th-secondary">{it.quantity || 1}</td>
                              <td className="py-2.5 px-3 text-right text-th-secondary">₹{(it.unitPrice || 0).toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-th-text">₹{((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-th-secondary">
                      <span>{uiT("Subtotal", "उप-कुल")}</span>
                      <span>₹{(linkedBill.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {linkedBill.discount ? (
                      <div className="flex justify-between text-red-400">
                        <span>{uiT("Discount", "छूट")}</span>
                        <span>-₹{linkedBill.discount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    {linkedBill.tax ? (
                      <div className="flex justify-between text-[#1ed760]">
                        <span>{uiT("GST", "जीएसटी")}</span>
                        <span>+₹{linkedBill.tax.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-bold text-th-text pt-2 border-t border-th-border">
                      <span>{uiT("Total", "कुल")}</span>
                      <span>₹{(linkedBill.totalAmount || 0).toFixed(2)}</span>
                    </div>
                    {linkedBill.advancePaid !== undefined && (
                      <div className="flex justify-between text-[#1ed760] items-center pt-1">
                        <span>{uiT("Paid", "भुगतान")}</span>
                        {editingBillAdvance ? (
                          <div className="flex items-center gap-1.5">
                            <input type="number" min="0" step="0.01"
                              className="w-24 bg-th-hover text-th-text px-2 py-1 rounded-md text-xs text-right outline-none focus:ring-1 focus:ring-[#1ed760]"
                              value={editBillAdvanceAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setEditBillAdvanceAmount(Number(e.target.value))} />
                            <button onClick={handleBillAdvanceSave} disabled={savingBillAdvance}
                              className="p-1.5 hover:bg-[#1ed760]/10 rounded-full text-[#1ed760] transition-colors">
                              {savingBillAdvance ? <div className="animate-spin w-3 h-3 border-2 border-[#1ed760] border-t-transparent rounded-full" /> : <Save size={12} />}
                            </button>
                            <button onClick={() => setEditingBillAdvance(false)}
                              className="p-1.5 hover:bg-red-500/10 rounded-full text-red-400 transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">₹{linkedBill.advancePaid.toFixed(2)}</span>
                            <button onClick={() => { setEditBillAdvanceAmount(linkedBill.advancePaid || 0); setEditingBillAdvance(true); }}
                              className="px-2 py-1 bg-[#1ed760]/10 text-[#1ed760] rounded-lg text-[10px] font-medium hover:bg-[#1ed760]/20 transition-colors flex items-center gap-1">
                              <Edit3 size={10} /> {uiT("Edit", "संपादित करें")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {(linkedBill.pendingAmount || 0) > 0 ? (
                      <div className="flex justify-between text-[#e8a427] font-bold pt-1">
                        <span>{uiT("Balance Due", "बकाया राशि")}</span>
                        <span>₹{linkedBill.pendingAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2 mt-4 pt-3 border-t border-th-border">
                    <button onClick={() => sendWhatsApp(customer?.mobile, linkedBill)}
                      className="px-3 py-1.5 bg-[#1ed760]/10 text-[#1ed760] rounded-lg text-xs font-medium hover:bg-[#1ed760]/20 transition-colors flex items-center gap-1.5">
                      <MessageCircle size={12} /> {uiT("Send Bill", "बिल भेजें")}
                    </button>
                  </div>
                </div>
              )}

              {!linkedPrescription && !linkedOrder && !linkedBill && (
                <div className="bg-th-surface rounded-lg p-8 text-center">
                  <div className="w-12 h-12 bg-th-elevated rounded-full flex items-center justify-center mx-auto mb-3">
                    <Activity size={22} className="text-[#535353]" />
                  </div>
                  <p className="text-sm text-th-secondary">{uiT("No linked prescription, order, or bill for this visit.", "इस विज़िट के लिए कोई प्रिस्क्रिप्शन, ऑर्डर या बिल नहीं जुड़ा है।")}</p>
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
  const sph = data.sph != null ? (data.sph > 0 ? `+${Number(data.sph).toFixed(2)}` : Number(data.sph).toFixed(2)) : "—";
  const cyl = data.cyl != null ? (data.cyl > 0 ? `+${Number(data.cyl).toFixed(2)}` : Number(data.cyl).toFixed(2)) : "—";
  const axis = data.axis != null ? `× ${data.axis}` : "—";
  return (
    <div className="text-xs text-th-secondary mb-2 last:mb-0">
      <span className="font-bold text-th-text bg-th-border px-1.5 py-0.5 rounded text-[10px] mr-1.5">{label}</span>
      <span className="text-th-secondary">SPH</span> <span className="font-semibold text-th-text">{sph}</span>
      <span className="text-[#535353] mx-1">|</span>
      <span className="text-th-secondary">CYL</span> <span className="font-semibold text-th-text">{cyl}</span>
      <span className="text-[#535353] mx-1">|</span>
      <span className="text-th-secondary">AXIS</span> <span className="font-semibold text-th-text">{axis}</span>
      {data.va && <><span className="text-[#535353] mx-1">|</span><span className="text-th-secondary">VA</span> <span className="font-semibold text-th-text">{data.va}</span></>}
    </div>
  );
}

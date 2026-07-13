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
import { formatEyeRx } from "../utils/rx";

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
    <div className="page-container">
      <button onClick={() => navigate("/customers")}
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-all duration-300 mb-4 hover:-translate-x-0.5">
        <ArrowLeft size={16} /> {uiT("Back to Customers", "ग्राहकों पर वापस जाएं")}
      </button>

      <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 dark:from-primary-700 dark:via-primary-800 dark:to-primary-950 rounded-3xl shadow-xl mb-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative p-6 lg:p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-5">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white font-bold text-3xl flex-shrink-0 shadow-lg ring-2 ring-white/30">
                {customer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                {editing ? (
                  <div className="space-y-3 max-w-lg">
                    <input className="input-field text-lg font-bold bg-white/90" value={editForm.name || ""}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                    <div className="grid grid-cols-2 gap-3">
                      <input className="input-field bg-white/90" placeholder={uiT("Mobile", "मोबाइल")} value={editForm.mobile || ""}
                        onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
                      <input className="input-field bg-white/90" placeholder={uiT("Email", "ईमेल")} value={editForm.email || ""}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                      <input className="input-field bg-white/90" placeholder={uiT("Age", "आयु")} type="number" value={editForm.age || ""}
                        onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} />
                      <select className="input-field bg-white/90" value={editForm.gender || ""}
                        onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                        <option value="">{uiT("Gender", "लिंग")}</option>
                        <option value="Male">{uiT("Male", "पुरुष")}</option><option value="Female">{uiT("Female", "महिला")}</option><option value="Other">{uiT("Other", "अन्य")}</option>
                      </select>
                      <input className="input-field bg-white/90" placeholder={uiT("City", "शहर")} value={editForm.city || ""}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                      <input className="input-field bg-white/90" placeholder={uiT("Alt Mobile", "वैकल्पिक मोबाइल")} value={editForm.alternateMobile || ""}
                        onChange={(e) => setEditForm({ ...editForm, alternateMobile: e.target.value })} />
                      <div className="col-span-2">
                        <textarea className="input-field bg-white/90" placeholder={uiT("Address", "पता")} rows={2} value={editForm.address || ""}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleEditSave} disabled={saving} className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 px-4 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-1.5 text-sm">
                        <Save size={15} /> {saving ? "Saving..." : uiT("Save", "सहेजें")}
                      </button>
                      <button onClick={() => setEditing(false)} className="bg-white/20 hover:bg-white/30 text-white font-medium py-2 px-4 rounded-xl transition-all duration-300 backdrop-blur-sm flex items-center gap-1.5 text-sm">
                        <X size={15} /> {uiT("Cancel", "रद्द करें")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <h1 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">{customer.name}</h1>
                    <p className="text-white/70 text-sm flex items-center gap-1.5 mt-1">
                      <IdCard size={13} /> {customer.customerId || "—"}
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-4">
                      {customer.mobile && (
                        <span className="flex items-center gap-1.5 text-sm text-white/80">
                          <Phone size={14} className="text-white/60" /> {customer.mobile}
                        </span>
                      )}
                      {customer.email && (
                        <span className="flex items-center gap-1.5 text-sm text-white/80">
                          <Mail size={14} className="text-white/60" /> {customer.email}
                        </span>
                      )}
                      {customer.city && (
                        <span className="flex items-center gap-1.5 text-sm text-white/80">
                          <MapPinned size={14} className="text-white/60" /> {customer.city}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 text-sm text-white/80">
                        <Calendar size={14} className="text-white/60" /> {uiT("Joined", "शामिल हुए")} {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                      </span>
                      {customer.age && <span className="text-sm text-white/80"><User size={14} className="inline mr-1 text-white/60" />Age: {customer.age}</span>}
                      {customer.gender && <span className="text-sm text-white/80">{customer.gender}</span>}
                    </div>
                    {customer.address && <p className="text-sm text-white/70 mt-2 flex items-center gap-1.5"><MapPin size={13} className="text-white/60" />{customer.address}</p>}
                    {customer.alternateMobile && <p className="text-sm text-white/70 mt-1 flex items-center gap-1.5"><Phone size={13} className="text-white/60" />{uiT("Alt", "वैकल्पिक")}: {customer.alternateMobile}</p>}
                    {customer.tags?.length > 0 && (
                      <div className="flex gap-2 mt-4">
                        {customer.tags.map((tag: string, i: number) => (
                          <span key={tag} className="px-3 py-1 bg-white/20 backdrop-blur-sm text-white text-xs font-medium rounded-full ring-1 ring-white/30">{tag}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            {!editing && (
              <button onClick={() => setEditing(true)} className="bg-white/20 hover:bg-white/30 text-white font-medium py-2.5 px-4 rounded-xl transition-all duration-300 backdrop-blur-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2 text-sm">
                <Edit3 size={15} /> {uiT("Edit Profile", "प्रोफ़ाइल संपादित करें")}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
        <div className="card flex items-center gap-4 p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="w-12 h-12 bg-primary-50 dark:bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
            <ClipboardList size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{customer.totalVisits || 0}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{uiT("Total Visits", "कुल विज़िट")}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <TrendingUp size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">₹{(customer.totalSpent || 0).toLocaleString()}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{uiT("Total Spent", "कुल खर्च")}</p>
          </div>
        </div>
        <div className="card flex items-center gap-4 p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 flex-shrink-0">
            <Wallet size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tracking-tight">₹{(customer.pendingAmount || 0).toLocaleString()}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{uiT("Pending Amount", "बाकी राशि")}</p>
          </div>
        </div>
        <div onClick={() => navigate(`/customers/${id}/create-visit`)}
          className="card flex items-center gap-4 p-5 cursor-pointer bg-gradient-to-br from-primary-600 to-primary-500 border-0 hover:-translate-y-0.5 hover:shadow-xl transition-all duration-300 group">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white flex-shrink-0">
            <Plus size={22} />
          </div>
          <div className="min-w-0">
            <p className="text-lg font-bold text-white tracking-tight">{uiT("New Visit", "नई विज़िट")}</p>
            <p className="text-xs text-white/70">{uiT("with prescription", "प्रिस्क्रिप्शन के साथ")}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800/80 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50 p-1 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-300 whitespace-nowrap flex-1 justify-center ${
                  isActive
                    ? "bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300 shadow-sm"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
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
          <div className="space-y-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-primary-500" /> {uiT("Customer Summary", "ग्राहक सारांश")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="card p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-primary-50 dark:bg-primary-500/10 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                    <Calendar size={16} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{uiT("Last 5 Visits", "अंतिम 5 विज़िट")}</p>
                </div>
                {visits.slice(0, 5).length > 0 ? (
                  <div className="space-y-2.5">
                    {visits.slice(0, 5).map((v: any) => (
                      <div key={v._id} className="flex items-center gap-3 text-sm group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30 -mx-2 px-2 py-1.5 rounded-lg transition-colors">
                        <div className="w-2 h-2 rounded-full bg-primary-400 flex-shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200">{new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        {v.doctorName && <span className="text-slate-500">— {v.doctorName}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Calendar size={24} className="text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-400">{uiT("No visits yet", "अभी तक कोई विज़िट नहीं")}</p>
                  </div>
                )}
              </div>
              <div className="card p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Eye size={16} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{uiT("Latest Prescription", "नवीनतम प्रिस्क्रिप्शन")}</p>
                </div>
                {prescriptions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="bg-blue-50/50 dark:bg-blue-500/5 rounded-xl p-3 border border-blue-100 dark:border-blue-500/10">
                      <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1">{uiT("Right Eye", "दाहिनी आंख")}</p>
                      <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{formatEyeRx(prescriptions[0].rightEye?.dv?.sph, prescriptions[0].rightEye?.dv?.cyl, prescriptions[0].rightEye?.dv?.axis)}</p>
                    </div>
                    <div className="bg-amber-50/50 dark:bg-amber-500/5 rounded-xl p-3 border border-amber-100 dark:border-amber-500/10">
                      <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1">{uiT("Left Eye", "बाईं आंख")}</p>
                      <p className="text-sm font-mono font-semibold text-slate-800 dark:text-slate-200">{formatEyeRx(prescriptions[0].leftEye?.dv?.sph, prescriptions[0].leftEye?.dv?.cyl, prescriptions[0].leftEye?.dv?.axis)}</p>
                    </div>
                    {prescriptions[0].pd && <p className="text-xs text-slate-500">PD: {prescriptions[0].pd}</p>}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Eye size={24} className="text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-400">{uiT("No prescriptions", "कोई प्रिस्क्रिप्शन नहीं")}</p>
                  </div>
                )}
              </div>
              <div className="card p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <ShoppingCart size={16} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{uiT("Recent Orders", "हालिया ऑर्डर")}</p>
                </div>
                {orders.slice(0, 5).length > 0 ? (
                  <div className="space-y-2.5">
                    {orders.slice(0, 5).map((o: any) => (
                      <div key={o._id} className="flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <span className="text-sm text-slate-800 dark:text-slate-200 truncate">{o.frame || o.lens || "Order"}</span>
                        <span className={`badge shrink-0 ${
                          o.status === "Delivered" ? "badge-green" :
                          o.status === "Ready" ? "badge-blue" :
                          o.status === "Cancelled" ? "badge-red" : "badge-yellow"
                        }`}>{o.status}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <ShoppingCart size={24} className="text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-400">{uiT("No orders", "कोई ऑर्डर नहीं")}</p>
                  </div>
                )}
              </div>
              <div className="card p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Receipt size={16} />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{uiT("Recent Bills", "हालिया बिल")}</p>
                </div>
                {bills.slice(0, 5).length > 0 ? (
                  <div className="space-y-2.5">
                    {bills.slice(0, 5).map((b: any) => (
                      <div key={b._id} className="flex items-center justify-between gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <span className="text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <FileText size={13} className="text-slate-400" /> {b.billNumber}
                        </span>
                        <span className="text-sm font-semibold text-emerald-600">₹{(b.totalAmount || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <Receipt size={24} className="text-slate-300 dark:text-slate-600" />
                    <p className="text-sm text-slate-400">{uiT("No bills", "कोई बिल नहीं")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "visits" && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <ClipboardList size={18} className="text-primary-500" /> {uiT("All Visits", "सभी विज़िट")} ({visits.length})
              </h3>
              <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="btn-primary flex items-center gap-1.5 shadow-sm">
                <Plus size={15} /> {uiT("Add Visit", "विज़िट जोड़ें")}
              </button>
            </div>
            {visits.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center">
                  <Calendar size={28} className="text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-500">{uiT("No visits recorded yet", "अभी तक कोई विज़िट दर्ज नहीं")}</p>
                <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="btn-primary flex items-center gap-1.5 text-sm">
                  <Plus size={14} /> {uiT("Create First Visit", "पहली विज़िट बनाएं")}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {visits.map((v: any, idx: number) => (
                  <div key={v._id} id={`visit-${v._id}`}
                    onClick={() => openVisitDetail(v)}
                    className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 hover:bg-primary-50/50 dark:hover:bg-primary-500/5 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer group border border-slate-100 dark:border-slate-700/30 hover:border-primary-200 dark:hover:border-primary-500/20 hover:shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-300 shadow-sm">
                          <Calendar size={17} />
                        </div>
                        {idx < visits.length - 1 && (
                          <div className="absolute top-full left-1/2 -translate-x-1/2 w-px h-3 bg-slate-200 dark:bg-slate-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {v.visitType && (
                            <span className="px-2 py-0.5 bg-slate-200/70 dark:bg-slate-600/50 text-slate-600 dark:text-slate-300 text-[10px] font-medium rounded-full">{v.visitType}</span>
                          )}
                        </div>
                        {v.doctorName && <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1"><Stethoscope size={11} /> Dr. {v.doctorName}</p>}
                        {v.remarks && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{v.remarks}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={(e) => { e.stopPropagation(); openVisitDetail(v); }}
                        className="px-3 py-1.5 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-primary-50 dark:hover:bg-primary-500/10 hover:border-primary-200 dark:hover:border-primary-500/30 hover:text-primary-600 dark:hover:text-primary-400 transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-sm flex items-center gap-1">
                        <Eye size={12} /> {uiT("View", "देखें")}
                      </button>
                      <span className="text-[11px] text-slate-400">{new Date(v.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                      <ChevronRight size={15} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
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
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <Eye size={18} className="text-purple-500" /> {uiT("Prescriptions", "प्रिस्क्रिप्शन")} ({prescriptions.length})
              </h3>
              <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="btn-primary flex items-center gap-1.5 shadow-sm">
                <Plus size={15} /> {uiT("Add Prescription", "प्रिस्क्रिप्शन जोड़ें")}
              </button>
            </div>
            {prescriptions.length === 0 ? (
              <div className="card flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center">
                  <Eye size={28} className="text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-500">{uiT("No prescriptions yet", "अभी तक कोई प्रिस्क्रिप्शन नहीं")}</p>
                <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="btn-primary flex items-center gap-1.5 text-sm">
                  <Plus size={14} /> {uiT("Create First Prescription", "पहला प्रिस्क्रिप्शन बनाएं")}
                </button>
              </div>
            ) : (
              prescriptions.map((p: any) => (
                <div key={p._id} className="card p-5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <Eye size={16} />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <span className="text-[10px] text-slate-400 ml-auto font-mono">{p._id.slice(-6)}</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-50/30 dark:from-blue-500/5 dark:to-blue-500/[0.02] rounded-2xl p-4 border border-blue-100/80 dark:border-blue-500/10">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> {uiT("Right Eye", "दाहिनी आंख")}
                      </p>
                      {p.rightEye?.dv && <EyeRow label="DV" data={p.rightEye.dv} />}
                      {p.rightEye?.nv && <EyeRow label="NV" data={p.rightEye.nv} />}
                      {p.rightEye?.pc && <EyeRow label="PC" data={p.rightEye.pc} />}
                      {!p.rightEye?.dv && !p.rightEye?.nv && !p.rightEye?.pc && (
                        <p className="text-xs text-blue-300 dark:text-blue-500 italic">{uiT("No prescription data", "कोई प्रिस्क्रिप्शन डेटा नहीं")}</p>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-50/30 dark:from-amber-500/5 dark:to-amber-500/[0.02] rounded-2xl p-4 border border-amber-100/80 dark:border-amber-500/10">
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> {uiT("Left Eye", "बाईं आंख")}
                      </p>
                      {p.leftEye?.dv && <EyeRow label="DV" data={p.leftEye.dv} />}
                      {p.leftEye?.nv && <EyeRow label="NV" data={p.leftEye.nv} />}
                      {p.leftEye?.pc && <EyeRow label="PC" data={p.leftEye.pc} />}
                      {!p.leftEye?.dv && !p.leftEye?.nv && !p.leftEye?.pc && (
                        <p className="text-xs text-amber-300 dark:text-amber-500 italic">{uiT("No prescription data", "कोई प्रिस्क्रिप्शन डेटा नहीं")}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/30">
                    {p.pd && <p className="text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">PD:</span> {p.pd}</p>}
                    {p.notes && <p className="text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">{uiT("Notes:", "नोट्स:")}</span> {p.notes}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "bills" && (
          <div className="card p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mb-5">
              <Receipt size={18} className="text-emerald-500" /> {uiT("Bills", "बिल")} ({bills.length})
            </h3>
            {bills.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center">
                  <Receipt size={28} className="text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-500">{uiT("No bills yet", "अभी तक कोई बिल नहीं")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bills.map((b: any) => (
                  <div key={b._id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/30 hover:border-emerald-200 dark:hover:border-emerald-500/20 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-300 shadow-sm">
                        <FileText size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{b.billNumber || "—"}</p>
                        <p className="text-xs text-slate-500">{new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">₹{(b.totalAmount || 0).toLocaleString()}</p>
                      <div className="flex items-center gap-2 justify-end">
                        {(b.pendingAmount || 0) > 0 ? (
                          <span className="text-[11px] font-medium text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">₹{b.pendingAmount} due</span>
                        ) : (
                          <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">{uiT("Paid", "भुगतान")}</span>
                        )}
                        <button onClick={() => sendWhatsApp(customer.mobile, b)}
                          className="text-[11px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1">
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
          <div className="card p-5">
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2 mb-5">
              <ShoppingCart size={18} className="text-amber-500" /> {uiT("Orders", "ऑर्डर")} ({orders.length})
            </h3>
            {orders.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12">
                <div className="w-14 h-14 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center">
                  <ShoppingCart size={28} className="text-slate-300 dark:text-slate-500" />
                </div>
                <p className="text-sm font-medium text-slate-500">{uiT("No orders yet", "अभी तक कोई ऑर्डर नहीं")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((o: any) => (
                  <div key={o._id} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/30 hover:border-amber-200 dark:hover:border-amber-500/20 hover:-translate-y-0.5 transition-all duration-300 hover:shadow-sm">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-300 shadow-sm shrink-0">
                        <ShoppingCart size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {[o.frameBrand, o.frame, o.lensBrand, o.lens].filter(Boolean).join(" / ") || "Order"}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                          <span>{uiT("Qty", "मात्रा")}: {o.quantity || 1}</span>
                          {o.deliveryDate && <span>{uiT("Delivery", "डिलीवरी")}: {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`badge shrink-0 ${
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setSelectedVisit(null)}>
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700/50 flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-50 dark:bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400">
                  <Calendar size={18} />
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{uiT("Visit Details", "विज़िट विवरण")}</h2>
              </div>
              <div className="flex items-center gap-2">
                {!editingVisit && (
                  <button onClick={() => { setEditingVisit(true); }} className="btn-primary flex items-center gap-1.5 shadow-sm">
                    <Edit3 size={14} /> {uiT("Edit", "संपादित करें")}
                  </button>
                )}
                <button onClick={() => setSelectedVisit(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                  <X size={18} className="text-slate-500" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="card p-5">
                {editingVisit ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">{uiT("Visit Date", "विज़िट तिथि")}</label>
                      <input type="date" className="input-field" value={editVisitForm.visitDate || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, visitDate: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">{uiT("Doctor Name", "डॉक्टर का नाम")}</label>
                      <input className="input-field" placeholder={uiT("Doctor name", "डॉक्टर का नाम")} value={editVisitForm.doctorName || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, doctorName: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1.5 block">{uiT("Remarks", "टिप्पणी")}</label>
                      <textarea className="input-field" rows={2} placeholder={uiT("Remarks", "टिप्पणी")} value={editVisitForm.remarks || ""}
                        onChange={(e) => setEditVisitForm({ ...editVisitForm, remarks: e.target.value })} />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleVisitSave} disabled={savingVisit} className="btn-primary flex items-center gap-1.5 shadow-sm">
                        <Save size={14} /> {savingVisit ? "Saving..." : uiT("Save", "सहेजें")}
                      </button>
                      <button onClick={() => setEditingVisit(false)} className="btn-secondary flex items-center gap-1.5">
                        <X size={14} /> {uiT("Cancel", "रद्द करें")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-primary-50 dark:bg-primary-500/10 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
                      <Calendar size={22} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-slate-900 dark:text-white">
                        {new Date(selectedVisit.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                        {selectedVisit.doctorName && (
                          <span className="flex items-center gap-1.5 text-xs text-slate-500">
                            <User size={12} className="text-slate-400" /> Dr. {selectedVisit.doctorName}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock size={12} className="text-slate-400" /> Created {new Date(selectedVisit.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>
                      {selectedVisit.remarks && (
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 bg-slate-50 dark:bg-slate-700/30 rounded-xl p-3 border border-slate-100 dark:border-slate-700/50">{selectedVisit.remarks}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {linkedPrescription && (
                <div className="card p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 bg-purple-50 dark:bg-purple-500/10 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <Eye size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{uiT("Prescription", "प्रिस्क्रिप्शन")}</h3>
                    <span className="text-[10px] text-slate-400 ml-auto">
                      {new Date(linkedPrescription.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-50/30 dark:from-blue-500/5 dark:to-blue-500/[0.02] rounded-2xl p-4 border border-blue-100/80 dark:border-blue-500/10">
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" /> {uiT("Right Eye", "दाहिनी आंख")}
                      </p>
                      {linkedPrescription.rightEye?.dv && <EyeRow label="DV" data={linkedPrescription.rightEye.dv} />}
                      {linkedPrescription.rightEye?.nv && <EyeRow label="NV" data={linkedPrescription.rightEye.nv} />}
                      {linkedPrescription.rightEye?.pc && <EyeRow label="PC" data={linkedPrescription.rightEye.pc} />}
                      {!linkedPrescription.rightEye?.dv && !linkedPrescription.rightEye?.nv && !linkedPrescription.rightEye?.pc && (
                        <p className="text-xs text-blue-300 dark:text-blue-500 italic">{uiT("No data", "कोई डेटा नहीं")}</p>
                      )}
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-amber-50/30 dark:from-amber-500/5 dark:to-amber-500/[0.02] rounded-2xl p-4 border border-amber-100/80 dark:border-amber-500/10">
                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500" /> {uiT("Left Eye", "बाईं आंख")}
                      </p>
                      {linkedPrescription.leftEye?.dv && <EyeRow label="DV" data={linkedPrescription.leftEye.dv} />}
                      {linkedPrescription.leftEye?.nv && <EyeRow label="NV" data={linkedPrescription.leftEye.nv} />}
                      {linkedPrescription.leftEye?.pc && <EyeRow label="PC" data={linkedPrescription.leftEye.pc} />}
                      {!linkedPrescription.leftEye?.dv && !linkedPrescription.leftEye?.nv && !linkedPrescription.leftEye?.pc && (
                        <p className="text-xs text-amber-300 dark:text-amber-500 italic">{uiT("No data", "कोई डेटा नहीं")}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/30">
                    {linkedPrescription.pd && <p className="text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">PD:</span> {linkedPrescription.pd}</p>}
                    {linkedPrescription.notes && <p className="text-xs text-slate-500"><span className="font-medium text-slate-700 dark:text-slate-300">{uiT("Notes:", "नोट्स:")}</span> {linkedPrescription.notes}</p>}
                  </div>
                </div>
              )}

              {linkedOrder && (
                <div className="card p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 bg-amber-50 dark:bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <ShoppingCart size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{uiT("Order", "ऑर्डर")}</h3>
                    <span className={`badge ml-auto ${
                      linkedOrder.status === "Delivered" ? "badge-green" :
                      linkedOrder.status === "Ready" ? "badge-blue" :
                      linkedOrder.status === "Cancelled" ? "badge-red" : "badge-yellow"
                    }`}>{linkedOrder.status || "Draft"}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    {linkedOrder.frame && (
                      <>
                        <p className="text-xs text-slate-500 font-medium">{uiT("Frame", "फ्रेम")}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white text-right">
                          {[linkedOrder.frameBrand, linkedOrder.frameModel, linkedOrder.frameColor, linkedOrder.frameSize].filter(Boolean).join(" / ") || linkedOrder.frame}
                          {linkedOrder.framePrice ? ` (₹${linkedOrder.framePrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.lens && (
                      <>
                        <p className="text-xs text-slate-500 font-medium">{uiT("Lens", "लेंस")}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white text-right">
                          {[linkedOrder.lensBrand, linkedOrder.lensType, linkedOrder.lensIndex].filter(Boolean).join(" / ") || linkedOrder.lens}
                          {linkedOrder.lensPrice ? ` (₹${linkedOrder.lensPrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.coating && (
                      <>
                        <p className="text-xs text-slate-500 font-medium">{uiT("Coating", "कोटिंग")}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white text-right">
                          {linkedOrder.coating}{linkedOrder.coatingPrice ? ` (₹${linkedOrder.coatingPrice})` : ""}
                        </p>
                      </>
                    )}
                    {linkedOrder.accessories?.length > 0 && (
                      <>
                        <p className="text-xs text-slate-500 font-medium">{uiT("Accessories", "सहायक उपकरण")}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white text-right">{linkedOrder.accessories.join(", ")}</p>
                      </>
                    )}
                    <p className="text-xs text-slate-500 font-medium">{uiT("Quantity", "मात्रा")}</p>
                    <p className="text-xs font-semibold text-slate-900 dark:text-white text-right">{linkedOrder.quantity || 1}</p>
                    {linkedOrder.deliveryDate && (
                      <>
                        <p className="text-xs text-slate-500 font-medium">{uiT("Delivery Date", "डिलीवरी तिथि")}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white text-right">
                          {new Date(linkedOrder.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </p>
                      </>
                    )}
                    {linkedOrder.labAssigned && (
                      <>
                        <p className="text-xs text-slate-500 font-medium">{uiT("Lab", "लैब")}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white text-right">{linkedOrder.labAssigned}{linkedOrder.labExpectedDate ? ` (by ${new Date(linkedOrder.labExpectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})` : ""}</p>
                      </>
                    )}
                  </div>
                  {linkedOrder.labRemarks && (
                    <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700/30">{uiT("Lab Remarks", "लैब टिप्पणी")}: {linkedOrder.labRemarks}</p>
                  )}
                </div>
              )}

              {linkedBill && (
                <div className="card p-5">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-500/10 rounded-lg flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Receipt size={16} />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">{uiT("Bill", "बिल")}</h3>
                    <span className="text-[10px] text-slate-400 ml-auto font-mono">{linkedBill.billNumber}</span>
                  </div>
                  {linkedBill.items?.length > 0 && (
                    <div className="overflow-x-auto mb-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50">
                            <th className="text-left py-2.5 px-3 font-semibold text-slate-500">{uiT("Description", "विवरण")}</th>
                            <th className="text-center py-2.5 px-3 font-semibold text-slate-500">{uiT("Qty", "मात्रा")}</th>
                            <th className="text-right py-2.5 px-3 font-semibold text-slate-500">{uiT("Price", "मूल्य")}</th>
                            <th className="text-right py-2.5 px-3 font-semibold text-slate-500">{uiT("Total", "कुल")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700/30">
                          {linkedBill.items.map((it: any, i: number) => (
                            <tr key={it._id || it.description || i}>
                              <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">{it.description || uiT("Item", "आइटम")}</td>
                              <td className="py-2.5 px-3 text-center text-slate-500">{it.quantity || 1}</td>
                              <td className="py-2.5 px-3 text-right text-slate-500">₹{(it.unitPrice || 0).toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right font-semibold text-slate-900 dark:text-white">₹{((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>{uiT("Subtotal", "उप-कुल")}</span>
                      <span>₹{(linkedBill.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {linkedBill.discount ? (
                      <div className="flex justify-between text-red-500">
                        <span>{uiT("Discount", "छूट")}</span>
                        <span>-₹{linkedBill.discount.toFixed(2)}</span>
                      </div>
                    ) : null}
                    {linkedBill.tax ? (
                      <div className="flex justify-between text-emerald-600">
                        <span>{uiT("GST", "जीएसटी")}</span>
                        <span>+₹{linkedBill.tax.toFixed(2)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700/50">
                      <span>{uiT("Total", "कुल")}</span>
                      <span>₹{(linkedBill.totalAmount || 0).toFixed(2)}</span>
                    </div>
                    {linkedBill.advancePaid !== undefined && (
                      <div className="flex justify-between text-emerald-600 items-center pt-1">
                        <span>{uiT("Paid", "भुगतान")}</span>
                        {editingBillAdvance ? (
                          <div className="flex items-center gap-1.5">
                            <input type="number" min="0" step="0.01"
                              className="input-field w-24 text-xs py-1 text-right"
                              value={editBillAdvanceAmount}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setEditBillAdvanceAmount(Number(e.target.value))} />
                            <button onClick={handleBillAdvanceSave} disabled={savingBillAdvance}
                              className="p-1.5 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 rounded-lg text-emerald-600 transition-colors">
                              {savingBillAdvance ? <div className="animate-spin w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full" /> : <Save size={13} />}
                            </button>
                            <button onClick={() => setEditingBillAdvance(false)}
                              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg text-red-400 transition-colors">
                              <X size={13} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold">₹{linkedBill.advancePaid.toFixed(2)}</span>
                            <button onClick={() => { setEditBillAdvanceAmount(linkedBill.advancePaid || 0); setEditingBillAdvance(true); }}
                              className="px-2 py-1 bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 rounded-lg text-[10px] font-medium hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors flex items-center gap-1">
                              <Edit3 size={10} /> {uiT("Edit", "संपादित करें")}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    {(linkedBill.pendingAmount || 0) > 0 ? (
                      <div className="flex justify-between text-amber-600 font-bold pt-1">
                        <span>{uiT("Balance Due", "बकाया राशि")}</span>
                        <span>₹{linkedBill.pendingAmount.toFixed(2)}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/30">
                    <button onClick={() => sendWhatsApp(customer?.mobile, linkedBill)}
                      className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5">
                      <MessageCircle size={13} /> {uiT("Send Bill", "बिल भेजें")}
                    </button>
                  </div>
                </div>
              )}

              {!linkedPrescription && !linkedOrder && !linkedBill && (
                <div className="card p-8 text-center">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Activity size={24} className="text-slate-300 dark:text-slate-500" />
                  </div>
                  <p className="text-sm text-slate-400">{uiT("No linked prescription, order, or bill for this visit.", "इस विज़िट के लिए कोई प्रिस्क्रिप्शन, ऑर्डर या बिल नहीं जुड़ा है।")}</p>
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
    <div className="text-xs text-slate-600 dark:text-slate-400 mb-2 last:mb-0">
      <span className="font-bold text-slate-700 dark:text-slate-300 bg-slate-200/50 dark:bg-slate-600/30 px-1.5 py-0.5 rounded text-[10px] mr-1.5">{label}</span>
      <span className="text-slate-500">SPH</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{sph}</span>
      <span className="text-slate-400 mx-1">|</span>
      <span className="text-slate-500">CYL</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{cyl}</span>
      <span className="text-slate-400 mx-1">|</span>
      <span className="text-slate-500">AXIS</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{axis}</span>
      {data.va && <><span className="text-slate-400 mx-1">|</span><span className="text-slate-500">VA</span> <span className="font-semibold text-slate-800 dark:text-slate-200">{data.va}</span></>}
    </div>
  );
}

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, Receipt, Eye, ClipboardList,
  ShoppingCart, Edit3, Plus, Save, X, MessageCircle, FileText, User,
  ChevronRight, Clock, MapPinned, IdCard, Wallet, TrendingUp, Stethoscope,
} from "lucide-react";
import { formatEyeRx, hasEyeData, compactRx } from "../utils/rx";

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
    if (typeof current === "number") return !Number.isNaN(current);
    if (typeof current === "string") {
      const trimmed = current.trim();
      if (trimmed && !Number.isNaN(Number(trimmed))) return true;
      continue;
    }
    if (Array.isArray(current)) { stack.push(...current); continue; }
    if (current && typeof current === "object") stack.push(...Object.values(current));
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

const inputCls = "w-full bg-th-hover text-th-text placeholder-th-secondary px-3 py-2.5 rounded-md text-base outline-none focus:ring-1 focus:ring-[#1ed760] transition-shadow";
const labelCls = "text-sm font-bold uppercase tracking-wider text-th-secondary mb-1 block";

function EyeRow({ label, data }: { label: string; data: any }) {
  const sph = data.sph != null ? (data.sph > 0 ? `+${Number(data.sph).toFixed(2)}` : Number(data.sph).toFixed(2)) : "—";
  const cyl = data.cyl != null ? (data.cyl > 0 ? `+${Number(data.cyl).toFixed(2)}` : Number(data.cyl).toFixed(2)) : "—";
  const axis = data.axis != null ? `× ${data.axis}` : "—";
  return (
    <div className="text-base text-th-secondary mb-1.5 last:mb-0">
      <span className="font-bold text-th-text bg-th-border px-1.5 py-0.5 rounded text-sm mr-1.5">{label}</span>
      <span className="text-th-secondary">SPH</span> <span className="font-semibold text-th-text">{sph}</span>
      <span className="text-[#535353] mx-1">|</span>
      <span className="text-th-secondary">CYL</span> <span className="font-semibold text-th-text">{cyl}</span>
      <span className="text-[#535353] mx-1">|</span>
      <span className="text-th-secondary">AXIS</span> <span className="font-semibold text-th-text">{axis}</span>
      {data.va && <><span className="text-[#535353] mx-1">|</span><span className="text-th-secondary">VA</span> <span className="font-semibold text-th-text">{data.va}</span></>}
    </div>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, uiT } = useTranslate();
  const toast = useToast();
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
  const [editingRx, setEditingRx] = useState(false);
  const [editRxForm, setEditRxForm] = useState<any>({});
  const [savingRx, setSavingRx] = useState(false);
  const [editingOrder, setEditingOrder] = useState(false);
  const [editOrderForm, setEditOrderForm] = useState<any>({});
  const [savingOrder, setSavingOrder] = useState(false);
  const [editingBill, setEditingBill] = useState(false);
  const [editBillForm, setEditBillForm] = useState<any>({});
  const [savingBill, setSavingBill] = useState(false);
  const [sendingRx, setSendingRx] = useState(false);
  const [sendingBill, setSendingBill] = useState(false);

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
      api.get<any>(`/api/customers/${id}`), api.get<any[]>(`/api/visits?customerId=${id}`),
      api.get<any[]>(`/api/prescriptions?customerId=${id}`), api.get<any[]>(`/api/bills?customerId=${id}`),
      api.get<any[]>(`/api/orders?customerId=${id}`), api.get<any>("/api/settings"),
    ]).then(([c, v, p, b, o, s]) => {
      if (c.success) { setCustomer(c.data); setEditForm(c.data); }
      if (v.success) setVisits(v.data || []);
      if (p.success) setPrescriptions(p.data || []);
      if (b.success) setBills(((b.data as any)?.data || (Array.isArray(b.data) ? b.data : []) as any[]));
      if (o.success) setOrders(((o.data as any)?.data || (Array.isArray(o.data) ? o.data : []) as any[]));
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

  function openEdit() {
    setEditForm({
      name: customer.name || "", email: customer.email || "", mobile: customer.mobile || "",
      alternateMobile: customer.alternateMobile || "", address: customer.address || "",
      city: customer.city || "", age: customer.age || "", gender: customer.gender || "",
      tags: customer.tags?.join(", ") || "",
    });
    setEditing(true);
  }

  async function handleEditSave() {
    setSaving(true);
    try {
      const payload = {
        name: editForm.name, email: editForm.email || undefined, mobile: editForm.mobile || undefined,
        alternateMobile: editForm.alternateMobile || undefined, address: editForm.address || undefined,
        city: editForm.city || undefined, age: editForm.age ? Number(editForm.age) : undefined,
        gender: editForm.gender || undefined,
        tags: typeof editForm.tags === "string" ? editForm.tags.split(",").map((t: string) => t.trim()).filter(Boolean) : editForm.tags || undefined,
      };
      const res = await api.put<any>(`/api/customers/${id}`, payload);
      if (res.success) { setCustomer(res.data); setEditing(false); toast.success(uiT("Profile updated", "प्रोफ़ाइल अपडेट हो गई")); }
      else { toast.error(res.message || uiT("Failed to save", "सहेजने में विफल")); }
    } catch (e: any) { toast.error(e.message || uiT("Something went wrong", "कुछ गड़बड़ हो गई")); }
    finally { setSaving(false); }
  }

  async function handleVisitSave() {
    setSavingVisit(true);
    try {
      const res = await api.put<any>(`/api/visits/${selectedVisit._id}`, editVisitForm);
      if (res.success) {
        setSelectedVisit(res.data);
        setVisits((prev: any[]) => prev.map((v: any) => v._id === res.data._id ? res.data : v));
        setEditingVisit(false);
        toast.success(uiT("Visit updated", "विज़िट अपडेट हो गई"));
      } else { toast.error(res.message || uiT("Failed to save", "सहेजने में विफल")); }
    } catch (e: any) { toast.error(e.message || uiT("Something went wrong", "कुछ गड़बड़ हो गई")); }
    finally { setSavingVisit(false); }
  }

  async function handleBillAdvanceSave() {
    setSavingBillAdvance(true);
    try {
      const res: any = await api.put(`/api/bills/${linkedBill._id}`, { advancePaid: Number(editBillAdvanceAmount) });
      if (res.success) {
        setBills((prev: any[]) => prev.map((b: any) => b._id === res.data._id ? res.data : b));
        setEditingBillAdvance(false);
        const custRes: any = await api.get(`/api/customers/${id}`);
        if (custRes.success) setCustomer(custRes.data);
        const paymentsRes: any = await api.get(`/api/payments?billId=${linkedBill._id}`);
        const paymentsList = ((paymentsRes.data as any)?.data || (Array.isArray(paymentsRes.data) ? paymentsRes.data : []) as any[]);
        if (paymentsRes.success && paymentsList.length > 0) {
          await api.put(`/api/payments/${paymentsList[0]._id}`, { amount: Number(editBillAdvanceAmount) });
        }
        toast.success(uiT("Payment updated", "भुगतान अपडेट हो गया"));
      } else { toast.error(res.message || uiT("Failed to save", "सहेजने में विफल")); }
    } catch (e: any) { toast.error(e.message || uiT("Something went wrong", "कुछ गड़बड़ हो गई")); }
    finally { setSavingBillAdvance(false); }
  }

  function openVisitDetail(v: any) {
    setSelectedVisit(v);
    setEditVisitForm({ visitDate: v.visitDate?.split("T")[0] || "", visitType: v.visitType || "new", doctorName: v.doctorName || "", remarks: v.remarks || "" });
    setEditingVisit(false);
    setEditingBillAdvance(false);
    setEditingRx(false);
    setEditingOrder(false);
    setEditingBill(false);
  }

  function openRxEdit() {
    const p = linkedPrescription;
    setEditRxForm({
      rightEye: {
        dv: { sph: p?.rightEye?.dv?.sph ?? "", cyl: p?.rightEye?.dv?.cyl ?? "", axis: p?.rightEye?.dv?.axis ?? "", va: p?.rightEye?.dv?.va || "" },
        nv: { sph: p?.rightEye?.nv?.sph ?? "", cyl: p?.rightEye?.nv?.cyl ?? "", axis: p?.rightEye?.nv?.axis ?? "", va: p?.rightEye?.nv?.va || "" },
        pc: { sph: p?.rightEye?.pc?.sph ?? "", cyl: p?.rightEye?.pc?.cyl ?? "", axis: p?.rightEye?.pc?.axis ?? "", va: p?.rightEye?.pc?.va || "" },
      },
      leftEye: {
        dv: { sph: p?.leftEye?.dv?.sph ?? "", cyl: p?.leftEye?.dv?.cyl ?? "", axis: p?.leftEye?.dv?.axis ?? "", va: p?.leftEye?.dv?.va || "" },
        nv: { sph: p?.leftEye?.nv?.sph ?? "", cyl: p?.leftEye?.nv?.cyl ?? "", axis: p?.leftEye?.nv?.axis ?? "", va: p?.leftEye?.nv?.va || "" },
        pc: { sph: p?.leftEye?.pc?.sph ?? "", cyl: p?.leftEye?.pc?.cyl ?? "", axis: p?.leftEye?.pc?.axis ?? "", va: p?.leftEye?.pc?.va || "" },
      },
      pd: p?.pd || "",
      notes: p?.notes || "",
    });
    setEditingRx(true);
  }

  async function sendPrescriptionWhatsApp(rx?: any) {
    const rxData = rx || linkedPrescription;
    if (!customer?.mobile) { toast.error(uiT("No mobile number", "कोई मोबाइल नंबर नहीं")); return; }
    if (!rxData) { toast.error(uiT("No prescription data", "कोई प्रिस्क्रिप्शन डेटा नहीं")); return; }
    const num = customer.mobile.replace(/\D/g, "");
    if (!num) { toast.error(uiT("Invalid mobile number", "अमान्य मोबाइल नंबर")); return; }
    const fullNum = num.length === 10 ? `91${num}` : num;
    const shop = settings?.shopName || "KMJ Optical";
    setSendingRx(true);
    try {
      const { generatePrescriptionPdf } = await import("../utils/pdf");
      const doc = generatePrescriptionPdf(rxData, { name: customer.name, mobile: customer.mobile, address: customer.address, customerId: customer.customerId }, settings || {});
      const base64 = doc.output("datauristring").split(",")[1];
      const caption = t(
        `*${shop}*\n\nHi ${customer.name || ""},\nPlease find your prescription attached.\n\nThank you!`,
        `*${shop}*\n\nनमस्ते ${customer.name || ""},\nकृपया अपना प्रिस्क्रिप्शन संलग्न देखें।\n\nधन्यवाद!`
      );
      const res = await api.post("/api/whatsapp/send-media", { phone: fullNum, base64, filename: `Prescription-${customer.customerId || "rx"}.pdf`, caption, mimetype: "application/pdf" });
      if (res.success) { toast.success(uiT("Prescription sent", "प्रिस्क्रिप्शन भेजा गया")); }
      else { toast.error(uiT("Failed to send", "भेजने में विफल")); }
    } catch (e: any) { toast.error(e.message || uiT("Failed to send", "भेजने में विफल")); }
    finally { setSendingRx(false); }
  }

  function cleanEyeEdit(eye: any) {
    const out: any = {};
    for (const sub of ["dv", "nv", "pc"] as const) {
      const s = eye[sub];
      if (!s) continue;
      const has = ["sph", "cyl", "axis", "va"].some((k) => s[k] !== "" && s[k] != null && s[k] !== "");
      if (has) {
        out[sub] = {};
        for (const k of ["sph", "cyl", "axis", "va"] as const) {
          if (s[k] !== "" && s[k] != null && s[k] !== "") {
            out[sub][k] = k === "va" ? s[k] : Number(s[k]);
          }
        }
      }
    }
    return Object.keys(out).length ? out : undefined;
  }

  async function handleRxSave() {
    setSavingRx(true);
    try {
      const payload: any = {
        rightEye: { dv: cleanEyeEdit(editRxForm.rightEye?.dv), nv: cleanEyeEdit(editRxForm.rightEye?.nv), pc: cleanEyeEdit(editRxForm.rightEye?.pc) },
        leftEye: { dv: cleanEyeEdit(editRxForm.leftEye?.dv), nv: cleanEyeEdit(editRxForm.leftEye?.nv), pc: cleanEyeEdit(editRxForm.leftEye?.pc) },
        pd: editRxForm.pd || undefined,
        notes: editRxForm.notes || undefined,
      };
      const res = await api.put<any>(`/api/prescriptions/${linkedPrescription._id}`, payload);
      if (res.success) {
        setPrescriptions((prev: any[]) => prev.map((p: any) => p._id === res.data._id ? res.data : p));
        setEditingRx(false);
        toast.success(uiT("Prescription updated", "प्रिस्क्रिप्शन अपडेट हो गई"));
      } else { toast.error(res.message || uiT("Failed to save", "सहेजने में विफल")); }
    } catch (e: any) { toast.error(e.message || uiT("Something went wrong", "कुछ गड़बड़ हो गई")); }
    finally { setSavingRx(false); }
  }

  function openOrderEdit() {
    const o = linkedOrder;
    setEditOrderForm({
      frame: o?.frame || "", frameBrand: o?.frameBrand || "", frameModel: o?.frameModel || "",
      frameColor: o?.frameColor || "", frameSize: o?.frameSize || "", framePrice: o?.framePrice ?? "",
      lens: o?.lens || "", lensBrand: o?.lensBrand || "", lensType: o?.lensType || "",
      lensIndex: o?.lensIndex || "", lensPrice: o?.lensPrice ?? "",
      coating: o?.coating || "", coatingPrice: o?.coatingPrice ?? "",
      accessories: o?.accessories?.join(", ") || "",
      quantity: o?.quantity ?? 1, deliveryDate: o?.deliveryDate?.split("T")[0] || "",
      status: o?.status || "Draft",
      labAssigned: o?.labAssigned || "", labExpectedDate: o?.labExpectedDate?.split("T")[0] || "", labRemarks: o?.labRemarks || "",
    });
    setEditingOrder(true);
  }

  async function handleOrderSave() {
    setSavingOrder(true);
    try {
      const payload: any = {
        frame: editOrderForm.frame || undefined, frameBrand: editOrderForm.frameBrand || undefined,
        frameModel: editOrderForm.frameModel || undefined, frameColor: editOrderForm.frameColor || undefined,
        frameSize: editOrderForm.frameSize || undefined, framePrice: editOrderForm.framePrice !== "" ? Number(editOrderForm.framePrice) : undefined,
        lens: editOrderForm.lens || undefined, lensBrand: editOrderForm.lensBrand || undefined,
        lensType: editOrderForm.lensType || undefined, lensIndex: editOrderForm.lensIndex || undefined,
        lensPrice: editOrderForm.lensPrice !== "" ? Number(editOrderForm.lensPrice) : undefined,
        coating: editOrderForm.coating || undefined, coatingPrice: editOrderForm.coatingPrice !== "" ? Number(editOrderForm.coatingPrice) : undefined,
        accessories: editOrderForm.accessories ? editOrderForm.accessories.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
        quantity: Number(editOrderForm.quantity) || 1, deliveryDate: editOrderForm.deliveryDate || undefined,
        status: editOrderForm.status || undefined,
        labAssigned: editOrderForm.labAssigned || undefined, labExpectedDate: editOrderForm.labExpectedDate || undefined,
        labRemarks: editOrderForm.labRemarks || undefined,
      };
      const res = await api.put<any>(`/api/orders/${linkedOrder._id}`, payload);
      if (res.success) {
        setOrders((prev: any[]) => prev.map((o: any) => o._id === res.data._id ? res.data : o));
        setEditingOrder(false);
        toast.success(uiT("Order updated", "ऑर्डर अपडेट हो गया"));
      } else { toast.error(res.message || uiT("Failed to save", "सहेजने में विफल")); }
    } catch (e: any) { toast.error(e.message || uiT("Something went wrong", "कुछ गड़बड़ हो गई")); }
    finally { setSavingOrder(false); }
  }

  function openBillEdit() {
    const b = linkedBill;
    setEditBillForm({
      items: b?.items?.map((it: any) => ({ description: String(it.description || ""), quantity: String(it.quantity ?? ""), unitPrice: String(it.unitPrice ?? "") })) || [{ description: "", quantity: "", unitPrice: "" }],
      discount: String(b?.discount ?? ""), tax: String(b?.tax ?? ""), advancePaid: String(b?.advancePaid ?? ""),
    });
    setEditingBill(true);
  }

  function addBillItem() {
    setEditBillForm((f: any) => ({ ...f, items: [...(f.items || []), { description: "", quantity: "", unitPrice: "" }] }));
  }

  function removeBillItem(idx: number) {
    setEditBillForm((f: any) => ({ ...f, items: f.items.filter((_: any, i: number) => i !== idx) }));
  }

  function updateBillItem(idx: number, field: string, value: any) {
    setEditBillForm((f: any) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  }

  async function handleBillSave() {
    setSavingBill(true);
    try {
      const items = (editBillForm.items || []).map((it: any) => ({
        description: it.description || "Item",
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || 0,
      }));
      const payload: any = { items };
      if (editBillForm.discount !== "" && editBillForm.discount != null) payload.discount = Number(editBillForm.discount);
      if (editBillForm.tax !== "" && editBillForm.tax != null) payload.tax = Number(editBillForm.tax);
      if (editBillForm.advancePaid !== "" && editBillForm.advancePaid != null) payload.advancePaid = Number(editBillForm.advancePaid);
      const res = await api.put<any>(`/api/bills/${linkedBill._id}`, payload);
      if (res.success) {
        setBills((prev: any[]) => prev.map((b: any) => b._id === res.data._id ? res.data : b));
        setEditingBill(false);
        const custRes: any = await api.get(`/api/customers/${id}`);
        if (custRes.success) setCustomer(custRes.data);
        toast.success(uiT("Bill updated", "बिल अपडेट हो गया"));
      } else { toast.error(res.message || uiT("Failed to save", "सहेजने में विफल")); }
    } catch (e: any) { toast.error(e.message || uiT("Something went wrong", "कुछ गड़बड़ हो गई")); }
    finally { setSavingBill(false); }
  }

  async function sendWhatsApp(phone: string, bill: any) {
    const num = phone.replace(/\D/g, "");
    if (!num) { toast.error(uiT("No mobile number", "कोई मोबाइल नंबर नहीं")); return; }
    const fullNum = num.length === 10 ? `91${num}` : num;
    const shop = settings?.shopName || "KMJ Optical";
    const custData = { name: customer?.name, mobile: customer?.mobile, address: customer?.address, customerId: customer?.customerId };
    setSendingBill(true);
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
        if (mediaRes.success) { toast.success(uiT("Bill sent on WhatsApp", "बिल व्हाट्सऐप पर भेजा गया")); setSendingBill(false); return; }
      }
      const items = (bill?.items || []).map((i: any) =>
        `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
      ).join("\n");
      const msg = `*${shop}* 🕶\n\n*Bill:* ${bill?.billNumber || ""}\n*Date:* ${new Date().toLocaleDateString("en-IN")}\n\n*Customer:* ${customer?.name || ""}\n*Mobile:* ${customer?.mobile || ""}\n\n*Items:*\n${items}\n\n*Total:* ₹${(bill?.totalAmount || 0).toFixed(0)}\n*Paid:* ₹${(bill?.advancePaid || 0).toFixed(0)}\n*Pending:* ₹${(bill?.pendingAmount || 0).toFixed(0)}\n\nThank you! 🙏`;
      const res = await api.post("/api/whatsapp/send", { phone: fullNum, message: msg });
      if (res.success) { toast.success(uiT("Bill sent on WhatsApp", "बिल व्हाट्सऐप पर भेजा गया")); }
      else { toast.error(uiT("Failed to send", "भेजने में विफल")); }
    } catch (e: any) { toast.error(e.message || uiT("Failed to send", "भेजने में विफल")); }
    finally { setSendingBill(false); }
  }

  const tabs = [
    { key: "overview", label: uiT("Overview", "अवलोकन"), icon: User },
    { key: "visits", label: `${uiT("Visits", "विज़िट")} (${visits.length})`, icon: ClipboardList },
    { key: "prescriptions", label: `${uiT("Rx", "प्रिस्क्रिप्शन")} (${prescriptions.length})`, icon: Eye },
    { key: "bills", label: `${uiT("Bills", "बिल")} (${bills.length})`, icon: Receipt },
    { key: "orders", label: `${uiT("Orders", "ऑर्डर")} (${orders.length})`, icon: ShoppingCart },
  ] as const;

  const latestRx = prescriptions[0] || null;

  return (
    <div className="min-h-screen bg-th-base text-th-text px-8 py-6 max-w-[1400px] mx-auto">
      <button onClick={() => navigate("/customers")}
        className="inline-flex items-center gap-2 text-base text-th-secondary hover:text-th-text transition-colors mb-4">
        <ArrowLeft size={16} /> {uiT("Back to Customers", "ग्राहकों पर वापस जाएं")}
      </button>

      {/* ── Profile Header ── */}
      <div className="bg-th-surface rounded-xl mb-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 bg-[#1ed760] rounded-full flex items-center justify-center text-black font-bold text-2xl flex-shrink-0">
              {customer.name?.charAt(0)?.toUpperCase() || "?"}
            </div>
            <div>
              <h1 className="text-xl font-bold text-th-text">{customer.name}</h1>
              <p className="text-th-secondary text-base flex items-center gap-1.5 mt-0.5">
                <IdCard size={12} /> {customer.customerId || "—"}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">
                {customer.mobile && (
                  <span className="flex items-center gap-1 text-base text-th-secondary"><Phone size={12} /> {customer.mobile}</span>
                )}
                {customer.email && (
                  <span className="flex items-center gap-1 text-base text-th-secondary"><Mail size={12} /> {customer.email}</span>
                )}
                {customer.city && (
                  <span className="flex items-center gap-1 text-base text-th-secondary"><MapPinned size={12} /> {customer.city}</span>
                )}
                {customer.age && (
                  <span className="text-base text-th-secondary"><User size={12} className="inline mr-0.5" />{customer.age}{customer.gender ? `, ${customer.gender}` : ""}</span>
                )}
                <span className="text-base text-th-secondary">
                  <Calendar size={12} className="inline mr-0.5" />
                  {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                </span>
              </div>
              {customer.address && <p className="text-base text-th-secondary mt-1.5 flex items-center gap-1"><MapPin size={11} />{customer.address}</p>}
              {customer.alternateMobile && <p className="text-base text-th-secondary mt-0.5 flex items-center gap-1"><Phone size={11} />{uiT("Alt", "वैकल्पिक")}: {customer.alternateMobile}</p>}
              {customer.tags?.length > 0 && (
                <div className="flex gap-1.5 mt-2.5">
                  {customer.tags.map((tag: string) => (
                    <span key={tag} className="px-2 py-0.5 bg-[#1ed760]/10 text-[#1ed760] text-sm font-bold uppercase tracking-wider rounded-md">{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={openEdit} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-th-elevated text-th-text hover:bg-th-hover active:scale-95 transition-all duration-150 shrink-0">
            <Edit3 size={13} /> {uiT("Edit", "संपादित")}
          </button>
        </div>
      </div>

      {/* ── Quick Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="bg-th-surface rounded-lg flex items-center gap-3 p-4">
          <div className="w-10 h-10 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760] shrink-0">
            <ClipboardList size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-th-text">{customer.totalVisits || 0}</p>
            <p className="text-base text-th-secondary font-bold uppercase tracking-wider">{uiT("Visits", "विज़िट")}</p>
          </div>
        </div>
        <div className="bg-th-surface rounded-lg flex items-center gap-3 p-4">
          <div className="w-10 h-10 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760] shrink-0">
            <TrendingUp size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-[#1ed760]">₹{(customer.totalSpent || 0).toLocaleString()}</p>
            <p className="text-base text-th-secondary font-bold uppercase tracking-wider">{uiT("Spent", "खर्च")}</p>
          </div>
        </div>
        <div className="bg-th-surface rounded-lg flex items-center gap-3 p-4">
          <div className="w-10 h-10 bg-[#e8a427]/10 rounded-full flex items-center justify-center text-[#e8a427] shrink-0">
            <Wallet size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-xl font-bold text-[#e8a427]">₹{(customer.pendingAmount || 0).toLocaleString()}</p>
            <p className="text-base text-th-secondary font-bold uppercase tracking-wider">{uiT("Pending", "बाकी")}</p>
          </div>
        </div>
        <div onClick={() => navigate(`/customers/${id}/create-visit`)}
          className="bg-[#1ed760] rounded-lg flex items-center gap-3 p-4 cursor-pointer active:scale-[0.99] transition-transform duration-150">
          <div className="w-10 h-10 bg-black/15 rounded-full flex items-center justify-center text-black shrink-0">
            <Plus size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-base font-bold text-black">{uiT("New Visit", "नई विज़िट")}</p>
            <p className="text-base text-black/50">{uiT("with prescription", "प्रिस्क्रिप्शन के साथ")}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-th-surface rounded-lg p-1 mb-5 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-base font-bold uppercase tracking-wider rounded-md transition-all duration-150 whitespace-nowrap flex-1 justify-center ${
                isActive ? "bg-white text-black" : "text-th-secondary hover:text-th-text hover:bg-th-elevated"
              }`}>
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div>
        {/* ── Overview ── */}
        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Left column: Rx + Visits */}
            <div className="md:col-span-2 space-y-5">
              {/* Latest Prescription */}
              <div className="bg-th-surface rounded-lg p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Eye size={14} className="text-purple-400" />
                  <p className="text-base font-bold uppercase tracking-wider text-th-text">{uiT("Latest Prescription", "नवीनतम प्रिस्क्रिप्शन")}</p>
                  {latestRx && <span className="text-base text-th-secondary">{new Date(latestRx.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>}
                </div>
                {latestRx ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="bg-th-elevated rounded-md p-3">
                        <p className="text-base font-bold uppercase tracking-wider text-[#6ea8fe] mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#6ea8fe]" /> {uiT("Right Eye", "दाहिनी आंख")}
                        </p>
                        {latestRx.rightEye?.dv && <EyeRow label="DV" data={latestRx.rightEye.dv} />}
                        {latestRx.rightEye?.nv && <EyeRow label="NV" data={latestRx.rightEye.nv} />}
                        {latestRx.rightEye?.pc && <EyeRow label="PC" data={latestRx.rightEye.pc} />}
                        {!latestRx.rightEye?.dv && !latestRx.rightEye?.nv && !latestRx.rightEye?.pc && (
                          <p className="text-base text-th-secondary italic">{uiT("No data", "कोई डेटा नहीं")}</p>
                        )}
                      </div>
                      <div className="bg-th-elevated rounded-md p-3">
                        <p className="text-base font-bold uppercase tracking-wider text-[#e8a427] mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#e8a427]" /> {uiT("Left Eye", "बाईं आंख")}
                        </p>
                        {latestRx.leftEye?.dv && <EyeRow label="DV" data={latestRx.leftEye.dv} />}
                        {latestRx.leftEye?.nv && <EyeRow label="NV" data={latestRx.leftEye.nv} />}
                        {latestRx.leftEye?.pc && <EyeRow label="PC" data={latestRx.leftEye.pc} />}
                        {!latestRx.leftEye?.dv && !latestRx.leftEye?.nv && !latestRx.leftEye?.pc && (
                          <p className="text-base text-th-secondary italic">{uiT("No data", "कोई डेटा नहीं")}</p>
                        )}
                      </div>
                    </div>
                    {(latestRx.pd || latestRx.notes) && (
                      <div className="flex gap-4 mt-2.5 pt-2.5 border-t border-th-border text-base text-th-secondary">
                        {latestRx.pd && <span><span className="font-medium">PD:</span> {latestRx.pd}</span>}
                        {latestRx.notes && <span className="truncate"><span className="font-medium">{uiT("Notes:", "नोट्स:")}</span> {latestRx.notes}</span>}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-base text-th-secondary py-3 text-center">{uiT("No prescriptions yet", "अभी तक कोई प्रिस्क्रिप्शन नहीं")}</p>
                )}
              </div>

              {/* Recent Visits */}
              <div className="bg-th-surface rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-[#1ed760]" />
                    <p className="text-base font-bold uppercase tracking-wider text-th-text">{uiT("Recent Visits", "हालिया विज़िट")}</p>
                  </div>
                  <button onClick={() => setTab("visits")} className="text-base text-[#1ed760] font-bold uppercase tracking-wider hover:underline">{uiT("View All", "सभी देखें")}</button>
                </div>
                {visits.length > 0 ? (
                  <div className="space-y-2">
                    {visits.slice(0, 4).map((v: any) => {
                      const rx = findLinkedPrescription(prescriptions, v);
                      const ord = orders.find((o: any) => getVisitId(o.visitId) === getVisitId(v._id));
                      const bill = bills.find((b: any) => getVisitId(b.visitId) === getVisitId(v._id));
                      const rxBrief = rx ? compactRx(rx.rightEye?.dv, rx.rightEye?.nv) : null;
                      const lxBrief = rx ? compactRx(rx.leftEye?.dv, rx.leftEye?.nv) : null;
                      return (
                        <div key={v._id} onClick={() => { setTab("visits"); openVisitDetail(v); }}
                          className="flex items-center gap-3 p-2.5 rounded-md bg-th-elevated hover:bg-th-hover cursor-pointer transition-colors">
                          <div className="w-2 h-2 rounded-full bg-[#1ed760] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-base font-semibold text-th-text">
                                {new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                              {v.visitType && <span className="px-1 py-0.5 bg-th-hover text-th-secondary text-base font-bold uppercase rounded">{v.visitType}</span>}
                              {v.doctorName && <span className="text-base text-th-secondary">Dr. {v.doctorName}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {rx ? (
                              <span className="text-base font-medium truncate max-w-[160px]">
                                <span className="text-purple-400">R:</span> <span className={rxBrief && rxBrief !== "Plain" ? "text-th-text" : "italic text-th-secondary"}>{rxBrief || "Plain"}</span>
                                <span className="text-[#535353] mx-0.5">·</span>
                                <span className="text-purple-400">L:</span> <span className={lxBrief && lxBrief !== "Plain" ? "text-th-text" : "italic text-th-secondary"}>{lxBrief || "Plain"}</span>
                              </span>
                            ) : (
                              <span className="text-base text-th-secondary italic">No Rx</span>
                            )}
                            {ord && <span className={`text-base font-bold uppercase px-1 py-0.5 rounded ${ord.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" : ord.status === "Cancelled" ? "bg-red-500/10 text-red-400" : "bg-[#e8a427]/10 text-[#e8a427]"}`}>{ord.status}</span>}
                            {bill && <span className="text-base text-th-secondary">₹{(bill.totalAmount || 0).toLocaleString()}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-base text-th-secondary py-3 text-center">{uiT("No visits yet", "अभी तक कोई विज़िट नहीं")}</p>
                )}
              </div>
            </div>

            {/* Right column: Bills + Orders summary */}
            <div className="space-y-5">
              {/* Bills summary */}
              <div className="bg-th-surface rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Receipt size={14} className="text-[#1ed760]" />
                    <p className="text-base font-bold uppercase tracking-wider text-th-text">{uiT("Bills", "बिल")}</p>
                  </div>
                  <button onClick={() => setTab("bills")} className="text-base text-[#1ed760] font-bold uppercase tracking-wider hover:underline">{uiT("View All", "सभी देखें")}</button>
                </div>
                {bills.length > 0 ? (
                  <div className="space-y-2">
                    {bills.slice(0, 4).map((b: any) => (
                      <div key={b._id} className="flex items-center justify-between p-2.5 rounded-md bg-th-elevated">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-th-text">{b.billNumber || "—"}</p>
                          <p className="text-base text-th-secondary">{new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-th-text">₹{(b.totalAmount || 0).toLocaleString()}</p>
                          {(b.pendingAmount || 0) > 0
                            ? <p className="text-base font-bold text-[#e8a427]">₹{b.pendingAmount} due</p>
                            : <p className="text-base font-bold text-[#1ed760]">{uiT("Paid", "भुगतान")}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-base text-th-secondary py-3 text-center">{uiT("No bills yet", "अभी तक कोई बिल नहीं")}</p>
                )}
              </div>

              {/* Orders summary */}
              <div className="bg-th-surface rounded-lg p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={14} className="text-[#e8a427]" />
                    <p className="text-base font-bold uppercase tracking-wider text-th-text">{uiT("Orders", "ऑर्डर")}</p>
                  </div>
                  <button onClick={() => setTab("orders")} className="text-base text-[#1ed760] font-bold uppercase tracking-wider hover:underline">{uiT("View All", "सभी देखें")}</button>
                </div>
                {orders.length > 0 ? (
                  <div className="space-y-2">
                    {orders.slice(0, 4).map((o: any) => (
                      <div key={o._id} className="flex items-center justify-between p-2.5 rounded-md bg-th-elevated">
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-th-text truncate">{[o.frameBrand, o.frame, o.lensBrand].filter(Boolean).join(" / ") || "Order"}</p>
                          <p className="text-base text-th-secondary">
                            {o.deliveryDate ? new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                          </p>
                        </div>
                        <span className={`text-sm font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                          o.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                          o.status === "Cancelled" ? "bg-red-500/10 text-red-400" :
                          o.status === "Ready" ? "bg-[#6ea8fe]/10 text-[#6ea8fe]" : "bg-[#e8a427]/10 text-[#e8a427]"
                        }`}>{o.status || "Draft"}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-base text-th-secondary py-3 text-center">{uiT("No orders yet", "अभी तक कोई ऑर्डर नहीं")}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Visits ── */}
        {tab === "visits" && (
          <div className="bg-th-surface rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-th-text flex items-center gap-2">
                <ClipboardList size={14} className="text-[#1ed760]" /> {uiT("All Visits", "सभी विज़िट")} ({visits.length})
              </h3>
              <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
                <Plus size={12} /> {uiT("Add", "जोड़ें")}
              </button>
            </div>
            {visits.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-base text-th-secondary">{uiT("No visits yet", "अभी तक कोई विज़िट नहीं")}</p>
                <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="mt-3 flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black mx-auto">
                  <Plus size={12} /> {uiT("Create First Visit", "पहली विज़िट बनाएं")}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                {visits.map((v: any) => {
                  const linkedRx = findLinkedPrescription(prescriptions, v);
                  const visitOrder = orders.find((o: any) => getVisitId(o.visitId) === getVisitId(v._id));
                  const visitBill = bills.find((b: any) => getVisitId(b.visitId) === getVisitId(v._id));
                  const rxBrief = linkedRx ? compactRx(linkedRx.rightEye?.dv, linkedRx.rightEye?.nv) : null;
                  const lxBrief = linkedRx ? compactRx(linkedRx.leftEye?.dv, linkedRx.leftEye?.nv) : null;
                  return (
                  <div key={v._id} id={`visit-${v._id}`}
                    onClick={() => openVisitDetail(v)}
                    className="flex items-center justify-between p-3 rounded-lg bg-th-elevated hover:bg-th-hover active:scale-[0.99] transition-all duration-150 cursor-pointer group">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 bg-th-hover rounded-full flex items-center justify-center text-th-secondary shrink-0">
                        <Calendar size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-base font-semibold text-th-text">
                            {new Date(v.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {v.visitType && (
                            <span className="px-1.5 py-0.5 bg-th-hover text-th-secondary text-base font-bold uppercase tracking-wider rounded">{v.visitType}</span>
                          )}
                          {visitOrder && (
                            <span className={`px-1.5 py-0.5 text-sm font-bold uppercase tracking-wider rounded ${
                              visitOrder.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                              visitOrder.status === "Ready" ? "bg-[#6ea8fe]/10 text-[#6ea8fe]" :
                              visitOrder.status === "Cancelled" ? "bg-red-500/10 text-red-400" : "bg-[#e8a427]/10 text-[#e8a427]"
                            }`}>{visitOrder.status || "Draft"}</span>
                          )}
                          {visitBill && (
                            <span className={`px-1.5 py-0.5 text-base font-bold tracking-wider rounded ${
                              (visitBill.pendingAmount || 0) > 0 ? "bg-[#e8a427]/10 text-[#e8a427]" : "bg-[#1ed760]/10 text-[#1ed760]"
                            }`}>
                              ₹{(visitBill.totalAmount || 0).toLocaleString()}
                              {(visitBill.pendingAmount || 0) > 0 && <span> · ₹{visitBill.pendingAmount} due</span>}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-base text-th-secondary mt-0.5 flex-wrap">
                          {v.doctorName && <span className="flex items-center gap-0.5"><Stethoscope size={10} /> Dr. {v.doctorName}</span>}
                          {linkedRx ? (
                            <span className="flex items-center gap-1.5">
                              <Eye size={10} className="text-purple-400" />
                              <span>R: <span className={`font-medium ${rxBrief && rxBrief !== "Plain" ? "text-th-text" : "italic text-th-secondary"}`}>{rxBrief || "Plain"}</span></span>
                              <span className="text-[#535353]">·</span>
                              <span>L: <span className={`font-medium ${lxBrief && lxBrief !== "Plain" ? "text-th-text" : "italic text-th-secondary"}`}>{lxBrief || "Plain"}</span></span>
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 italic"><Eye size={10} className="text-th-secondary/50" /> No Rx</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[#535353] group-hover:text-th-secondary transition-colors shrink-0" />
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Prescriptions ── */}
        {tab === "prescriptions" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-th-text flex items-center gap-2">
                <Eye size={14} className="text-purple-400" /> {uiT("Prescriptions", "प्रिस्क्रिप्शन")} ({prescriptions.length})
              </h3>
              <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform">
                <Plus size={12} /> {uiT("Add", "जोड़ें")}
              </button>
            </div>
            {prescriptions.length === 0 ? (
              <div className="bg-th-surface rounded-lg py-10 text-center">
                <p className="text-base text-th-secondary">{uiT("No prescriptions yet", "अभी तक कोई प्रिस्क्रिप्शन नहीं")}</p>
                <button onClick={() => navigate(`/customers/${id}/create-visit`)} className="mt-3 flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black mx-auto">
                  <Plus size={12} /> {uiT("Create First Rx", "पहला प्रिस्क्रिप्शन बनाएं")}
                </button>
              </div>
            ) : (
              prescriptions.map((p: any) => (
                <div key={p._id} className="bg-th-surface rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-base font-semibold text-th-text">
                      {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <span className="text-base text-th-secondary font-mono">{p._id.slice(-6)}</span>
                    <button onClick={() => sendPrescriptionWhatsApp(p)} disabled={sendingRx} className="ml-auto flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-[#1ed760]/10 text-[#1ed760] hover:bg-[#1ed760]/20 transition-colors disabled:opacity-50">
                      {sendingRx ? <div className="animate-spin w-3 h-3 border-2 border-[#1ed760] border-t-transparent rounded-full" /> : <MessageCircle size={11} />} {uiT("Send Rx", "प्रिस्क्रिप्शन भेजें")}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-th-elevated rounded-md p-3">
                      <p className="text-base font-bold uppercase tracking-wider text-[#6ea8fe] mb-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6ea8fe]" /> {uiT("Right Eye", "दाहिनी आंख")}
                      </p>
                      {p.rightEye?.dv && <EyeRow label="DV" data={p.rightEye.dv} />}
                      {p.rightEye?.nv && <EyeRow label="NV" data={p.rightEye.nv} />}
                      {p.rightEye?.pc && <EyeRow label="PC" data={p.rightEye.pc} />}
                      {!p.rightEye?.dv && !p.rightEye?.nv && !p.rightEye?.pc && (
                        <p className="text-base text-th-secondary italic">{uiT("Plain", "प्लेन")}</p>
                      )}
                    </div>
                    <div className="bg-th-elevated rounded-md p-3">
                      <p className="text-base font-bold uppercase tracking-wider text-[#e8a427] mb-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#e8a427]" /> {uiT("Left Eye", "बाईं आंख")}
                      </p>
                      {p.leftEye?.dv && <EyeRow label="DV" data={p.leftEye.dv} />}
                      {p.leftEye?.nv && <EyeRow label="NV" data={p.leftEye.nv} />}
                      {p.leftEye?.pc && <EyeRow label="PC" data={p.leftEye.pc} />}
                      {!p.leftEye?.dv && !p.leftEye?.nv && !p.leftEye?.pc && (
                        <p className="text-base text-th-secondary italic">{uiT("Plain", "प्लेन")}</p>
                      )}
                    </div>
                  </div>
                  {(p.pd || p.notes) && (
                    <div className="flex gap-4 mt-3 pt-3 border-t border-th-border">
                      {p.pd && <p className="text-base text-th-secondary"><span className="font-medium">PD:</span> {p.pd}</p>}
                      {p.notes && <p className="text-base text-th-secondary"><span className="font-medium">{uiT("Notes:", "नोट्स:")}</span> {p.notes}</p>}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Bills ── */}
        {tab === "bills" && (
          <div className="bg-th-surface rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-th-text flex items-center gap-2">
                <Receipt size={14} className="text-[#1ed760]" /> {uiT("Bills", "बिल")} ({bills.length})
              </h3>
              {bills.length > 0 && (
                <div className="flex items-center gap-3 text-base">
                  <span className="text-th-secondary">{uiT("Total:", "कुल:")}</span>
                  <span className="font-bold text-th-text">₹{bills.reduce((s: number, b: any) => s + (b.totalAmount || 0), 0).toLocaleString()}</span>
                  {bills.reduce((s: number, b: any) => s + (b.pendingAmount || 0), 0) > 0 && (
                    <span className="font-bold text-[#e8a427]">₹{bills.reduce((s: number, b: any) => s + (b.pendingAmount || 0), 0).toLocaleString()} {uiT("due", "बकाया")}</span>
                  )}
                </div>
              )}
            </div>
            {bills.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-base text-th-secondary">{uiT("No bills yet", "अभी तक कोई बिल नहीं")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bills.map((b: any) => {
                  const itemCount = b.items?.length || 0;
                  const itemSummary = b.items?.slice(0, 3).map((it: any) => it.description).filter(Boolean).join(", ") || "";
                  const hasDiscount = (b.discount || 0) > 0;
                  const hasTax = (b.tax || 0) > 0;
                  const linkedVisit = visits.find((v: any) => getVisitId(v._id) === getVisitId(b.visitId));
                  return (
                    <div key={b._id} className="bg-th-elevated rounded-lg p-4 hover:bg-th-hover active:scale-[0.99] transition-all duration-150 cursor-pointer"
                      onClick={() => { if (linkedVisit) { setTab("visits"); openVisitDetail(linkedVisit); } }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-base font-bold text-th-text">{b.billNumber || "—"}</p>
                            <span className={`px-1.5 py-0.5 text-sm font-bold uppercase tracking-wider rounded ${
                              (b.pendingAmount || 0) > 0 ? "bg-[#e8a427]/10 text-[#e8a427]" : "bg-[#1ed760]/10 text-[#1ed760]"
                            }`}>
                              {(b.pendingAmount || 0) > 0 ? uiT("Pending", "बकाया") : uiT("Paid", "भुगतान")}
                            </span>
                            {b.status === "Cancelled" && (
                              <span className="px-1.5 py-0.5 text-base font-bold uppercase tracking-wider rounded bg-red-500/10 text-red-400">{uiT("Cancelled", "रद्द")}</span>
                            )}
                          </div>
                          <p className="text-base text-th-secondary mt-0.5">
                            {new Date(b.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            {itemCount > 0 && <span> · {itemCount} {itemCount === 1 ? uiT("item", "आइटम") : uiT("items", "आइटम")}</span>}
                            {linkedVisit && <span> · {uiT("Visit", "विज़िट")} {new Date(linkedVisit.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                          </p>
                          {itemSummary && (
                            <p className="text-base text-th-secondary mt-1 truncate max-w-[400px]">{itemSummary}{itemCount > 3 && ` +${itemCount - 3} more`}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-base">
                            {hasDiscount && <span className="text-red-400">{uiT("Discount", "छूट")}: -₹{b.discount}</span>}
                            {hasTax && <span className="text-[#1ed760]">{uiT("GST", "जीएसटी")}: +₹{b.tax}</span>}
                            {b.advancePaid > 0 && <span className="text-[#1ed760]">{uiT("Paid", "भुगतान")}: ₹{b.advancePaid.toLocaleString()}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-bold text-th-text">₹{(b.totalAmount || 0).toLocaleString()}</p>
                          {(b.pendingAmount || 0) > 0 && (
                            <p className="text-base font-bold text-[#e8a427] mt-0.5">₹{b.pendingAmount.toLocaleString()} {uiT("due", "बकाया")}</p>
                          )}
                          <button onClick={(e) => { e.stopPropagation(); sendWhatsApp(customer.mobile, b); }} disabled={sendingBill}
                            className="mt-2 px-2.5 py-1 bg-[#1ed760]/10 text-[#1ed760] rounded-lg text-base font-medium hover:bg-[#1ed760]/20 transition-colors flex items-center gap-1 ml-auto disabled:opacity-50">
                            {sendingBill ? <div className="animate-spin w-3 h-3 border-2 border-[#1ed760] border-t-transparent rounded-full" /> : <MessageCircle size={11} />} WhatsApp
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Orders ── */}
        {tab === "orders" && (
          <div className="bg-th-surface rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-th-text flex items-center gap-2">
                <ShoppingCart size={14} className="text-[#e8a427]" /> {uiT("Orders", "ऑर्डर")} ({orders.length})
              </h3>
              {orders.length > 0 && (
                <div className="flex items-center gap-3 text-base">
                  {["Delivered", "Ready", "In Lab", "Ordered", "Draft", "Cancelled"].map((st) => {
                    const count = orders.filter((o: any) => (o.status || "Draft") === st).length;
                    if (!count) return null;
                    return (
                      <span key={st} className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        st === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                        st === "Cancelled" ? "bg-red-500/10 text-red-400" :
                        st === "Ready" ? "bg-[#6ea8fe]/10 text-[#6ea8fe]" : "bg-[#e8a427]/10 text-[#e8a427]"
                      }`}>{count} {st}</span>
                    );
                  })}
                </div>
              )}
            </div>
            {orders.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-base text-th-secondary">{uiT("No orders yet", "अभी तक कोई ऑर्डर नहीं")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map((o: any) => {
                  const linkedVisit = visits.find((v: any) => getVisitId(v._id) === getVisitId(o.visitId));
                  return (
                    <div key={o._id} className="bg-th-elevated rounded-lg p-4 hover:bg-th-hover active:scale-[0.99] transition-all duration-150 cursor-pointer"
                      onClick={() => { if (linkedVisit) { setTab("visits"); openVisitDetail(linkedVisit); } }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 text-sm font-bold uppercase tracking-wider rounded ${
                              o.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                              o.status === "Cancelled" ? "bg-red-500/10 text-red-400" :
                              o.status === "Ready" ? "bg-[#6ea8fe]/10 text-[#6ea8fe]" :
                              o.status === "In Lab" ? "bg-purple-500/10 text-purple-400" :
                              o.status === "Ordered" ? "bg-blue-500/10 text-blue-400" : "bg-[#e8a427]/10 text-[#e8a427]"
                            }`}>{o.status || "Draft"}</span>
                            {linkedVisit && (
                              <span className="text-base text-th-secondary">{uiT("Visit", "विज़िट")} {new Date(linkedVisit.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                            )}
                          </div>
                          {/* Frame & Lens details */}
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-base">
                            {(o.frameBrand || o.frame) && (
                              <>
                                <span className="text-th-secondary font-bold uppercase tracking-wider">{uiT("Frame", "फ्रेम")}</span>
                                <span className="text-th-text font-medium">{[o.frameBrand, o.frameModel, o.frameColor, o.frameSize].filter(Boolean).join(" / ") || o.frame}{o.framePrice ? <span className="text-th-secondary"> ₹{o.framePrice}</span> : ""}</span>
                              </>
                            )}
                            {(o.lensBrand || o.lens) && (
                              <>
                                <span className="text-th-secondary font-bold uppercase tracking-wider">{uiT("Lens", "लेंस")}</span>
                                <span className="text-th-text font-medium">{[o.lensBrand, o.lensType, o.lensIndex].filter(Boolean).join(" / ") || o.lens}{o.lensPrice ? <span className="text-th-secondary"> ₹{o.lensPrice}</span> : ""}</span>
                              </>
                            )}
                            {o.coating && (
                              <>
                                <span className="text-th-secondary font-bold uppercase tracking-wider">{uiT("Coating", "कोटिंग")}</span>
                                <span className="text-th-text font-medium">{o.coating}{o.coatingPrice ? <span className="text-th-secondary"> ₹{o.coatingPrice}</span> : ""}</span>
                              </>
                            )}
                          </div>
                          {/* Bottom row: delivery, lab, accessories */}
                          <div className="flex items-center gap-3 mt-2 text-base text-th-secondary flex-wrap">
                            {o.quantity > 1 && <span className="flex items-center gap-0.5"><Wallet size={10} /> {uiT("Qty", "मात्रा")}: {o.quantity}</span>}
                            {o.deliveryDate && (
                              <span className="flex items-center gap-0.5">
                                <Clock size={10} /> {uiT("Due", "डिलीवरी")}: {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                            )}
                            {o.labAssigned && (
                              <span className="flex items-center gap-0.5">
                                <MapPinned size={10} /> {o.labAssigned}{o.labExpectedDate ? ` (by ${new Date(o.labExpectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})` : ""}
                              </span>
                            )}
                            {o.accessories?.length > 0 && (
                              <span className="text-th-secondary italic">{o.accessories.join(", ")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Edit Profile Modal ── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setEditing(false)}>
          <div className="bg-th-surface rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-th-border">
              <h3 className="text-base font-bold text-th-text flex items-center gap-2">
                <Edit3 size={15} className="text-[#1ed760]" />
                {uiT("Edit Profile", "प्रोफ़ाइल संपादित करें")}
              </h3>
              <button onClick={() => setEditing(false)} className="p-1.5 hover:bg-th-elevated rounded-full text-th-secondary hover:text-th-text transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-none p-6 space-y-4">
              <div className="bg-th-elevated rounded-lg p-4">
                <h4 className="text-base font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                  <User size={14} className="text-[#1ed760]" /> {uiT("Personal Info", "व्यक्तिगत जानकारी")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>{uiT("Name", "नाम")} *</label>
                    <input className={inputCls} value={editForm.name || ""} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{uiT("Age", "आयु")}</label>
                    <input type="number" inputMode="numeric" className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                      value={editForm.age || ""} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{uiT("Gender", "लिंग")}</label>
                    <select className={inputCls} value={editForm.gender || ""} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}>
                      <option value="">{uiT("Select", "चुनें")}</option>
                      <option value="Male">{uiT("Male", "पुरुष")}</option>
                      <option value="Female">{uiT("Female", "महिला")}</option>
                      <option value="Other">{uiT("Other", "अन्य")}</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-th-elevated rounded-lg p-4">
                <h4 className="text-base font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                  <Phone size={14} className="text-[#1ed760]" /> {uiT("Contact", "संपर्क")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>{uiT("Mobile", "मोबाइल")} *</label>
                    <input className={inputCls} value={editForm.mobile || ""} onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{uiT("Alt Mobile", "वैकल्पिक मोबाइल")}</label>
                    <input className={inputCls} value={editForm.alternateMobile || ""} onChange={(e) => setEditForm({ ...editForm, alternateMobile: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{uiT("Email", "ईमेल")}</label>
                    <input type="email" className={inputCls} value={editForm.email || ""} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="bg-th-elevated rounded-lg p-4">
                <h4 className="text-base font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                  <MapPin size={14} className="text-[#1ed760]" /> {uiT("Address", "पता")}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <label className={labelCls}>{uiT("Address", "पता")}</label>
                    <textarea className={inputCls} rows={2} value={editForm.address || ""} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{uiT("City", "शहर")}</label>
                    <input className={inputCls} value={editForm.city || ""} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="bg-th-elevated rounded-lg p-4">
                <h4 className="text-base font-bold uppercase tracking-wider text-th-text flex items-center gap-2 mb-3">
                  <TrendingUp size={14} className="text-[#1ed760]" /> {uiT("Tags", "टैग")}
                </h4>
                <input className={inputCls} placeholder="tag1, tag2" value={editForm.tags || ""} onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-th-border">
              <button onClick={() => setEditing(false)} className="text-base font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-th-elevated text-th-secondary hover:bg-th-hover hover:text-th-text transition-colors">
                {uiT("Cancel", "रद्द करें")}
              </button>
              <button onClick={handleEditSave} disabled={saving} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-5 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform disabled:opacity-50">
                <Save size={13} /> {saving ? "Saving..." : uiT("Save", "सहेजें")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Visit Detail Modal ── */}
      {selectedVisit && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setSelectedVisit(null)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-3xl bg-th-surface rounded-xl max-h-[90vh] overflow-y-auto shadow-xl scrollbar-none" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 bg-th-surface border-b border-th-border px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-th-text flex items-center gap-2">
                  <Calendar size={16} className="text-[#1ed760]" />
                  {new Date(selectedVisit.visitDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                  {selectedVisit.visitType && <span className="px-1.5 py-0.5 bg-th-hover text-th-secondary text-base font-bold uppercase tracking-wider rounded">{selectedVisit.visitType}</span>}
                </h2>
                <div className="flex items-center gap-2">
                  {!editingVisit && (
                    <button onClick={() => setEditingVisit(true)} className="flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 transition-colors">
                      <Edit3 size={12} /> {uiT("Edit", "संपादित")}
                    </button>
                  )}
                  <button onClick={() => setSelectedVisit(null)} className="p-1.5 hover:bg-th-elevated rounded-lg transition-colors">
                    <X size={16} className="text-th-secondary" />
                  </button>
                </div>
              </div>
              {/* Linked data indicators */}
              <div className="flex items-center gap-3 mt-2">
                {linkedPrescription && (
                  <span className="flex items-center gap-1 text-base font-bold uppercase tracking-wider text-purple-400">
                    <Eye size={10} /> {uiT("Rx", "प्रिस्क्रिप्शन")}
                  </span>
                )}
                {linkedOrder && (
                  <span className={`flex items-center gap-1 text-base font-bold uppercase tracking-wider ${
                    linkedOrder.status === "Delivered" ? "text-[#1ed760]" : "text-[#e8a427]"
                  }`}>
                    <ShoppingCart size={10} /> {uiT("Order", "ऑर्डर")} · {linkedOrder.status || "Draft"}
                  </span>
                )}
                {linkedBill && (
                  <span className={`flex items-center gap-1 text-base font-bold uppercase tracking-wider ${
                    (linkedBill.pendingAmount || 0) > 0 ? "text-[#e8a427]" : "text-[#1ed760]"
                  }`}>
                    <Receipt size={10} /> ₹{(linkedBill.totalAmount || 0).toLocaleString()}
                    {(linkedBill.pendingAmount || 0) > 0 && <span> · ₹{linkedBill.pendingAmount} due</span>}
                  </span>
                )}
                {!linkedPrescription && !linkedOrder && !linkedBill && (
                  <span className="text-base text-th-secondary italic">{uiT("No linked data", "कोई लिंक डेटा नहीं")}</span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Visit Info */}
              <div className="bg-th-elevated rounded-lg p-4">
                {editingVisit ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>{uiT("Visit Date", "विज़िट तिथि")}</label>
                        <input type="date" className={inputCls} value={editVisitForm.visitDate || ""} onChange={(e) => setEditVisitForm({ ...editVisitForm, visitDate: e.target.value })} />
                      </div>
                      <div>
                        <label className={labelCls}>{uiT("Visit Type", "विज़िट प्रकार")}</label>
                        <select className={inputCls} value={editVisitForm.visitType || "new"} onChange={(e) => setEditVisitForm({ ...editVisitForm, visitType: e.target.value })}>
                          <option value="new">{uiT("New", "नई")}</option>
                          <option value="frame_change">{uiT("Frame Change", "फ्रेम बदलाव")}</option>
                          <option value="new_lens">{uiT("New Lens", "नया लेंस")}</option>
                          <option value="contact_lens">{uiT("Contact Lens", "कॉन्टैक्ट लेंस")}</option>
                          <option value="service">{uiT("Service", "सेवा")}</option>
                          <option value="other">{uiT("Other", "अन्य")}</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>{uiT("Doctor Name", "डॉक्टर का नाम")}</label>
                      <input className={inputCls} value={editVisitForm.doctorName || ""} onChange={(e) => setEditVisitForm({ ...editVisitForm, doctorName: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>{uiT("Remarks", "टिप्पणी")}</label>
                      <textarea className={inputCls} rows={2} value={editVisitForm.remarks || ""} onChange={(e) => setEditVisitForm({ ...editVisitForm, remarks: e.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleVisitSave} disabled={savingVisit} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform disabled:opacity-50">
                        <Save size={12} /> {savingVisit ? "Saving..." : uiT("Save", "सहेजें")}
                      </button>
                      <button onClick={() => setEditingVisit(false)} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-th-hover text-th-secondary hover:text-th-text transition-colors">
                        <X size={12} /> {uiT("Cancel", "रद्द करें")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-3 text-base text-th-secondary">
                        {selectedVisit.visitType && selectedVisit.visitType !== "new" && (
                          <span className="px-1.5 py-0.5 bg-th-hover text-th-secondary text-base font-bold uppercase tracking-wider rounded">{selectedVisit.visitType.replace("_", " ")}</span>
                        )}
                        {selectedVisit.doctorName && <span className="flex items-center gap-1"><Stethoscope size={12} /> Dr. {selectedVisit.doctorName}</span>}
                        <span className="flex items-center gap-1"><Clock size={12} /> {new Date(selectedVisit.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      </div>
                      {selectedVisit.remarks && <p className="text-base text-th-secondary mt-2 bg-th-hover rounded-md p-3">{selectedVisit.remarks}</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Prescription */}
              {linkedPrescription && (
                <div className="bg-th-elevated rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Eye size={14} className="text-purple-400" />
                    <p className="text-base font-bold uppercase tracking-wider text-th-text">{uiT("Prescription", "प्रिस्क्रिप्शन")}</p>
                    {!editingRx && (
                      <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-base text-th-secondary">{new Date(linkedPrescription.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                        <button onClick={() => sendPrescriptionWhatsApp(linkedPrescription)} disabled={sendingRx} className="flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-[#1ed760]/10 text-[#1ed760] hover:bg-[#1ed760]/20 transition-colors disabled:opacity-50">
                          {sendingRx ? <div className="animate-spin w-3 h-3 border-2 border-[#1ed760] border-t-transparent rounded-full" /> : <MessageCircle size={11} />} {uiT("Send Rx", "प्रिस्क्रिप्शन भेजें")}
                        </button>
                        <button onClick={openRxEdit} className="flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-th-hover text-th-secondary hover:text-th-text transition-colors">
                          <Edit3 size={11} /> {uiT("Edit", "संपादित")}
                        </button>
                      </div>
                    )}
                  </div>
                  {editingRx ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(["rightEye", "leftEye"] as const).map((eye) => (
                          <div key={eye} className="bg-th-hover rounded-md p-3">
                            <p className={`text-base font-bold uppercase tracking-wider mb-2 ${eye === "rightEye" ? "text-[#6ea8fe]" : "text-[#e8a427]"}`}>
                              {eye === "rightEye" ? uiT("Right Eye", "दाहिनी आंख") : uiT("Left Eye", "बाईं आंख")}
                            </p>
                            {(["dv", "nv", "pc"] as const).map((sub) => (
                              <div key={sub} className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-base font-bold uppercase tracking-wider text-th-secondary w-7">{sub.toUpperCase()}</span>
                                {(["sph", "cyl", "axis", "va"] as const).map((k) => (
                                  <input key={k} placeholder={k.toUpperCase()} className="w-16 bg-th-elevated text-th-text px-1.5 py-1 rounded text-base text-center outline-none focus:ring-1 focus:ring-[#1ed760]"
                                    value={editRxForm[eye]?.[sub]?.[k] ?? ""} onChange={(e) => setEditRxForm({
                                      ...editRxForm, [eye]: { ...editRxForm[eye], [sub]: { ...editRxForm[eye]?.[sub], [k]: e.target.value } }
                                    })} />
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>PD</label>
                          <input className={inputCls} value={editRxForm.pd || ""} onChange={(e) => setEditRxForm({ ...editRxForm, pd: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelCls}>{uiT("Notes", "नोट्स")}</label>
                          <input className={inputCls} value={editRxForm.notes || ""} onChange={(e) => setEditRxForm({ ...editRxForm, notes: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleRxSave} disabled={savingRx} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform disabled:opacity-50">
                          <Save size={12} /> {savingRx ? "Saving..." : uiT("Save", "सहेजें")}
                        </button>
                        <button onClick={() => setEditingRx(false)} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-th-hover text-th-secondary hover:text-th-text transition-colors">
                          <X size={12} /> {uiT("Cancel", "रद्द करें")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-th-hover rounded-md p-3">
                          <p className="text-base font-bold uppercase tracking-wider text-[#6ea8fe] mb-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#6ea8fe]" /> {uiT("Right Eye", "दाहिनी आंख")}
                          </p>
                          {linkedPrescription.rightEye?.dv && <EyeRow label="DV" data={linkedPrescription.rightEye.dv} />}
                          {linkedPrescription.rightEye?.nv && <EyeRow label="NV" data={linkedPrescription.rightEye.nv} />}
                          {linkedPrescription.rightEye?.pc && <EyeRow label="PC" data={linkedPrescription.rightEye.pc} />}
                          {!linkedPrescription.rightEye?.dv && !linkedPrescription.rightEye?.nv && !linkedPrescription.rightEye?.pc && (
                            <p className="text-base text-th-secondary italic">{uiT("Plain", "प्लेन")}</p>
                          )}
                        </div>
                        <div className="bg-th-hover rounded-md p-3">
                          <p className="text-base font-bold uppercase tracking-wider text-[#e8a427] mb-2 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#e8a427]" /> {uiT("Left Eye", "बाईं आंख")}
                          </p>
                          {linkedPrescription.leftEye?.dv && <EyeRow label="DV" data={linkedPrescription.leftEye.dv} />}
                          {linkedPrescription.leftEye?.nv && <EyeRow label="NV" data={linkedPrescription.leftEye.nv} />}
                          {linkedPrescription.leftEye?.pc && <EyeRow label="PC" data={linkedPrescription.leftEye.pc} />}
                          {!linkedPrescription.leftEye?.dv && !linkedPrescription.leftEye?.nv && !linkedPrescription.leftEye?.pc && (
                            <p className="text-base text-th-secondary italic">{uiT("Plain", "प्लेन")}</p>
                          )}
                        </div>
                      </div>
                      {(linkedPrescription.pd || linkedPrescription.notes) && (
                        <div className="flex gap-4 mt-3 pt-3 border-t border-th-border text-base">
                          {linkedPrescription.pd && <p className="text-th-secondary"><span className="font-medium">PD:</span> {linkedPrescription.pd}</p>}
                          {linkedPrescription.notes && <p className="text-th-secondary"><span className="font-medium">{uiT("Notes:", "नोट्स:")}</span> {linkedPrescription.notes}</p>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Order */}
              {linkedOrder && (
                <div className="bg-th-elevated rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShoppingCart size={14} className="text-[#e8a427]" />
                    <p className="text-base font-bold uppercase tracking-wider text-th-text">{uiT("Order", "ऑर्डर")}</p>
                    <span className={`text-sm font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ml-auto ${
                      linkedOrder.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                      linkedOrder.status === "Ready" ? "bg-[#6ea8fe]/10 text-[#6ea8fe]" :
                      linkedOrder.status === "Cancelled" ? "bg-red-500/10 text-red-400" : "bg-[#e8a427]/10 text-[#e8a427]"
                    }`}>{linkedOrder.status || "Draft"}</span>
                    {!editingOrder && (
                      <button onClick={openOrderEdit} className="flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-th-hover text-th-secondary hover:text-th-text transition-colors">
                        <Edit3 size={11} /> {uiT("Edit", "संपादित")}
                      </button>
                    )}
                  </div>
                  {editingOrder ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div><label className={labelCls}>{uiT("Frame", "फ्रेम")}</label><input className={inputCls} value={editOrderForm.frame || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, frame: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Frame Brand", "फ्रेम ब्रांड")}</label><input className={inputCls} value={editOrderForm.frameBrand || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, frameBrand: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Frame Model", "फ्रेम मॉडल")}</label><input className={inputCls} value={editOrderForm.frameModel || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, frameModel: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Frame Color", "फ्रेम रंग")}</label><input className={inputCls} value={editOrderForm.frameColor || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, frameColor: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Frame Size", "फ्रेम आकार")}</label><input className={inputCls} value={editOrderForm.frameSize || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, frameSize: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Frame Price", "फ्रेम मूल्य")}</label><input type="number" inputMode="numeric" className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} value={editOrderForm.framePrice ?? ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, framePrice: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Lens", "लेंस")}</label><input className={inputCls} value={editOrderForm.lens || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, lens: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Lens Brand", "लेंस ब्रांड")}</label><input className={inputCls} value={editOrderForm.lensBrand || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, lensBrand: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Lens Type", "लेंस प्रकार")}</label><input className={inputCls} value={editOrderForm.lensType || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, lensType: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Lens Index", "लेंस इंडेक्स")}</label><input className={inputCls} value={editOrderForm.lensIndex || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, lensIndex: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Lens Price", "लेंस मूल्य")}</label><input type="number" inputMode="numeric" className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} value={editOrderForm.lensPrice ?? ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, lensPrice: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Coating", "कोटिंग")}</label><input className={inputCls} value={editOrderForm.coating || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, coating: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Coating Price", "कोटिंग मूल्य")}</label><input type="number" inputMode="numeric" className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} value={editOrderForm.coatingPrice ?? ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, coatingPrice: e.target.value })} /></div>
                      </div>
                      <div><label className={labelCls}>{uiT("Accessories", "सहायक")}</label><input className={inputCls} placeholder="comma separated" value={editOrderForm.accessories || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, accessories: e.target.value })} /></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className={labelCls}>{uiT("Qty", "मात्रा")}</label><input type="number" inputMode="numeric" className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} value={editOrderForm.quantity ?? 1} onChange={(e) => setEditOrderForm({ ...editOrderForm, quantity: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Delivery", "डिलीवरी")}</label><input type="date" className={inputCls} value={editOrderForm.deliveryDate || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, deliveryDate: e.target.value })} /></div>
                        <div>
                          <label className={labelCls}>{uiT("Status", "स्थिति")}</label>
                          <select className={inputCls} value={editOrderForm.status || "Draft"} onChange={(e) => setEditOrderForm({ ...editOrderForm, status: e.target.value })}>
                            <option value="Draft">Draft</option>
                            <option value="Ordered">Ordered</option>
                            <option value="In Lab">In Lab</option>
                            <option value="Ready">Ready</option>
                            <option value="Delivered">Delivered</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className={labelCls}>{uiT("Lab", "लैब")}</label><input className={inputCls} value={editOrderForm.labAssigned || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, labAssigned: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Lab Expected", "लैब अपेक्षित")}</label><input type="date" className={inputCls} value={editOrderForm.labExpectedDate || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, labExpectedDate: e.target.value })} /></div>
                        <div><label className={labelCls}>{uiT("Lab Remarks", "लैब टिप्पणी")}</label><input className={inputCls} value={editOrderForm.labRemarks || ""} onChange={(e) => setEditOrderForm({ ...editOrderForm, labRemarks: e.target.value })} /></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleOrderSave} disabled={savingOrder} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform disabled:opacity-50">
                          <Save size={12} /> {savingOrder ? "Saving..." : uiT("Save", "सहेजें")}
                        </button>
                        <button onClick={() => setEditingOrder(false)} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-th-hover text-th-secondary hover:text-th-text transition-colors">
                          <X size={12} /> {uiT("Cancel", "रद्द करें")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-base">
                        {linkedOrder.frame && (
                          <>
                            <p className="text-th-secondary font-bold uppercase tracking-wider text-base">{uiT("Frame", "फ्रेम")}</p>
                            <p className="font-semibold text-th-text text-right">{[linkedOrder.frameBrand, linkedOrder.frameModel, linkedOrder.frameColor, linkedOrder.frameSize].filter(Boolean).join(" / ") || linkedOrder.frame}{linkedOrder.framePrice ? ` (₹${linkedOrder.framePrice})` : ""}</p>
                          </>
                        )}
                        {linkedOrder.lens && (
                          <>
                            <p className="text-th-secondary font-bold uppercase tracking-wider text-base">{uiT("Lens", "लेंस")}</p>
                            <p className="font-semibold text-th-text text-right">{[linkedOrder.lensBrand, linkedOrder.lensType, linkedOrder.lensIndex].filter(Boolean).join(" / ") || linkedOrder.lens}{linkedOrder.lensPrice ? ` (₹${linkedOrder.lensPrice})` : ""}</p>
                          </>
                        )}
                        {linkedOrder.coating && (
                          <>
                            <p className="text-th-secondary font-bold uppercase tracking-wider text-base">{uiT("Coating", "कोटिंग")}</p>
                            <p className="font-semibold text-th-text text-right">{linkedOrder.coating}{linkedOrder.coatingPrice ? ` (₹${linkedOrder.coatingPrice})` : ""}</p>
                          </>
                        )}
                        {linkedOrder.accessories?.length > 0 && (
                          <>
                            <p className="text-th-secondary font-bold uppercase tracking-wider text-base">{uiT("Accessories", "सहायक")}</p>
                            <p className="font-semibold text-th-text text-right">{linkedOrder.accessories.join(", ")}</p>
                          </>
                        )}
                        <p className="text-th-secondary font-bold uppercase tracking-wider text-base">{uiT("Qty", "मात्रा")}</p>
                        <p className="font-semibold text-th-text text-right">{linkedOrder.quantity || 1}</p>
                        {linkedOrder.deliveryDate && (
                          <>
                            <p className="text-th-secondary font-bold uppercase tracking-wider text-base">{uiT("Delivery", "डिलीवरी")}</p>
                            <p className="font-semibold text-th-text text-right">{new Date(linkedOrder.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                          </>
                        )}
                        {linkedOrder.labAssigned && (
                          <>
                            <p className="text-th-secondary font-bold uppercase tracking-wider text-base">{uiT("Lab", "लैब")}</p>
                            <p className="font-semibold text-th-text text-right">{linkedOrder.labAssigned}{linkedOrder.labExpectedDate ? ` (by ${new Date(linkedOrder.labExpectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})` : ""}</p>
                          </>
                        )}
                      </div>
                      {linkedOrder.labRemarks && (
                        <p className="text-base text-th-secondary mt-2 pt-2 border-t border-th-border">{uiT("Lab Remarks", "लैब टिप्पणी")}: {linkedOrder.labRemarks}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Bill */}
              {linkedBill && (
                <div className="bg-th-elevated rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Receipt size={14} className="text-[#1ed760]" />
                    <p className="text-base font-bold uppercase tracking-wider text-th-text">{uiT("Bill", "बिल")}</p>
                    <span className="text-base text-th-secondary ml-auto font-mono">{linkedBill.billNumber}</span>
                    {!editingBill && (
                      <button onClick={openBillEdit} className="flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-th-hover text-th-secondary hover:text-th-text transition-colors">
                        <Edit3 size={11} /> {uiT("Edit", "संपादित")}
                      </button>
                    )}
                  </div>
                  {editingBill ? (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        {(editBillForm.items || []).map((it: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2">
                            <input className={`${inputCls} flex-1`} placeholder={uiT("Item name", "आइटम का नाम")} value={it.description} onChange={(e) => updateBillItem(idx, "description", e.target.value)} />
                            <input type="number" inputMode="numeric" className={`${inputCls} w-16 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} placeholder="Qty" value={it.quantity} onChange={(e) => updateBillItem(idx, "quantity", e.target.value)} />
                            <input type="number" inputMode="numeric" className={`${inputCls} w-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} placeholder={uiT("Price", "मूल्य")} value={it.unitPrice} onChange={(e) => updateBillItem(idx, "unitPrice", e.target.value)} />
                            <span className="text-base font-semibold text-th-text w-20 text-right">₹{((Number(it.quantity) || 1) * (Number(it.unitPrice) || 0)).toFixed(0)}</span>
                            {editBillForm.items.length > 1 && (
                              <button onClick={() => removeBillItem(idx)} className="p-1 hover:bg-red-500/10 rounded text-red-400 transition-colors"><X size={12} /></button>
                            )}
                          </div>
                        ))}
                      </div>
                      <button onClick={addBillItem} className="flex items-center gap-1 text-base font-bold uppercase tracking-wider px-4 py-2 rounded-lg bg-th-hover text-th-secondary hover:text-th-text transition-colors">
                        <Plus size={11} /> {uiT("Add Item", "आइटम जोड़ें")}
                      </button>
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className={labelCls}>{uiT("Discount", "छूट")}</label><input type="number" inputMode="numeric" className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} value={editBillForm.discount ?? ""} onChange={(e) => setEditBillForm((f: any) => ({ ...f, discount: e.target.value }))} /></div>
                        <div><label className={labelCls}>{uiT("GST", "जीएसटी")}</label><input type="number" inputMode="numeric" className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} value={editBillForm.tax ?? ""} onChange={(e) => setEditBillForm((f: any) => ({ ...f, tax: e.target.value }))} /></div>
                        <div><label className={labelCls}>{uiT("Paid", "भुगतान")}</label><input type="number" inputMode="numeric" className={`${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`} value={editBillForm.advancePaid ?? ""} onChange={(e) => setEditBillForm((f: any) => ({ ...f, advancePaid: e.target.value }))} /></div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleBillSave} disabled={savingBill} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-[#1ed760] text-black hover:bg-[#1ed760]/90 active:scale-95 transition-transform disabled:opacity-50">
                          <Save size={12} /> {savingBill ? "Saving..." : uiT("Save", "सहेजें")}
                        </button>
                        <button onClick={() => setEditingBill(false)} className="flex items-center gap-1.5 text-base font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg bg-th-hover text-th-secondary hover:text-th-text transition-colors">
                          <X size={12} /> {uiT("Cancel", "रद्द करें")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {linkedBill.items?.length > 0 && (
                        <div className="overflow-x-auto mb-3 rounded-md">
                          <table className="w-full text-base">
                            <thead>
                              <tr className="border-b border-th-border">
                                <th className="text-left py-2 px-2 font-bold uppercase tracking-wider text-th-secondary text-base">{uiT("Item", "आइटम")}</th>
                                <th className="text-center py-2 px-2 font-bold uppercase tracking-wider text-th-secondary text-base">Qty</th>
                                <th className="text-right py-2 px-2 font-bold uppercase tracking-wider text-th-secondary text-base">{uiT("Price", "मूल्य")}</th>
                                <th className="text-right py-2 px-2 font-bold uppercase tracking-wider text-th-secondary text-base">{uiT("Total", "कुल")}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-th-border">
                              {linkedBill.items.map((it: any, i: number) => (
                                <tr key={it._id || it.description || i}>
                                  <td className="py-2 px-2 text-th-text">{it.description || uiT("Item", "आइटम")}</td>
                                  <td className="py-2 px-2 text-center text-th-secondary">{it.quantity || 1}</td>
                                  <td className="py-2 px-2 text-right text-th-secondary">₹{(it.unitPrice || 0).toFixed(0)}</td>
                                  <td className="py-2 px-2 text-right font-semibold text-th-text">₹{((it.quantity || 1) * (it.unitPrice || 0)).toFixed(0)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      <div className="space-y-1.5 text-base">
                        <div className="flex justify-between text-th-secondary"><span>{uiT("Subtotal", "उप-कुल")}</span><span>₹{(linkedBill.subtotal || 0).toFixed(0)}</span></div>
                        {linkedBill.discount ? <div className="flex justify-between text-red-400"><span>{uiT("Discount", "छूट")}</span><span>-₹{linkedBill.discount.toFixed(0)}</span></div> : null}
                        {linkedBill.tax ? <div className="flex justify-between text-[#1ed760]"><span>{uiT("GST", "जीएसटी")}</span><span>+₹{linkedBill.tax.toFixed(0)}</span></div> : null}
                        <div className="flex justify-between font-bold text-th-text pt-1.5 border-t border-th-border"><span>{uiT("Total", "कुल")}</span><span>₹{(linkedBill.totalAmount || 0).toFixed(0)}</span></div>
                        {linkedBill.advancePaid !== undefined && (
                          <div className="flex justify-between text-[#1ed760] items-center pt-1">
                            <span>{uiT("Paid", "भुगतान")}</span>
                            {editingBillAdvance ? (
                              <div className="flex items-center gap-1">
                                <input type="number" min="0" step="0.01" className="w-24 bg-th-hover text-th-text px-2 py-1 rounded text-base text-right outline-none focus:ring-1 focus:ring-[#1ed760]"
                                  value={editBillAdvanceAmount} onFocus={(e) => e.target.select()} onChange={(e) => setEditBillAdvanceAmount(Number(e.target.value))} />
                                <button onClick={handleBillAdvanceSave} disabled={savingBillAdvance} className="p-1 hover:bg-[#1ed760]/10 rounded text-[#1ed760] transition-colors">
                                  {savingBillAdvance ? <div className="animate-spin w-3 h-3 border-2 border-[#1ed760] border-t-transparent rounded-full" /> : <Save size={12} />}
                                </button>
                                <button onClick={() => setEditingBillAdvance(false)} className="p-1 hover:bg-red-500/10 rounded text-red-400 transition-colors"><X size={12} /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold">₹{linkedBill.advancePaid.toFixed(0)}</span>
                                <button onClick={() => { setEditBillAdvanceAmount(linkedBill.advancePaid || 0); setEditingBillAdvance(true); }}
                                  className="px-2 py-0.5 bg-[#1ed760]/10 text-[#1ed760] rounded text-base font-medium hover:bg-[#1ed760]/20 transition-colors flex items-center gap-0.5">
                                  <Edit3 size={10} /> {uiT("Edit", "संपादित")}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {(linkedBill.pendingAmount || 0) > 0 && (
                          <div className="flex justify-between text-[#e8a427] font-bold pt-1">
                            <span>{uiT("Balance Due", "बकाया राशि")}</span>
                            <span>₹{linkedBill.pendingAmount.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  <div className="mt-3 pt-3 border-t border-th-border">
                    <button onClick={() => sendWhatsApp(customer?.mobile, linkedBill)} disabled={sendingBill}
                      className="px-3 py-2 bg-[#1ed760]/10 text-[#1ed760] rounded-lg text-base font-medium hover:bg-[#1ed760]/20 transition-colors flex items-center gap-1.5 disabled:opacity-50">
                      {sendingBill ? <div className="animate-spin w-3.5 h-3.5 border-2 border-[#1ed760] border-t-transparent rounded-full" /> : <MessageCircle size={13} />} {uiT("Send on WhatsApp", "व्हाट्सऐप पर भेजें")}
                    </button>
                  </div>
                </div>
              )}

              {!linkedPrescription && !linkedOrder && !linkedBill && (
                <p className="text-base text-th-secondary py-8 text-center">{uiT("No linked data for this visit.", "इस विज़िट के लिए कोई लिंक डेटा नहीं।")}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

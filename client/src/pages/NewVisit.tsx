import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import {
  ArrowLeft, Eye, ShoppingCart, DollarSign, CreditCard, Plus, Save, X, MessageCircle,
  AlertCircle, Info, Tag, Sun, ChevronRight, ChevronLeft, Check, Calendar, Phone, User, Clock
} from "lucide-react";

interface EyeData { sph?: number; cyl?: number; axis?: number; va?: string; }
interface EyeSet { dv?: EyeData; nv?: EyeData; pc?: EyeData; }

export default function NewVisit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Steps
  const [visitStep, setVisitStep] = useState<"type" | "prescription" | "products" | "billing" | "summary" | "done">("type");
  const [visitType, setVisitType] = useState<"new_specs" | "frame_change" | "new_lens" | "contact_lens" | "sunglasses" | "service" | "other">("new_specs");
  const [otherSubType, setOtherSubType] = useState("");

  const otherSubTypes = ["Fitted Near Specs", "Sunglasses", "Hearing Aid", "Cell Cleaning Spray/Kit", "Other Products"];

  // Visit details
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [visitDoctor, setVisitDoctor] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");

  // Prescription
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [prevPrescription, setPrevPrescription] = useState<any>(null);
  const [prescription, setPrescription] = useState({
    rightEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    leftEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    pd: "", notes: "",
  });

  // Order
  const [orderFrame, setOrderFrame] = useState("");
  const [orderFrameBrand, setOrderFrameBrand] = useState("");
  const [orderFrameModel, setOrderFrameModel] = useState("");
  const [orderFrameColor, setOrderFrameColor] = useState("");
  const [orderFramePrice, setOrderFramePrice] = useState(0);
  const [orderLens, setOrderLens] = useState("");
  const [orderLensBrand, setOrderLensBrand] = useState("");
  const [lensFeatures, setLensFeatures] = useState<string[]>([]);
  const [orderLensIndex, setOrderLensIndex] = useState("");
  const [orderLensPrice, setOrderLensPrice] = useState(0);
  const [orderCoating, setOrderCoating] = useState("");
  const [orderCoatingPrice, setOrderCoatingPrice] = useState(0);
  const [orderAccessories, setOrderAccessories] = useState<{ name: string; price: number }[]>([]);
  const [orderDeliveryDate, setOrderDeliveryDate] = useState("");

  const lensFeatureOptions = ["Single Vision", "Bifocal", "Progressive", "Polycarbonate", "Blue Cut", "Photochromic", "Polarized", "High Index"];

  // Billing
  const [billItems, setBillItems] = useState<{ description: string; qty: number; price: number }[]>([
    { description: "", qty: 1, price: 0 },
  ]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [billTax, setBillTax] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);

  // Payment
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Success data
  const [successData, setSuccessData] = useState<any>(null);

  // Auto WhatsApp
  const [waCountdown, setWaCountdown] = useState(0);
  const [waCancelled, setWaCancelled] = useState(false);
  const [waSending, setWaSending] = useState(false);
  const [waSent, setWaSent] = useState(false);
  const [waFailed, setWaFailed] = useState(false);
  const waTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const billSubtotal = billItems.reduce((s, i) => s + i.qty * i.price, 0);
  const billTotal = billSubtotal - billDiscount + billTax;
  const pendingAmt = billTotal - advancePaid - paymentAmount;

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.get(`/api/customers/${id}`),
      api.get(`/api/prescriptions?customerId=${id}`),
      api.get(`/api/orders?customerId=${id}`),
    ]).then(([c, p, o]) => {
      if (c.success) setCustomer(c.data);
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
      if (o.success && o.data.length > 0) {
        const last = o.data[0];
        setOrderFrame(last.frame || "");
        setOrderFrameBrand(last.frameBrand || "");
        setOrderFrameModel(last.frameModel || "");
        setOrderFrameColor(last.frameColor || "");
        setOrderFramePrice(last.framePrice || 0);
        setOrderLens(last.lens || "");
        setOrderLensBrand(last.lensBrand || "");
        setLensFeatures((last.lensType || "").split(", ").filter(Boolean));
        setOrderLensIndex(last.lensIndex || "");
        setOrderLensPrice(last.lensPrice || 0);
        setOrderCoating(last.coating || "");
        setOrderCoatingPrice(last.coatingPrice || 0);
        if (last.accessories) setOrderAccessories(last.accessories.map((a: any) => typeof a === "string" ? { name: a, price: 0 } : a));

        const items: { description: string; qty: number; price: number }[] = [];
        if (last.frame) items.push({ description: `Frame - ${last.frame}`, qty: 1, price: last.framePrice || 0 });
        if (last.lens) items.push({ description: `Lens - ${last.lens}`, qty: 1, price: last.lensPrice || 0 });
        if (last.coating) items.push({ description: `Coating - ${last.coating}`, qty: 1, price: last.coatingPrice || 0 });
        const accs = (last.accessories || []).map((a: any) => typeof a === "string" ? { name: a, price: 0 } : a);
        accs.forEach((a: any) => items.push({ description: a.name, qty: 1, price: a.price || 0 }));
        if (items.length > 0) setBillItems(items);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  // Auto WhatsApp countdown
  function startWaTimer() {
    setWaCountdown(3);
    setWaCancelled(false);
    setWaSent(false);
    setWaSending(false);
    setWaFailed(false);
    waTimerRef.current = setTimeout(() => doWaSend(), 3000);
  }

  function cancelWaSend() {
    if (waTimerRef.current) clearTimeout(waTimerRef.current);
    setWaCancelled(true);
    setWaCountdown(0);
  }

  function doWaSend() {
    setWaSending(true);
    setWaCountdown(0);
    const num = customer?.mobile?.replace(/\D/g, "");
    const bill = successData?.bill;
    if (!num || !customer) { setWaSending(false); return; }
    const fullNum = num.length === 10 ? `91${num}` : num;
    api.get("/api/settings").then(async (settingsRes) => {
      const shop = settingsRes.success ? settingsRes.data?.shopName || "KMJ Optical" : "KMJ Optical";
      if (bill) {
        // Try sending PDF via server API
        try {
          const { generateBillPdf } = await import("../utils/pdf");
          const doc = generateBillPdf(bill, customer, settingsRes.success ? settingsRes.data : {});
          const base64 = doc.output("datauristring").split(",")[1];
          const caption = `*${shop}*\n\nHi ${customer.name},\nThank you for your visit!\nPlease find your bill attached.\n\nThank you!`;
          const mediaRes = await api.post("/api/whatsapp/send-media", { phone: fullNum, base64, filename: `Bill-${bill.billNumber || "invoice"}.pdf`, caption });
          if (mediaRes.success) {
            setWaSent(true);
            setWaSending(false);
            return;
          }
          console.warn("WhatsApp PDF send failed:", mediaRes?.message || mediaRes?.status || "Unknown error");
        } catch (e) {
          console.warn("WhatsApp PDF send error:", e);
        }
        // PDF send failed, don't auto-fallback to text
        setWaFailed(true);
      } else {
        const msg = `*${shop}*\n\nHi ${customer.name},\nThank you for your visit!\n\nService completed successfully.\n\nThank you!`;
        try { await api.post("/api/whatsapp/send", { phone: fullNum, message: msg }); } catch {}
        setWaSent(true);
      }
      setWaSending(false);
    }).catch(() => {
      setWaFailed(true);
      setWaSending(false);
    });
  }

  // Show countdown ticking
  useEffect(() => {
    if (waCountdown <= 0 || waCancelled) return;
    const t = setTimeout(() => setWaCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [waCountdown, waCancelled]);

  // Sync bill items when entering billing step
  useEffect(() => {
    if (visitStep === "billing") syncBillFromOrder();
  }, [visitStep]);

  // Pre-fill payment amount with pending balance when entering billing step
  useEffect(() => {
    if (visitStep === "billing") {
      const pending = Math.max(0, billTotal - advancePaid);
      setPaymentAmount(pending > 0 ? pending : 0);
    }
  }, [visitStep]);

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

  function cleanEyeSet(e: any): any {
    return { dv: cleanEye(e.dv), nv: cleanEye(e.nv), pc: cleanEye(e.pc) };
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

  function addBillItem() { setBillItems((prev) => [...prev, { description: "", qty: 1, price: 0 }]); }
  function removeBillItem(idx: number) { if (billItems.length > 1) setBillItems((prev) => prev.filter((_, i) => i !== idx)); }
  function updateBillItem(idx: number, field: "description" | "qty" | "price", value: string | number) {
    setBillItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function addAccessory() { setOrderAccessories((prev) => [...prev, { name: "", price: 0 }]); }
  function updateAccessory(idx: number, field: "name" | "price", value: string | number) {
    setOrderAccessories((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  }
  function removeAccessory(idx: number) { setOrderAccessories((prev) => prev.filter((_, i) => i !== idx)); }

  function syncBillFromOrder() {
    if (visitType === "service") return;
    const items: { description: string; qty: number; price: number }[] = [];
    if (visitType === "other") {
      if (orderFrame) items.push({ description: orderFrame, qty: orderQty, price: orderFramePrice });
      orderAccessories.filter((a) => a.name).forEach((a) => items.push({ description: a.name, qty: 1, price: a.price }));
      if (items.length > 0) setBillItems(items);
      return;
    }
    const hasLens = orderLens || orderLensBrand || orderLensType || orderLensIndex;
    if (visitType !== "new_lens" && visitType !== "contact_lens" && orderFrame) {
      items.push({ description: `Frame - ${orderFrame}`, qty: orderQty, price: orderFramePrice });
    }
    if (visitType !== "frame_change" && visitType !== "sunglasses" && hasLens) {
      const lensDesc = orderLens || `${orderLensBrand} ${orderLensType}`.trim() || "Lens";
      items.push({ description: `Lens - ${lensDesc}`, qty: 1, price: orderLensPrice });
    }
    if (visitType !== "frame_change" && visitType !== "sunglasses" && visitType !== "contact_lens" && orderCoating) {
      items.push({ description: `Coating - ${orderCoating}`, qty: 1, price: orderCoatingPrice });
    }
    orderAccessories.filter((a) => a.name).forEach((a) => {
      if (!items.some((i) => i.description === a.name)) items.push({ description: a.name, qty: 1, price: a.price });
    });
    if (items.length > 0) setBillItems(items);
  }

  function canProceed(): boolean {
    switch (visitStep) {
      case "type": return !!visitType;
      case "prescription": return true;
      case "products": return true;
      case "billing": return visitType === "service" ? true : billItems.some((i) => i.description && i.price > 0);
      case "summary": return true;
      default: return true;
    }
  }

  function goNext() {
    if (visitType === "service") {
      if (visitStep === "prescription") { setVisitStep("summary"); return; }
      const steps = ["type", "prescription", "products", "billing", "summary"];
      const idx = steps.indexOf(visitStep);
      if (idx < steps.length - 1 && canProceed()) setVisitStep(steps[idx + 1] as any);
      return;
    }
    const steps = ["type", "prescription", "products", "billing", "summary"];
    let idx = steps.indexOf(visitStep);
    if (visitType === "other" && steps[idx] === "prescription") {
      idx++;
    }
    if (idx < steps.length - 1 && canProceed()) setVisitStep(steps[idx + 1] as any);
  }

  function goBack() {
    const steps = ["type", "prescription", "products", "billing", "summary"];
    const idx = steps.indexOf(visitStep);
    if (idx > 0) setVisitStep(steps[idx - 1] as any);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const payload: any = { customer: { _id: id, name: customer.name, mobile: customer.mobile } };

      payload.visit = { doctorName: visitDoctor || undefined, remarks: visitRemarks || undefined };
      payload.prescription = {
        rightEye: cleanEyeSet(prescription.rightEye),
        leftEye: cleanEyeSet(prescription.leftEye),
        pd: prescription.pd || undefined,
        notes: prescription.notes || undefined,
      };

      if (visitType !== "service") {
        payload.order = {
          frame: orderFrame || undefined, frameBrand: orderFrameBrand || undefined,
          frameModel: orderFrameModel || undefined, frameColor: orderFrameColor || undefined,
          frameSize: orderFrameSize || undefined, framePrice: orderFramePrice || 0,
          lens: orderLens || undefined, lensBrand: orderLensBrand || undefined,
          lensType: orderLensType || undefined, lensIndex: orderLensIndex || undefined,
          lensPrice: orderLensPrice || 0,
          coating: orderCoating || undefined, coatingPrice: orderCoatingPrice || 0,
          accessories: orderAccessories.map((a) => a.name),
          quantity: orderQty, deliveryDate: orderDeliveryDate || undefined,
        };
        if (visitType === "frame_change") {
          delete payload.order.lens; delete payload.order.lensBrand;
          delete payload.order.lensType; delete payload.order.lensIndex; delete payload.order.lensPrice;
          delete payload.order.coating; delete payload.order.coatingPrice;
        }
        if (visitType === "new_lens") {
          delete payload.order.frame; delete payload.order.frameBrand;
          delete payload.order.frameModel; delete payload.order.frameColor;
          delete payload.order.frameSize; delete payload.order.framePrice;
        }
        if (visitType === "contact_lens") {
          delete payload.order.frame; delete payload.order.frameBrand;
          delete payload.order.frameModel; delete payload.order.frameColor;
          delete payload.order.frameSize; delete payload.order.framePrice;
          delete payload.order.coating; delete payload.order.coatingPrice;
        }
        if (visitType === "other") {
          delete payload.order.frameBrand; delete payload.order.frameModel;
          delete payload.order.frameColor; delete payload.order.frameSize;
          delete payload.order.lens; delete payload.order.lensBrand;
          delete payload.order.lensType; delete payload.order.lensIndex; delete payload.order.lensPrice;
          delete payload.order.coating; delete payload.order.coatingPrice;
        }
      }

      const validItems = billItems.filter((i) => i.description && i.price > 0);
      if (validItems.length > 0) {
        payload.bill = {
          items: validItems.map((i) => ({ description: i.description, quantity: i.qty, unitPrice: i.price })),
          discount: billDiscount || 0, tax: billTax || 0, advancePaid: advancePaid || 0,
        };
      }

      if (paymentAmount > 0) {
        payload.payment = { amount: paymentAmount, paymentMode, notes: paymentNotes || undefined };
      }

      const res = await api.post("/api/workspace/transaction", payload);
      if (res.success) {
        setSuccessData(res.data);
        setVisitStep("done");
        if (res.data.visit && customer?.mobile?.replace(/\D/g, "")) {
          startWaTimer();
        }
      } else {
        setError(res.message || "Failed to save");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally { setSaving(false); }
  }

  const visitTypes = [
    { value: "new_specs", label: "New Specs", icon: Eye, desc: "Frame + Lens + Coating" },
    { value: "frame_change", label: "Frame Change", icon: Tag, desc: "New frame only" },
    { value: "new_lens", label: "New Lens", icon: Sun, desc: "New lens in old frame" },
    { value: "contact_lens", label: "Contact Lens", icon: Eye, desc: "Contact lenses" },
    { value: "service", label: "Service/Repair", icon: Clock, desc: "Free visit" },
    { value: "other", label: "Other", icon: Plus, desc: "Select sub-type" },
  ];

  const visitSteps = [
    { key: "type", label: "Visit", icon: Plus },
    { key: "prescription", label: "Prescription", icon: Eye },
    { key: "products", label: "Products", icon: ShoppingCart },
    { key: "billing", label: "Billing & Payment", icon: DollarSign },
    { key: "summary", label: "Summary", icon: CreditCard },
  ];
  const currentStepIdx = visitSteps.findIndex((s) => s.key === visitStep);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary-600 dark:border-primary-400 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="card text-center py-12">
        <AlertCircle size={40} className="mx-auto text-red-400 mb-3" />
        <p className="text-gray-500 dark:text-gray-400">Customer not found</p>
        <button onClick={() => navigate("/customers")} className="btn-primary mt-4">Back to Customers</button>
      </div>
    );
  }

  // ===== DONE SCREEN =====
  if (visitStep === "done" && successData) {
    const bill = successData.bill;
    const order = successData.order;
    const mobile = customer?.mobile || "";
    return (
      <div className="max-w-2xl mx-auto space-y-4 pb-20">
        <div className="card text-center py-8">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Visit Complete!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bill: {bill?.billNumber || ""}</p>
        </div>

        {/* Auto WhatsApp */}
        {mobile && !waSent && waCountdown > 0 && (
          <div className="card text-center py-5 space-y-3 border-primary-200 dark:border-primary-800 border-2">
            <MessageCircle size={28} className="mx-auto text-primary-600 dark:text-primary-400" />
            <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">WhatsApp message will be sent automatically in <span className="text-lg font-bold text-primary-600 dark:text-primary-400">{waCountdown}</span> seconds...</p>
            <button onClick={cancelWaSend} className="btn-secondary text-sm">Cancel</button>
          </div>
        )}
        {mobile && waSending && (
          <div className="card text-center py-5 space-y-3">
            <div className="animate-spin w-8 h-8 border-4 border-primary-600 dark:border-primary-400 border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Sending WhatsApp message...</p>
          </div>
        )}
        {mobile && waSent && (
          <div className="card text-center py-5 space-y-2 border-emerald-200 dark:border-emerald-800 border-2">
            <Check size={24} className="mx-auto text-emerald-600 dark:text-emerald-400" />
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">WhatsApp message sent! ✅</p>
          </div>
        )}
        {mobile && waCancelled && !waSent && !waSending && !waFailed && (
          <div className="card text-center py-5 space-y-2 border-gray-200 dark:border-dark-700 border-2">
            <X size={24} className="mx-auto text-gray-400" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Auto-send cancelled</p>
          </div>
        )}
        {mobile && waFailed && !waSent && !waSending && (
          <div className="card text-center py-5 space-y-2 border-red-200 dark:border-red-800 border-2">
            <AlertCircle size={24} className="mx-auto text-red-400" />
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">Failed to send. WhatsApp may not be connected.</p>
          </div>
        )}

        {/* Summary */}
        <div className="card space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-500 dark:text-gray-400">Customer</p>
              <p className="font-medium">{customer.name}</p>
            </div>
            <div>
              <p className="text-gray-500 dark:text-gray-400">Mobile</p>
              <p className="font-medium">{customer.mobile}</p>
            </div>
            {order?.frame && <div><p className="text-gray-500 dark:text-gray-400">Frame</p><p className="font-medium">{order.frame}</p></div>}
            {order?.lens && <div><p className="text-gray-500 dark:text-gray-400">Lens</p><p className="font-medium">{order.lens}</p></div>}
            {order?.coating && <div><p className="text-gray-500 dark:text-gray-400">Coating</p><p className="font-medium">{order.coating}</p></div>}
            {bill && (
              <>
                <div><p className="text-gray-500 dark:text-gray-400">Total</p><p className="font-bold text-lg">₹{(bill.totalAmount || 0).toFixed(0)}</p></div>
                <div><p className="text-gray-500 dark:text-gray-400">Paid</p><p className="font-medium text-emerald-600">₹{(bill.advancePaid || 0).toFixed(0)}</p></div>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center pt-2">
          <button onClick={() => navigate(`/customers/${id}`)} className="btn-primary flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Profile
          </button>
          {mobile && bill && !waSent && (
            <button onClick={async () => {
              const num = mobile.replace(/\D/g, "");
              if (!num) return;
              const items = (bill.items || []).map((i: any) =>
                `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
              ).join("\n");
              const msg = `*Bill:* ${bill.billNumber || ""}\n*Total:* ₹${(bill.totalAmount || 0).toFixed(0)}\n*Paid:* ₹${(bill.advancePaid || 0).toFixed(0)}\n\n${items}\n\nThank you!`;
              await api.post("/api/whatsapp/send", { phone: `91${num}`, message: msg });
              setWaSent(true);
            }} className="btn-success flex items-center gap-2">
              <MessageCircle size={16} /> Send WhatsApp
            </button>
          )}
        </div>
      </div>
    );
  }

  // ===== MAIN FLOW =====
  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm p-5">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(`/customers/${id}`)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-xl transition-colors">
            <ArrowLeft size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
          <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
            {customer.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">New Visit</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <Phone size={13} /> {customer.name} — {customer.mobile}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
            <span className="px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg font-medium">
              Step {currentStepIdx + 1} of 5
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ===== STEP 1: VISIT TYPE ===== */}
      {visitStep === "type" && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm p-6 space-y-6">
          <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-dark-700">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-xl flex items-center justify-center text-primary-600 dark:text-primary-400">
              <Plus size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">What kind of visit?</h2>
              <p className="text-sm text-gray-500">Select the type of service for {customer.name}.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {visitTypes.map((vt) => {
              const Icon = vt.icon;
              const isActive = visitType === vt.value;
              return (
                <button key={vt.value} type="button" onClick={() => setVisitType(vt.value as any)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-medium transition-all ${
                    isActive
                      ? "border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-sm"
                      : "border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-dark-600"
                  }`}>
                  <Icon size={26} className={isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400"} />
                  <span className="leading-tight text-center font-semibold">{vt.label}</span>
                  <span className="text-[10px] opacity-60">{vt.desc}</span>
                </button>
              );
            })}
          </div>
          <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-5 border border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Visit Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Calendar size={14} className="inline mr-1.5 text-gray-400" />Visit Date
                </label>
                <input type="date" className="input-field text-base" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <User size={14} className="inline mr-1.5 text-gray-400" />Doctor
                </label>
                <input className="input-field text-base" placeholder="Doctor name" value={visitDoctor} onChange={(e) => setVisitDoctor(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

        {/* ===== STEP 2: PRESCRIPTION ===== */}
        {visitStep === "prescription" && (
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100 dark:border-dark-700">
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/40 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400">
                <Eye size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Prescription</h2>
                <p className="text-sm text-gray-500">Previous values pre-filled. Changed fields highlighted.</p>
              </div>
            </div>
            {prevPrescription && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                <Info size={15} /> Changed fields highlighted in amber.
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {(["rightEye", "leftEye"] as const).map((side) => {
                const label = side === "rightEye" ? "Right Eye (OD)" : "Left Eye (OS)";
                const data = prescription[side];
                return (
                  <div key={side} className="bg-gray-50 dark:bg-dark-750 rounded-xl p-5 border border-gray-100 dark:border-dark-700">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-dark-700">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${side === "rightEye" ? "bg-blue-500" : "bg-emerald-500"}`}>
                        {side === "rightEye" ? "R" : "L"}
                      </div>
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{label}</h3>
                    </div>
                    {(["dv", "nv", "pc"] as const).map((type) => (
                      <div key={type} className="mb-4 last:mb-0">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                          {type === "dv" ? "Distance Vision" : type === "nv" ? "Near Vision" : "Peripheral Curve"}
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {(["sph", "cyl", "axis", "va"] as const).map((field) => {
                            const changed = isChanged(side, type, field);
                            const prevVal = getPrevValue(side, type, field);
                            const fieldLabels: Record<string, string> = { sph: "SPH", cyl: "CYL", axis: "AXIS", va: "VA" };
                            return (
                              <div key={field}>
                                <label className="text-[10px] font-medium text-gray-400 dark:text-gray-500 block mb-0.5">{fieldLabels[field]}</label>
                                <input type={field === "va" ? "text" : "number"} step={field === "va" ? undefined : "0.25"}
                                  className={`input-field py-2 text-sm ${changed ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-600" : ""}`}
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
              })}
            </div>
          </div>
        )}

        {/* ===== STEP 3: PRODUCTS ===== */}
        {visitStep === "products" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Products</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Add frame, lens, coating, and accessories.</p>
            </div>
            {visitType === "service" ? (
              <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Service/Repair visit — no products needed.
              </div>
            ) : visitType === "other" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Product Type</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {otherSubTypes.map((st) => (
                      <button key={st} type="button" onClick={() => setOtherSubType(st)}
                        className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${
                          otherSubType === st
                            ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                            : "border-gray-200 dark:border-dark-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-dark-600"
                        }`}>
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
                {otherSubType && (
                  <div className="border-t border-gray-100 dark:border-dark-700 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{otherSubType} Details</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 md:col-span-1">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Product Name</label>
                        <input className="input-field" placeholder="Name" value={orderFrame}
                          onChange={(e) => setOrderFrame(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantity</label>
                        <input type="number" min="1" className="input-field" value={orderQty}
                          onChange={(e) => setOrderQty(Number(e.target.value))} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Price (₹)</label>
                        <input type="number" min="0" step="0.01" className="input-field" placeholder="0" value={orderFramePrice}
                          onChange={(e) => setOrderFramePrice(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                {visitType !== "new_lens" && visitType !== "contact_lens" && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <Tag size={14} /> {visitType === "sunglasses" ? "Sunglasses" : "Frame"}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Brand</label>
                        <input className="input-field" placeholder="Brand" value={orderFrameBrand}
                          onChange={(e) => setOrderFrameBrand(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Model</label>
                        <input className="input-field" placeholder="Model" value={orderFrameModel}
                          onChange={(e) => setOrderFrameModel(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Color</label>
                        <input className="input-field" placeholder="Color" value={orderFrameColor}
                          onChange={(e) => setOrderFrameColor(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Size</label>
                        <input className="input-field" placeholder="52-18" value={orderFrameSize}
                          onChange={(e) => setOrderFrameSize(e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                        <input className="input-field" placeholder="Frame name" value={orderFrame}
                          onChange={(e) => setOrderFrame(e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Price (₹)</label>
                        <input type="number" min="0" step="0.01" className="input-field" placeholder="0" value={orderFramePrice}
                          onChange={(e) => setOrderFramePrice(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )}

                {visitType !== "frame_change" && visitType !== "sunglasses" && (
                  <div className="border-t border-gray-100 dark:border-dark-700 pt-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Eye size={14} /> Lens</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Brand</label>
                        <input className="input-field" placeholder="Brand" value={orderLensBrand}
                          onChange={(e) => setOrderLensBrand(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                        <select className="input-field" value={orderLensType}
                          onChange={(e) => setOrderLensType(e.target.value)}>
                          <option>Single Vision</option><option>Bifocal</option><option>Progressive</option>
                          <option>Blue Cut</option><option>Photochromic</option><option>Polarized</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Index</label>
                        <input className="input-field" placeholder="1.56" value={orderLensIndex}
                          onChange={(e) => setOrderLensIndex(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                        <input className="input-field" placeholder="Lens type" value={orderLens}
                          onChange={(e) => setOrderLens(e.target.value)} />
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Price (₹)</label>
                        <input type="number" min="0" step="0.01" className="input-field" placeholder="0" value={orderLensPrice}
                          onChange={(e) => setOrderLensPrice(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )}

                {visitType !== "frame_change" && visitType !== "sunglasses" && visitType !== "contact_lens" && (
                  <div className="border-t border-gray-100 dark:border-dark-700 pt-5">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Coating</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                        <input className="input-field" placeholder="e.g. Blue Cut AR" value={orderCoating}
                          onChange={(e) => setOrderCoating(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Price (₹)</label>
                        <input type="number" min="0" step="0.01" className="input-field" placeholder="0" value={orderCoatingPrice}
                          onChange={(e) => setOrderCoatingPrice(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>
                )}

                <div className="border-t border-gray-100 dark:border-dark-700 pt-5">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Accessories</h3>
                  {orderAccessories.map((acc, idx) => (
                    <div key={idx} className="flex gap-2 mb-2 items-center">
                      <input className="input-field flex-1" placeholder="Item name" value={acc.name}
                        onChange={(e) => updateAccessory(idx, "name", e.target.value)} />
                      <input type="number" min="0" className="input-field w-24" placeholder="Price" value={acc.price}
                        onChange={(e) => updateAccessory(idx, "price", Number(e.target.value))} />
                      <button onClick={() => removeAccessory(idx)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 dark:text-red-300"><X size={15} /></button>
                    </div>
                  ))}
                  <button onClick={addAccessory}
                    className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
                    <Plus size={14} /> Add Accessory
                  </button>
                </div>

                <div className="border-t border-gray-100 dark:border-dark-700 pt-5 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Quantity</label>
                    <input type="number" min="1" className="input-field" value={orderQty}
                      onChange={(e) => setOrderQty(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expected Delivery</label>
                    <input type="date" className="input-field" value={orderDeliveryDate}
                      onChange={(e) => setOrderDeliveryDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== STEP 4: BILLING (with Payment fields) ===== */}
        {visitStep === "billing" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Billing & Payment</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Items auto-filled from products. Set advance, discount, tax, and collect payment.</p>
            </div>
            <div className="space-y-2">
              {billItems.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-start bg-gray-50 dark:bg-dark-700 p-3 rounded-xl">
                  <div className="flex-1">
                    <input className="input-field text-sm" placeholder="Item description" value={item.description}
                      onChange={(e) => updateBillItem(idx, "description", e.target.value)} />
                  </div>
                  <div className="w-16">
                    <input type="number" min="1" className="input-field text-sm text-center" placeholder="Qty" value={item.qty}
                      onChange={(e) => updateBillItem(idx, "qty", Number(e.target.value))} />
                  </div>
                  <div className="w-24">
                    <input type="number" min="0" step="0.01" className="input-field text-sm text-right" placeholder="Price" value={item.price}
                      onChange={(e) => updateBillItem(idx, "price", Number(e.target.value))} />
                  </div>
                  <div className="w-16 text-right pt-2.5 text-sm font-medium">₹{(item.qty * item.price).toFixed(0)}</div>
                  <button onClick={() => removeBillItem(idx)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400"><X size={16} /></button>
                </div>
              ))}
              <button onClick={addBillItem}
                className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
                <Plus size={16} /> Add Item
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Discount (₹)</label>
                <input type="number" min="0" step="0.01" className="input-field" value={billDiscount}
                  onChange={(e) => setBillDiscount(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tax / GST (₹)</label>
                <input type="number" min="0" step="0.01" className="input-field" value={billTax}
                  onChange={(e) => setBillTax(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Advance Paid (₹)</label>
                <input type="number" min="0" step="0.01" className="input-field" value={advancePaid}
                  onChange={(e) => setAdvancePaid(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Collect Amount (₹)</label>
                <input type="number" min="0" step="0.01" className="input-field" placeholder="0" value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Mode</label>
                <div className="flex gap-2">
                  {["Cash", "UPI", "Card"].map((mode) => (
                    <button key={mode} type="button" onClick={() => setPaymentMode(mode)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        paymentMode === mode
                          ? "bg-primary-600 text-white border-primary-600"
                          : "bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-700"
                      }`}>{mode}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Payment Notes</label>
                <input className="input-field" placeholder="Optional" value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)} />
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Subtotal</span><span>₹{billSubtotal.toFixed(0)}</span></div>
              {billDiscount > 0 && <div className="flex justify-between text-red-600 dark:text-red-400"><span>Discount</span><span>-₹{billDiscount.toFixed(0)}</span></div>}
              {billTax > 0 && <div className="flex justify-between text-amber-600 dark:text-amber-400"><span>Tax</span><span>+₹{billTax.toFixed(0)}</span></div>}
              <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-dark-700">
                <span>Total</span><span>₹{billTotal.toFixed(0)}</span>
              </div>
              {advancePaid > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Advance</span><span>-₹{advancePaid.toFixed(0)}</span></div>}
              <div className="flex justify-between text-primary-600 dark:text-primary-400 font-medium"><span>Collecting</span><span>₹{paymentAmount.toFixed(0)}</span></div>
              {pendingAmt > 0 && <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium"><span>Pending after payment</span><span>₹{Math.max(0, billTotal - advancePaid - paymentAmount).toFixed(0)}</span></div>}
            </div>
          </div>
        )}

        {/* ===== STEP 5: SUMMARY ===== */}
        {visitStep === "summary" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Final Summary</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Review all details before completing the visit.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><User size={14} /> Customer</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{customer.name} — {customer.mobile}</p>
              </div>
              <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><Plus size={14} /> Visit</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{visitDate} {visitDoctor && `| Dr. ${visitDoctor}`}</p>
              </div>
            </div>
            {billItems.some((i) => i.description) && (
              <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><DollarSign size={14} /> Bill</h3>
                <div className="space-y-1">
                  {billItems.filter((i) => i.description).map((i, idx) => (
                    <div key={idx} className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>{i.description} x{i.qty}</span>
                      <span>₹{(i.qty * i.price).toFixed(0)}</span>
                    </div>
                  ))}
                  {(billDiscount > 0 || billTax > 0) && <hr className="border-gray-200 dark:border-dark-600" />}
                  {billDiscount > 0 && <div className="flex justify-between text-sm text-red-600"><span>Discount</span><span>-₹{billDiscount.toFixed(0)}</span></div>}
                  {billTax > 0 && <div className="flex justify-between text-sm text-amber-600"><span>Tax</span><span>+₹{billTax.toFixed(0)}</span></div>}
                  <hr className="border-gray-200 dark:border-dark-600" />
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white"><span>Total</span><span>₹{billTotal.toFixed(0)}</span></div>
                  {advancePaid > 0 && <div className="flex justify-between text-sm text-emerald-600"><span>Advance Paid</span><span>₹{advancePaid.toFixed(0)}</span></div>}
                  <div className="flex justify-between text-sm text-primary-600"><span>Collecting Now</span><span>₹{paymentAmount.toFixed(0)}</span></div>
                </div>
              </div>
            )}
            {paymentAmount > 0 && (
              <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2"><CreditCard size={14} /> Payment</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Mode: {paymentMode} | Amount: ₹{paymentAmount.toFixed(0)}{paymentNotes ? ` | Notes: ${paymentNotes}` : ""}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        {visitStep !== "done" && (
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-200 dark:border-dark-700">
            <div className="flex gap-2">
              {currentStepIdx > 0 && (
                <button onClick={goBack} className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2">
                  <ChevronLeft size={16} /> Back
                </button>
              )}
              <button onClick={() => navigate(`/customers/${id}`)} className="btn-secondary text-sm px-3 py-2">Cancel</button>
            </div>
            <div>
              {currentStepIdx < visitSteps.length - 1 ? (
                <button onClick={goNext} disabled={!canProceed()}
                  className="btn-primary flex items-center gap-1.5 text-sm px-5 py-2">
                  Continue <ChevronRight size={16} />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="btn-success flex items-center gap-2 px-6 py-2.5">
                  {saving ? (
                    <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
                  ) : (
                    <><Save size={16} /> Save & Complete</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

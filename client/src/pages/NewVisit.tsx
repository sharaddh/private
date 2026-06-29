import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PageSkeleton from "../components/PageSkeleton";
import Modal from "../components/Modal";
import CameraScanner from "../components/CameraScanner";
import {
  ArrowLeft, Eye, ShoppingCart, Receipt, CreditCard, Plus, Save, X, MessageCircle,
  AlertCircle, Info, Tag, Sun, ChevronRight, ChevronLeft, Check, Calendar, Phone, User, Clock, FileText,
  QrCode, Search, Camera
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
  interface FrameItem { sku: string; brand: string; model: string; color: string; price: number; }
  interface LensItem { sku: string; brand: string; features: string[]; index: string; price: number; coating: string; }
  const [orderFrames, setOrderFrames] = useState<FrameItem[]>([{ sku: "", brand: "", model: "", color: "", price: 0 }]);
  const [orderLenses, setOrderLenses] = useState<LensItem[]>([{ sku: "", brand: "", features: [], index: "", price: 0, coating: "" }]);
  const [orderAccessories, setOrderAccessories] = useState<{ name: string; price: number }[]>([]);
  const [orderDeliveryDate, setOrderDeliveryDate] = useState("");

  const lensFeatureOptions = ["Single Vision", "Bifocal", "Progressive", "Polycarbonate", "Blue Cut", "Photochromic", "Polarized", "High Index"];

  // Scan Frame
  const [scanModal, setScanModal] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [showCameraScanner, setShowCameraScanner] = useState(false);

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
  const [waQueued, setWaQueued] = useState(false);
  const waTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const billSubtotal = billItems.reduce((s, i) => s + i.qty * i.price, 0);
  const billTotal = billSubtotal - billDiscount;

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
        setOrderFrames([{ sku: last.frame || "", brand: last.frameBrand || "", model: last.frameModel || "", color: last.frameColor || "", price: last.framePrice || 0 }]);
        setOrderLenses([{ sku: last.lens || "", brand: last.lensBrand || "", features: (last.lensType || "").split(", ").filter(Boolean), index: last.lensIndex || "", price: last.lensPrice || 0, coating: last.coating || "" }]);
        if (last.accessories) setOrderAccessories(last.accessories.map((a: any) => typeof a === "string" ? { name: a, price: 0 } : a));

        const items: { description: string; qty: number; price: number }[] = [];
        const lastFrameDesc = last.frame || `${last.frameBrand || ""} ${last.frameModel || ""}`.trim();
        if (lastFrameDesc) items.push({ description: `Frame - ${lastFrameDesc}`, qty: 1, price: last.framePrice || 0 });
        if (last.lens) items.push({ description: `Lens - ${last.lens}`, qty: 1, price: last.lensPrice || 0 });
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
    setWaQueued(false);
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
          if (mediaRes.sent) {
            setWaSent(true);
            setWaSending(false);
            return;
          }
          if (mediaRes.queued) {
            setWaQueued(true);
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
        try {
          const res = await api.post("/api/whatsapp/send", { phone: fullNum, message: msg });
          if (res.queued) { setWaQueued(true); } else { setWaSent(true); }
        } catch { setWaSent(true); }
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

  // Sync payment amount with advance paid
  useEffect(() => {
    setPaymentAmount(advancePaid);
  }, [advancePaid]);

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

  function addFrame() { setOrderFrames((prev) => [...prev, { sku: "", brand: "", model: "", color: "", price: 0 }]); }
  function removeFrame(idx: number) { if (orderFrames.length > 1) setOrderFrames((prev) => prev.filter((_, i) => i !== idx)); }
  function updateFrame(idx: number, field: keyof FrameItem, value: any) {
    setOrderFrames((prev) => prev.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  }

  function addLens() { setOrderLenses((prev) => [...prev, { sku: "", brand: "", features: [], index: "", price: 0, coating: "" }]); }
  function removeLens(idx: number) { if (orderLenses.length > 1) setOrderLenses((prev) => prev.filter((_, i) => i !== idx)); }
  function updateLens(idx: number, field: keyof LensItem, value: any) {
    setOrderLenses((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  }
  function toggleLensFeature(idx: number, feat: string) {
    setOrderLenses((prev) => prev.map((l, i) => i === idx ? { ...l, features: l.features.includes(feat) ? l.features.filter((f) => f !== feat) : [...l.features, feat] } : l));
  }

  function addAccessory() { setOrderAccessories((prev) => [...prev, { name: "", price: 0 }]); }
  function updateAccessory(idx: number, field: "name" | "price", value: string | number) {
    setOrderAccessories((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  }
  function removeAccessory(idx: number) { setOrderAccessories((prev) => prev.filter((_, i) => i !== idx)); }

  async function handleScanFrame(code?: string) {
    const sku = (code || scanInput).trim();
    if (!sku) return;
    const res = await api.get<any>(`/api/inventory/qr/${encodeURIComponent(sku)}`);
    if (res.success && res.data) {
      const item = res.data;
      updateFrame(0, "sku", item.sku || "");
      updateFrame(0, "brand", item.brand || "");
      updateFrame(0, "model", item.model || "");
      updateFrame(0, "color", item.color || "");
      updateFrame(0, "price", item.sellingPrice || item.purchasePrice || 0);
      setScanModal(false);
      setScanInput("");
    }
  }

  function syncBillFromOrder() {
    if (visitType === "service") return;
    const items: { description: string; qty: number; price: number }[] = [];
    if (visitType === "other") {
      orderFrames.filter((f) => f.sku).forEach((f) => items.push({ description: f.sku, qty: 1, price: f.price }));
      orderAccessories.filter((a) => a.name).forEach((a) => items.push({ description: a.name, qty: 1, price: a.price }));
      if (items.length > 0) setBillItems(items);
      return;
    }
    const showFrame = visitType !== "new_lens" && visitType !== "contact_lens";
    if (showFrame) {
      orderFrames.filter((f) => f.sku || f.brand || f.model).forEach((f) => {
        const desc = f.sku || `${f.brand} ${f.model}`.trim();
        items.push({ description: `Frame - ${desc}`, qty: 1, price: f.price });
      });
    }
    const showLens = visitType !== "frame_change";
    if (showLens) {
      orderLenses.filter((l) => l.sku || l.brand || l.features.length > 0 || l.index).forEach((l) => {
        const desc = l.sku || `${l.brand || ""} ${l.features.join(", ") || ""}`.trim() || "Lens";
        items.push({ description: `Lens - ${desc}`, qty: 1, price: l.price });
      });
    }
    orderAccessories.filter((a) => a.name).forEach((a) => {
      if (!items.some((i) => i.description === a.name)) items.push({ description: a.name, qty: 1, price: a.price });
    });
    if (items.length > 0) setBillItems(items);
  }

  function canProceed(): boolean {
    if (visitStep === "type") return !!visitType;
    if (visitStep === "billing" && visitType !== "service") return billItems.some((i) => i.description && i.price > 0);
    return true;
  }

  function goNext() {
    if (visitType === "service") {
      const steps = ["type", "products", "billing", "summary"];
      const idx = steps.indexOf(visitStep);
      if (idx < steps.length - 1 && canProceed()) setVisitStep(steps[idx + 1] as any);
      return;
    }
    const steps = ["type", "prescription", "products", "billing", "summary"];
    if (visitType === "other") {
      if (visitStep === "type") { setVisitStep("products"); return; }
      const idx = steps.indexOf(visitStep);
      if (idx < steps.length - 1 && canProceed()) setVisitStep(steps[idx + 1] as any);
      return;
    }
    const idx = steps.indexOf(visitStep);
    if (idx < steps.length - 1 && canProceed()) setVisitStep(steps[idx + 1] as any);
  }

  function goBack() {
    if (visitType === "other" && visitStep === "products") { setVisitStep("type"); return; }
    if (visitType === "service") {
      const steps = ["type", "products", "billing", "summary"];
      const idx = steps.indexOf(visitStep);
      if (idx > 0) setVisitStep(steps[idx - 1] as any);
      return;
    }
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
        const firstFrame = orderFrames[0] || { sku: "", brand: "", model: "", color: "", price: 0 };
        const firstLens = orderLenses[0] || { sku: "", brand: "", features: [], index: "", price: 0, coating: "" };
        payload.order = {
          frame: firstFrame.sku || undefined, frameBrand: firstFrame.brand || undefined,
          frameModel: firstFrame.model || undefined, frameColor: firstFrame.color || undefined,
          framePrice: firstFrame.price || 0,
          lens: firstLens.sku || undefined, lensBrand: firstLens.brand || undefined,
          lensType: firstLens.features.join(", ") || undefined, lensIndex: firstLens.index || undefined,
          lensPrice: firstLens.price || 0,
          coating: firstLens.coating || undefined,
          accessories: orderAccessories.map((a) => a.name),
          deliveryDate: orderDeliveryDate || undefined,
        };
        if (visitType === "frame_change") {
          delete payload.order.lens; delete payload.order.lensBrand;
          delete payload.order.lensType; delete payload.order.lensIndex; delete payload.order.lensPrice;
          delete payload.order.coating;
        }
        if (visitType === "new_lens") {
          delete payload.order.frame; delete payload.order.frameBrand;
          delete payload.order.frameModel; delete payload.order.frameColor;
          delete payload.order.framePrice;
        }
        if (visitType === "contact_lens") {
          delete payload.order.frame; delete payload.order.frameBrand;
          delete payload.order.frameModel; delete payload.order.frameColor;
          delete payload.order.framePrice;
          delete payload.order.coating;
        }
        if (visitType === "other") {
          delete payload.order.frameBrand; delete payload.order.frameModel;
          delete payload.order.frameColor;
          delete payload.order.lens; delete payload.order.lensBrand;
          delete payload.order.lensType; delete payload.order.lensIndex; delete payload.order.lensPrice;
          delete payload.order.coating;
        }
      }

      const validItems = billItems.filter((i) => i.description && i.price > 0);
      if (validItems.length > 0) {
        payload.bill = {
          items: validItems.map((i) => ({ description: i.description, quantity: i.qty, unitPrice: i.price })),
          discount: billDiscount || 0, advancePaid: paymentAmount > 0 ? 0 : advancePaid || 0,
        };
      }

      if (paymentAmount > 0) {
        const visitNote = `Payment from visit - ₹${paymentAmount}`;
        payload.payment = { amount: paymentAmount, paymentMode, notes: paymentNotes ? `${paymentNotes} | ${visitNote}` : visitNote };
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

  const allSteps = [
    { key: "type", label: "Visit", icon: Plus },
    { key: "prescription", label: "Prescription", icon: Eye },
    { key: "products", label: "Products", icon: ShoppingCart },
    { key: "billing", label: "Billing & Payment", icon: Receipt },
    { key: "summary", label: "Summary", icon: CreditCard },
  ];
  const visitSteps = (visitType === "service" || visitType === "other")
    ? allSteps.filter(s => s.key !== "prescription")
    : allSteps;
  const currentStepIdx = visitSteps.findIndex((s) => s.key === visitStep);

  if (loading) return <PageSkeleton page="newvisit" />;

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
        {mobile && waQueued && !waSent && !waSending && !waFailed && (
          <div className="card text-center py-5 space-y-2 border-amber-200 dark:border-amber-800 border-2">
            <Clock size={24} className="mx-auto text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">WhatsApp not connected — message queued. Will send automatically when connected.</p>
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
        </div>
        {/* Step pills */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-dark-700 overflow-x-auto">
          {visitSteps.map((s, i) => {
            const Icon = s.icon;
            const isActive = visitStep === s.key;
            const isPast = currentStepIdx > i;
            return (
              <div key={s.key}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${isActive
                    ? "bg-primary-600 text-white shadow-md scale-105"
                    : isPast
                      ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                      : "bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-gray-500"
                  }`}>
                {isPast ? <Check size={14} /> : <Icon size={14} />}
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ===== STEP 1: VISIT TYPE ===== */}
      {visitStep === "type" && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-soft-lg p-7 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-dark-700">
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/40 rounded-2xl flex items-center justify-center text-primary-600 dark:text-primary-400 shadow-sm">
              <Plus size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">What kind of visit?</h2>
              <p className="text-sm text-gray-500">Select the type of service for <span className="font-semibold text-gray-700 dark:text-gray-300">{customer.name}</span>.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {visitTypes.map((vt) => {
              const Icon = vt.icon;
              const isActive = visitType === vt.value;
              return (
                <button key={vt.value} type="button" onClick={() => setVisitType(vt.value as any)}
                  className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-[0.97] ${isActive
                      ? "border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 shadow-md"
                      : "border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-dark-600 hover:shadow-sm"
                    }`}>
                  <Icon size={28} className={isActive ? "text-primary-600 dark:text-primary-400" : "text-gray-400"} />
                  <span className="leading-tight text-center font-semibold">{vt.label}</span>
                  <span className="text-[10px] opacity-70">{vt.desc}</span>
                </button>
              );
            })}
          </div>
          <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-6 border border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-2.5 mb-5">
              <Calendar size={18} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Visit Details</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <Calendar size={14} className="inline mr-1.5 text-gray-400" />Visit Date
                </label>
                <input type="date" className="input-field text-base py-2.5" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  <User size={14} className="inline mr-1.5 text-gray-400" />Doctor
                </label>
                <input className="input-field text-base py-2.5" placeholder="Doctor name" value={visitDoctor} onChange={(e) => setVisitDoctor(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP 2: PRESCRIPTION ===== */}
      {visitStep === "prescription" && (
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-soft-lg p-7 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-dark-700">
            <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-2xl flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
              <Eye size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Prescription</h2>
              <p className="text-sm text-gray-500">Previous values pre-filled. Changed fields highlighted.</p>
            </div>
          </div>
          {prevPrescription && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
              <Info size={16} /> Changed fields highlighted in amber.
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {(["rightEye", "leftEye"] as const).map((side) => {
              const label = side === "rightEye" ? "Right Eye (OD)" : "Left Eye (OS)";
              const data = prescription[side];
              return (
                <div key={side} className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-6 border border-gray-100 dark:border-dark-700">
                  <div className="flex items-center gap-3 mb-5 pb-3 border-b border-gray-200 dark:border-dark-700">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-sm ${side === "rightEye" ? "bg-blue-500" : "bg-emerald-500"}`}>
                      {side === "rightEye" ? "R" : "L"}
                    </div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">{label}</h3>
                  </div>
                  {(["dv", "nv", "pc"] as const).map((type) => (
                    <div key={type} className="mb-5 last:mb-0">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                        {type === "dv" ? "Distance Vision" : type === "nv" ? "Near Vision" : "Peripheral Curve"}
                      </p>
                      <div className="grid grid-cols-4 gap-3">
                        {(["sph", "cyl", "axis", "va"] as const).map((field) => {
                          const changed = isChanged(side, type, field);
                          const prevVal = getPrevValue(side, type, field);
                          const fieldLabels: Record<string, string> = { sph: "SPH", cyl: "CYL", axis: "AXIS", va: "VA" };
                          return (
                            <div key={field}>
                              <label className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 block mb-1">{fieldLabels[field]}</label>
                              <input type={field === "va" ? "text" : "number"} step={field === "va" ? undefined : "0.25"}
                                className={`input-field py-2.5 text-sm ${changed ? "border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300 dark:ring-amber-600" : ""}`}
                                value={data[type]?.[field] ?? ""}
                                onFocus={(e) => e.target.select()}
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
        <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-soft-lg p-7 space-y-6">
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-dark-700">
            <div className="w-12 h-12 bg-violet-100 dark:bg-violet-900/40 rounded-2xl flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-sm">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Products</h2>
              <p className="text-sm text-gray-500">Add frame, lens, coating, and accessories.</p>
            </div>
          </div>
          {visitType === "service" ? (
            <div className="space-y-5">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-5 py-3 flex items-start gap-3 text-sm text-amber-700 dark:text-amber-300">
                <Clock size={18} className="flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Service / Repair</p>
                  <p className="text-xs mt-0.5 opacity-80">Free service — add chargeable items below if applicable, or leave empty for a free visit.</p>
                </div>
              </div>
                <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-6 border border-gray-100 dark:border-dark-700">
                  <div className="flex items-center gap-2.5 mb-3">
                    <Tag size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Service Items</h3>
                  </div>
                  <div className="space-y-3">
                    {billItems.map((item, idx) => (
                      <div key={idx} className="flex gap-3 items-start bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-200 dark:border-dark-700">
                        <div className="flex-1">
                          <input className="input-field text-sm py-2.5" placeholder="Service description (e.g. Frame adjustment)" value={item.description}
                            onChange={(e) => updateBillItem(idx, "description", e.target.value)} />
                        </div>
                        <div className="w-20">
                          <input type="number" min="1" className="input-field text-sm text-center py-2.5" placeholder="Qty" value={item.qty}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateBillItem(idx, "qty", Number(e.target.value))} />
                        </div>
                        <div className="w-28">
                          <input type="number" min="0" step="0.01" className="input-field text-sm text-right py-2.5" placeholder="Price" value={item.price}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateBillItem(idx, "price", Number(e.target.value))} />
                        </div>
                        <div className="w-20 text-right pt-3 text-sm font-semibold">₹{(item.qty * item.price).toFixed(0)}</div>
                        <button onClick={() => removeBillItem(idx)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-400"><X size={16} /></button>
                      </div>
                    ))}
                    <button onClick={addBillItem}
                      className="flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 px-1 py-1">
                      <Plus size={16} /> Add Service Item
                    </button>
                  </div>
                </div>
            </div>
          ) : visitType === "other" ? (
            <div className="space-y-5">
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-5 border border-gray-100 dark:border-dark-700">
                <div className="flex items-center gap-2 mb-3">
                  <Tag size={15} className="text-gray-400" />
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Product Type</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {otherSubTypes.map((st) => (
                    <button key={st} type="button" onClick={() => setOtherSubType(st)}
                      className={`py-2.5 px-3 rounded-xl text-sm font-medium border transition-all ${otherSubType === st
                          ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                          : "border-gray-200 dark:border-dark-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-dark-600"
                        }`}>
                      {st}
                    </button>
                  ))}
                </div>
              </div>
              {otherSubType && (
                <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-5 border border-gray-100 dark:border-dark-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{otherSubType} Details</h3>
                  {orderFrames.map((f, idx) => (
                    <div key={idx} className="flex gap-3 mb-2 items-start">
                      <input className="input-field flex-1 text-base" placeholder="Product name" value={f.sku}
                        onChange={(e) => updateFrame(idx, "sku", e.target.value)} />
                      <input type="number" min="0" step="0.01" className="input-field w-28 text-base" placeholder="Price" value={f.price}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateFrame(idx, "price", Number(e.target.value))} />
                      {orderFrames.length > 1 && (
                        <button onClick={() => removeFrame(idx)} className="p-2 mt-0.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400"><X size={15} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={addFrame} className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 font-medium mt-1">
                    <Plus size={14} /> Add Item
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visitType !== "new_lens" && visitType !== "contact_lens" && (
                    <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-6 border border-gray-100 dark:border-dark-700">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-dark-700">
                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                          <Tag size={20} />
                        </div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Frame</h3>
                      <button type="button" onClick={() => { setScanModal(true); setScanInput(""); }}
                        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                        <QrCode size={14} /> Scan
                      </button>
                      <button type="button" onClick={() => setShowCameraScanner(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg text-xs font-medium hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors">
                        <Camera size={14} /> Camera
                      </button>
                    </div>
                    <div className="space-y-4">
                      {orderFrames.map((f, idx) => (
                          <div key={idx} className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-200 dark:border-dark-700 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Frame #{idx + 1}</span>
                            {orderFrames.length > 1 && (
                              <button onClick={() => removeFrame(idx)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400"><X size={14} /></button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><Tag size={12} className="inline mr-1 text-gray-400" />Brand</label>
                              <input className="input-field text-base" placeholder="Brand" value={f.brand}
                                onChange={(e) => updateFrame(idx, "brand", e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><Eye size={12} className="inline mr-1 text-gray-400" />Model</label>
                              <input className="input-field text-base" placeholder="Model" value={f.model}
                                onChange={(e) => updateFrame(idx, "model", e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><Sun size={12} className="inline mr-1 text-gray-400" />Color</label>
                              <input className="input-field text-base" placeholder="Color" value={f.color}
                                onChange={(e) => updateFrame(idx, "color", e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><span style={{ fontFamily: "initial" }}>₹</span> Price</label>
                              <input type="number" min="0" step="0.01" className="input-field text-base" placeholder="0" value={f.price}
                                onFocus={(e) => e.target.select()}
                                onChange={(e) => updateFrame(idx, "price", Number(e.target.value))} />
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><QrCode size={12} className="inline mr-1 text-gray-400" />SKU / Description</label>
                              <input className="input-field text-base" placeholder="Frame name or SKU" value={f.sku}
                                onChange={(e) => updateFrame(idx, "sku", e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button onClick={addFrame} className="mt-3 flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium">
                      <Plus size={14} /> Add Another Frame
                    </button>
                  </div>
                )}

                  {visitType !== "frame_change" && (
                    <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-6 border border-gray-100 dark:border-dark-700">
                      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200 dark:border-dark-700">
                        <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/40 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-sm">
                          <Eye size={20} />
                        </div>
                        <h3 className="text-base font-bold text-gray-900 dark:text-white">Lens</h3>
                      </div>
                    <div className="space-y-4">
                      {orderLenses.map((l, idx) => (
                          <div key={idx} className="bg-white dark:bg-dark-800 rounded-2xl p-5 border border-gray-200 dark:border-dark-700 shadow-sm">
                            <div className="flex items-center justify-between mb-4">
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Lens #{idx + 1}</span>
                            {orderLenses.length > 1 && (
                              <button onClick={() => removeLens(idx)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400"><X size={14} /></button>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><Tag size={12} className="inline mr-1 text-gray-400" />Brand</label>
                              <input className="input-field text-base" placeholder="Brand" value={l.brand}
                                onChange={(e) => updateLens(idx, "brand", e.target.value)} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><span style={{ fontFamily: "initial" }}>#</span> Index</label>
                              <input className="input-field text-base" placeholder="1.56" value={l.index}
                                onChange={(e) => updateLens(idx, "index", e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                  <span style={{ fontFamily: "initial" }}>✦</span> Coating / Add-on
                                </label>
                                <input className="input-field text-base" placeholder="e.g. AR, Blue Cut, UV" value={l.coating}
                                  onChange={(e) => updateLens(idx, "coating", e.target.value)} />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><span style={{ fontFamily: "initial" }}>₹</span> Price</label>
                                <input type="number" min="0" step="0.01" className="input-field text-base" placeholder="0" value={l.price}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateLens(idx, "price", Number(e.target.value))} />
                              </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><Eye size={12} className="inline mr-1 text-gray-400" />Description</label>
                              <input className="input-field text-base" placeholder="Lens description" value={l.sku}
                                onChange={(e) => updateLens(idx, "sku", e.target.value)} />
                            </div>
                          </div>
                          <div className="mb-4">
                            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2"><span style={{ fontFamily: "initial" }}>◆</span> Features</label>
                            <div className="flex flex-wrap gap-2">
                              {lensFeatureOptions.map((feat) => {
                                const selected = l.features.includes(feat);
                                return (
                                  <button key={feat} type="button" onClick={() => toggleLensFeature(idx, feat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selected
                                        ? "bg-sky-100 dark:bg-sky-900/40 border-sky-400 dark:border-sky-600 text-sky-700 dark:text-sky-300"
                                        : "bg-white dark:bg-dark-800 border-gray-200 dark:border-dark-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                                      }`}>
                                    {feat}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                    <button onClick={addLens} className="mt-3 flex items-center gap-1.5 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 font-medium">
                      <Plus size={14} /> Add Another Lens
                    </button>
                  </div>
                )}
              </div>

                <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-6 border border-gray-100 dark:border-dark-700">
                  <div className="flex items-center gap-2.5 mb-4">
                    <Plus size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Accessories</h3>
                  </div>
                  {orderAccessories.map((acc, idx) => (
                    <div key={idx} className="flex gap-3 mb-3 items-center">
                      <input className="input-field flex-1 text-base py-2.5" placeholder="Item name" value={acc.name}
                        onChange={(e) => updateAccessory(idx, "name", e.target.value)} />
                      <input type="number" min="0" className="input-field w-28 text-base py-2.5" placeholder="Price" value={acc.price}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateAccessory(idx, "price", Number(e.target.value))} />
                      <button onClick={() => removeAccessory(idx)}
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-400 dark:text-red-300"><X size={16} /></button>
                    </div>
                  ))}
                  <button onClick={addAccessory}
                    className="flex items-center gap-1.5 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 mt-1">
                    <Plus size={14} /> Add Accessory
                  </button>
                </div>

                <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-6 border border-gray-100 dark:border-dark-700">
                  <div className="flex items-center gap-2.5 mb-4">
                    <Calendar size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Delivery</h3>
                  </div>
                <div className="max-w-xs">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Expected Delivery Date</label>
                  <input type="date" className="input-field text-base" value={orderDeliveryDate}
                    onChange={(e) => setOrderDeliveryDate(e.target.value)} />
                  <div className="flex gap-1.5 mt-1.5">
                    {[
                      { label: "Today", days: 0 },
                      { label: "Tomorrow", days: 1 },
                      { label: "3 Days", days: 3 },
                      { label: "5 Days", days: 5 },
                      { label: "7 Days", days: 7 },
                    ].map((s) => {
                      const d = new Date();
                      d.setDate(d.getDate() + s.days);
                      const dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
                      const active = orderDeliveryDate === dateStr;
                      return (
                        <button key={s.label} type="button" onClick={() => setOrderDeliveryDate(dateStr)}
                          className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${active ? "bg-primary-600 text-white shadow-sm" : "bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600"
                            }`}>
                          {s.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scan Frame Modal */}
      <Modal open={scanModal} onClose={() => setScanModal(false)} title="Scan Frame" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Point your scanner at the QR code or type the SKU below.</p>
          <div className="flex gap-2">
            <input className="input-field flex-1 text-lg tracking-wider font-mono" placeholder="Scan or type SKU..." value={scanInput}
              onChange={(e) => setScanInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScanFrame(); } }}
              autoFocus />
            <button onClick={() => { setScanModal(false); setShowCameraScanner(true); }} className="btn-secondary flex items-center gap-1.5" title="Use camera">
              <Camera size={16} />
            </button>
            <button onClick={() => handleScanFrame()} className="btn-primary flex items-center gap-1.5 px-4">
              <Search size={16} /> Find
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">Scanner devices auto-submit on scan. You can also type the SKU and press Enter.</p>
        </div>
      </Modal>

      {showCameraScanner && (
        <CameraScanner
          onScan={(code) => {
            setShowCameraScanner(false);
            handleScanFrame(code);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}

        {/* ===== STEP 4: BILLING (with Payment fields) ===== */}
        {visitStep === "billing" && (
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-soft-lg p-7 space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-dark-700">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                <Receipt size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Billing & Payment</h2>
                <p className="text-sm text-gray-500">Items auto-filled from products. Set discount, advance, and collect payment.</p>
              </div>
            </div>
          <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-6 border border-gray-100 dark:border-dark-700">
            <div className="flex items-center gap-2.5 mb-4">
              <ShoppingCart size={16} className="text-gray-400" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Bill Items</h3>
              <button onClick={syncBillFromOrder} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors">
                <Plus size={12} /> Refresh from Products
              </button>
            </div>
            <div className="space-y-3">
              {billItems.map((item, idx) => (
                <div key={idx} className="flex gap-3 items-start bg-white dark:bg-dark-800 p-4 rounded-2xl border border-gray-200 dark:border-dark-700">
                  <div className="flex-1">
                    <input className="input-field text-sm py-2.5" placeholder="Item description" value={item.description}
                      onChange={(e) => updateBillItem(idx, "description", e.target.value)} />
                  </div>
                  <div className="w-20">
                    <input type="number" min="1" className="input-field text-sm text-center py-2.5" placeholder="Qty" value={item.qty}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateBillItem(idx, "qty", Number(e.target.value))} />
                  </div>
                  <div className="w-28">
                    <input type="number" min="0" step="0.01" className="input-field text-sm text-right py-2.5" placeholder="Price" value={item.price}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => updateBillItem(idx, "price", Number(e.target.value))} />
                  </div>
                  <div className="w-20 text-right pt-3 text-sm font-semibold">₹{(item.qty * item.price).toFixed(0)}</div>
                  <button onClick={() => removeBillItem(idx)}
                    className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-400"><X size={16} /></button>
                </div>
              ))}
              <button onClick={addBillItem}
                className="flex items-center gap-2 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 px-1 py-1">
                <Plus size={16} /> Add Item
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-5 border border-gray-100 dark:border-dark-700">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <span style={{ fontFamily: "initial" }}>₹</span> Discount
              </label>
              <input type="number" min="0" step="0.01" className="input-field text-base py-2.5" value={billDiscount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setBillDiscount(Number(e.target.value))} />
            </div>
            <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-5 border border-gray-100 dark:border-dark-700">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <CreditCard size={14} className="text-gray-400" /> Advance Paid
              </label>
              <input type="number" min="0" step="0.01" className="input-field text-base py-2.5" value={advancePaid}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setAdvancePaid(Number(e.target.value))} />
            </div>
            <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-5 border border-gray-100 dark:border-dark-700">
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                <ShoppingCart size={14} className="text-gray-400" /> Payment Mode
              </label>
              <div className="flex gap-2">
                {["Cash", "UPI", "Card"].map((mode) => (
                  <button key={mode} type="button" onClick={() => setPaymentMode(mode)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all ${paymentMode === mode
                        ? "bg-primary-600 text-white border-primary-600 shadow-sm"
                        : "bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-700 hover:border-gray-300 dark:hover:border-dark-600"
                      }`}>{mode}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-gray-50 to-white dark:from-dark-750 dark:to-dark-800 rounded-2xl p-6 border border-gray-200 dark:border-dark-700">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Payment Summary</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal</span><span className="font-semibold">₹{billSubtotal.toFixed(0)}</span>
              </div>
              {billDiscount > 0 && <div className="flex justify-between text-red-600 dark:text-red-400">
                <span>Discount</span><span className="font-semibold">-₹{billDiscount.toFixed(0)}</span>
              </div>}
              <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-3 border-t-2 border-gray-300 dark:border-dark-600">
                <span>Total</span><span>₹{billTotal.toFixed(0)}</span>
              </div>
              {advancePaid > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Advance Paid</span><span className="font-semibold">-₹{advancePaid.toFixed(0)}</span>
              </div>}
              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold pt-2 border-t border-dashed border-gray-200 dark:border-dark-700">
                <span>Remaining Balance</span>
                <span>₹{Math.max(0, billTotal - advancePaid).toFixed(0)}</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-5 border border-gray-100 dark:border-dark-700">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
              <FileText size={14} className="text-gray-400" /> Payment Notes (optional)
            </label>
            <input className="input-field text-base py-2.5" placeholder="Any notes about this payment" value={paymentNotes}
              onChange={(e) => setPaymentNotes(e.target.value)} />
          </div>
        </div>
      )}

        {/* ===== STEP 5: SUMMARY ===== */}
        {visitStep === "summary" && (
          <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-soft-lg p-7 space-y-6">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-dark-700">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/40 rounded-2xl flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-sm">
                <Check size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Final Summary</h2>
                <p className="text-sm text-gray-500">Review all details before completing the visit.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-5 border border-gray-100 dark:border-dark-700">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2 mb-2"><User size={15} className="text-gray-400" /> Customer</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{customer.name} — {customer.mobile}</p>
              </div>
              <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-5 border border-gray-100 dark:border-dark-700">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2 mb-2"><Calendar size={15} className="text-gray-400" /> Visit</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{visitDate} {visitDoctor && `| Dr. ${visitDoctor}`}</p>
              </div>
            </div>
            {billItems.some((i) => i.description) && (
              <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-5 border border-gray-100 dark:border-dark-700">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2 mb-3"><Receipt size={15} className="text-gray-400" /> Bill</h3>
                <div className="space-y-2">
                  {billItems.filter((i) => i.description).map((i, idx) => (
                    <div key={idx} className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                      <span>{i.description} x{i.qty}</span>
                      <span>₹{(i.qty * i.price).toFixed(0)}</span>
                    </div>
                  ))}
                  {billDiscount > 0 && <hr className="border-gray-200 dark:border-dark-600" />}
                  {billDiscount > 0 && <div className="flex justify-between text-sm text-red-600 font-medium"><span>Discount</span><span>-₹{billDiscount.toFixed(0)}</span></div>}
                  <hr className="border-gray-300 dark:border-dark-600" />
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base"><span>Total</span><span>₹{billTotal.toFixed(0)}</span></div>
                  {advancePaid > 0 && <div className="flex justify-between text-sm text-emerald-600 font-semibold"><span>Advance Paid</span><span>₹{advancePaid.toFixed(0)}</span></div>}
                  <div className="flex justify-between text-sm text-amber-600 font-bold"><span>Remaining Balance</span><span>₹{Math.max(0, billTotal - advancePaid).toFixed(0)}</span></div>
                </div>
              </div>
            )}
            {paymentAmount > 0 && (
              <div className="bg-gray-50 dark:bg-dark-750 rounded-2xl p-5 border border-gray-100 dark:border-dark-700">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2 mb-2"><CreditCard size={15} className="text-gray-400" /> Payment</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">Mode: <span className="font-semibold">{paymentMode}</span> | Amount: <span className="font-semibold">₹{paymentAmount.toFixed(0)}</span>{paymentNotes ? ` | Notes: ${paymentNotes}` : ""}</p>
              </div>
            )}
        </div>
      )}

        {/* Navigation */}
        {visitStep !== "done" && (
          <div className="flex items-center justify-between pt-6 mt-6 border-t border-gray-200 dark:border-dark-700">
            <div className="flex gap-3">
              {currentStepIdx > 0 && (
                <button onClick={goBack} className="btn-secondary gap-2 px-6 py-3 text-base font-semibold">
                  <ChevronLeft size={18} /> Back
                </button>
              )}
              <button onClick={() => navigate(`/customers/${id}`)} className="btn-secondary px-5 py-3 text-base font-semibold">Cancel</button>
            </div>
            <div>
              {currentStepIdx < visitSteps.length - 1 ? (
                <button onClick={goNext} disabled={!canProceed()}
                  className="btn-primary gap-2 px-7 py-3 text-base font-semibold shadow-soft-lg">
                  Continue <ChevronRight size={18} />
                </button>
              ) : (
                <button onClick={handleSave} disabled={saving}
                  className="btn-success gap-2 px-8 py-3.5 text-base font-semibold shadow-soft-lg">
                  {saving ? (
                    <><div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
                  ) : (
                    <><Save size={18} /> Save & Complete</>
                  )}
                </button>
              )}
            </div>
          </div>
        )}
    </div>
  );
}

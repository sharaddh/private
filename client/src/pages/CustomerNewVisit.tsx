import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import { useToast } from "../context/ToastContext";
import PageSkeleton from "../components/PageSkeleton";
import Modal from "../components/Modal";
import CameraScanner from "../components/CameraScanner";
import {
  ArrowLeft, User, Eye, ShoppingCart, CreditCard, CheckCircle,
  ChevronLeft, ChevronRight, Save, Plus, Trash2, Calendar, X,
  Camera, Activity, Search, Clock, FileText, AlertCircle,
  RefreshCw, Maximize2, Circle, Wrench, Percent, MessageCircle,
  Tag, Grid3X3, ScanLine, FileCheck, Truck
} from "lucide-react";

function cleanEyeSet(e: any) {
  if (!e || typeof e !== "object") return undefined;
  const out: any = {};
  for (const k of ["dv", "nv", "pc"]) {
    if (e[k] && typeof e[k] === "object") {
      const vals = Object.entries(e[k]).filter(([_, v]) => v);
      if (vals.length) out[k] = Object.fromEntries(vals);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

const VISIT_TYPES = [
  { value: "new", label: "New Glasses", icon: Eye },
  { value: "frame_change", label: "Frame Change", icon: RefreshCw },
  { value: "new_lens", label: "New Lens", icon: Maximize2 },
  { value: "contact_lens", label: "Contact Lens", icon: Circle },
  { value: "service", label: "Service", icon: Wrench },
  { value: "other", label: "Other", icon: Grid3X3 },
];

const steps = [
  { key: "service", label: "Service", icon: Activity, desc: "Visit type" },
  { key: "prescription", label: "Examination", icon: Eye, desc: "Vision test" },
  { key: "order", label: "Order", icon: ShoppingCart, desc: "Frame & lens" },
  { key: "billing", label: "Billing", icon: CreditCard, desc: "Items & pricing" },
  { key: "payment", label: "Payment", icon: Percent, desc: "Collect & confirm" },
  { key: "confirmation", label: "Confirm", icon: CheckCircle, desc: "Review & save" },
];

function EyeRow({ label, data, onChange }: { label: string; data: any; onChange: (v: any) => void }) {
  const fields = ["sph", "cyl", "axis", "va", "add"];
  return (
    <div className="text-xs">
      <span className="font-medium text-gray-700 dark:text-gray-300 block mb-1">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <input key={f} placeholder={f.toUpperCase()} value={data?.[f] || ""}
            onChange={(e) => onChange({ ...data, [f]: e.target.value })}
            className="w-14 text-center border border-gray-200 dark:border-dark-600 bg-gray-50 dark:bg-dark-750 rounded-lg py-1 text-xs text-gray-900 dark:text-gray-200 placeholder-gray-400" />
        ))}
      </div>
    </div>
  );
}

export default function CustomerNewVisit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [customer, setCustomer] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState("service");

  const [visitType, setVisitType] = useState("new");
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [visitDoctor, setVisitDoctor] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");

  const [usePrescription, setUsePrescription] = useState(false);
  const [prescription, setPrescription] = useState({
    rightEye: { dv: {}, nv: {}, pc: {} },
    leftEye: { dv: {}, nv: {}, pc: {} },
    pd: "", notes: "", problems: "",
  });

  const [orderFrames, setOrderFrames] = useState<Array<{ sku: string; brand: string; model: string; color: string; price: number }>>([]);
  const [orderLenses, setOrderLenses] = useState<Array<{ sku: string; brand: string; features: string[]; index: string; price: number; coating: string }>>([]);
  const [orderAccessories, setOrderAccessories] = useState<Array<{ name: string; price: number }>>([]);

  const [billItems, setBillItems] = useState<Array<{ description: string; price: number; qty: number }>>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsFor, setSuggestionsFor] = useState<{ type: "frame"; idx: number } | null>(null);
  const [searchTimer, setSearchTimer] = useState<any>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [scanModal, setScanModal] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [custRes, visitsRes, prescRes, ordersRes, settingsRes] = await Promise.all([
        api.get<any>(`/api/customers/${id}`),
        api.get<any[]>(`/api/visits?customerId=${id}`),
        api.get<any[]>(`/api/prescriptions?customerId=${id}`),
        api.get<any[]>(`/api/orders?customerId=${id}`),
        api.get("/api/settings"),
      ]);
      if (custRes.success) {
        setCustomer(custRes.data);
        if (visitsRes.success && visitsRes.data.length > 0) {
          const last = visitsRes.data[0];
          setVisitDate(last.visitDate ? last.visitDate.split("T")[0] : new Date().toISOString().split("T")[0]);
          setVisitDoctor(last.doctorName || "");
          setVisitRemarks(last.remarks || "");
        }
        if (prescRes.success && prescRes.data.length > 0) {
          const prev = prescRes.data[0];
          setPrescription({
            rightEye: prev.rightEye || { dv: {}, nv: {}, pc: {} },
            leftEye: prev.leftEye || { dv: {}, nv: {}, pc: {} },
            pd: prev.pd || "", notes: prev.notes || "", problems: prev.problems || "",
          });
          setUsePrescription(true);
        }
        if (ordersRes.success && ordersRes.data.length > 0) {
          const last = ordersRes.data[0];
          if (last.frame) {
            setOrderFrames([{ sku: last.frame || "", brand: last.frameBrand || "", model: last.frameModel || "", color: last.frameColor || "", price: last.framePrice || 0 }]);
          }
          if (last.lens) {
            setOrderLenses([{ sku: last.lens || "", brand: last.lensBrand || "", features: last.lensType ? last.lensType.split(", ") : [], index: last.lensIndex || "", price: last.lensPrice || 0, coating: last.coating || "" }]);
          }
          if (last.accessories?.length > 0) {
            setOrderAccessories(last.accessories.map((n: string) => ({ name: n, price: 0 })));
          }
        }
      }
      if (settingsRes.success) setSettings(settingsRes.data);
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    const total = billItems.reduce((s, i) => s + i.price * i.qty, 0);
    setTotalAmount(total);
  }, [billItems]);

  const countdownRef = useRef<any>(null);
  const savingRef = useRef(false);
  const greetingSent = useRef(false);

  function setRight(k: string, v: any) { setPrescription((p) => ({ ...p, rightEye: { ...p.rightEye, [k]: v } })); }
  function setLeft(k: string, v: any) { setPrescription((p) => ({ ...p, leftEye: { ...p.leftEye, [k]: v } })); }

  function updateFrame(i: number, field: string, value: any) {
    setOrderFrames((prev) => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f));
  }

  function removeFrame(i: number) {
    setOrderFrames((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateLens(i: number, field: string, value: any) {
    setOrderLenses((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function removeLens(i: number) {
    setOrderLenses((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateAccessory(i: number, field: string, value: any) {
    setOrderAccessories((prev) => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  }

  function removeAccessory(i: number) {
    setOrderAccessories((prev) => prev.filter((_, idx) => idx !== i));
  }

  function syncBillFromOrder(frames: typeof orderFrames, lenses: typeof orderLenses, accessories: typeof orderAccessories) {
    const items: Array<{ description: string; price: number; qty: number }> = [];
    frames.forEach((f) => {
      if (f.brand || f.price) items.push({ description: `Frame - ${f.brand} ${f.model}`.trim(), price: f.price, qty: 1 });
    });
    lenses.forEach((l) => {
      if (l.brand || l.price) items.push({ description: `Lens - ${l.brand} ${l.features.join(" ")}`.trim(), price: l.price, qty: 1 });
    });
    accessories.forEach((a) => {
      if (a.name || a.price) items.push({ description: a.name, price: a.price, qty: 1 });
    });
    setBillItems(items.length > 0 ? items : []);
  }

  function updateBillItem(i: number, field: string, value: any) {
    setBillItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  }

  function removeBillItem(i: number) {
    setBillItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  function calcDiscount() {
    if (discountType === "percent") return (totalAmount * discountPercent) / 100;
    return discountAmount;
  }

  async function saveTransaction() {
    if (savingRef.current) return;
    setSaving(true);
    try {
      const payload: any = { customerId: id };

      if (usePrescription || visitDoctor || visitRemarks || visitDate) {
        payload.visit = {};
        if (visitDate) payload.visit.visitDate = visitDate;
        if (visitDoctor) payload.visit.doctorName = visitDoctor;
        if (visitRemarks) payload.visit.remarks = visitRemarks;
        payload.prescription = {
          rightEye: cleanEyeSet(prescription.rightEye),
          leftEye: cleanEyeSet(prescription.leftEye),
          pd: prescription.pd || undefined,
          notes: prescription.notes || undefined,
          problems: prescription.problems || undefined,
        };
      }

      if (visitType !== "service" && visitType !== "other") {
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
          accessories: orderAccessories.map((a) => a.name).filter(Boolean),
          deliveryDate: deliveryDate || undefined,
        };
        if (visitType === "frame_change") {
          delete payload.order.lens; delete payload.order.lensBrand;
          delete payload.order.lensType; delete payload.order.lensIndex; delete payload.order.lensPrice;
          delete payload.order.coating;
        }
        if (visitType === "new_lens" || visitType === "contact_lens") {
          delete payload.order.frame; delete payload.order.frameBrand;
          delete payload.order.frameModel; delete payload.order.frameColor;
          delete payload.order.framePrice;
        }
        if (visitType === "contact_lens") delete payload.order.coating;
      }

      const validItems = billItems.filter((i) => i.description && i.price > 0);
      const discount = calcDiscount();
      if (validItems.length > 0) {
        payload.bill = {
          items: validItems.map((i) => ({ description: i.description, quantity: i.qty || 1, unitPrice: i.price })),
          subtotal: totalAmount,
          discount,
          totalAmount: Math.max(0, totalAmount - discount),
          advancePaid,
          pendingAmount: Math.max(0, totalAmount - discount - advancePaid),
        };
        payload.payment = { amount: advancePaid, mode: paymentMode };
      }

      if (deliveryAddress) payload.delivery = { address: deliveryAddress, expectedDeliveryDate: deliveryDate || undefined };

      const res = await api.post("/api/workspace/transaction", payload);
      if (res.success) {
        toast.success("Visit created successfully!");

        const customerMobile = customer?.mobile || "";
        if (customerMobile && res.data?.bill) {
          greetingSent.current = false;
          setCountdown(3);
          countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
                sendGreeting(res.data, customer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          savingRef.current = false;
          navigate(`/customers/${id}?visitId=${res.data?.visit?._id || ""}`);
        }
      } else {
        toast.error(res.message || "Failed to save");
        setSaving(false);
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
      setSaving(false);
    }
  }

  async function sendGreeting(data: any, cust: any) {
    if (greetingSent.current) return;
    greetingSent.current = true;
    try {
      const customerMobile = cust?.mobile || "";
      const shopName = settings?.shopName || "KMJ Optical";
      const customerName = cust?.name || "";
      const num = customerMobile.replace(/\D/g, "");
      const fullNum = num.length === 10 ? `91${num}` : num;
      const msg = `*${shopName}* 🕶\n\nHello *${customerName}*,\n\nThank you for visiting us! Your order has been placed successfully.\n\nThank you! 🙏`;
      await api.post("/api/whatsapp/send", { phone: fullNum, message: msg });
    } catch { /* silent */ }
    navigate(`/customers/${id}?visitId=${data?.visit?._id || ""}`);
  }

  function searchInventory(q: string, type: "frame", idx: number) {
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length < 2) { setSuggestions([]); setSuggestionsFor(null); return; }
    const t = setTimeout(async () => {
      const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(q)}`);
      if (res.success) {
        setSuggestions(res.data || []);
        setSuggestionsFor(res.data.length > 0 ? { type, idx } : null);
      }
    }, 300);
    setSearchTimer(t);
  }

  if (loading) return <PageSkeleton page="customerdetail" />;
  if (!customer) return <div className="p-8 text-center text-gray-500">Customer not found</div>;

  const stepKeys = steps.map(s => s.key);
  const currentIdx = stepKeys.indexOf(step);
  const discountVal = calcDiscount();
  const finalTotal = Math.max(0, totalAmount - discountVal);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/customers/${id}`)}
            className="btn-ghost btn-sm flex items-center gap-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1.5">
            <ArrowLeft size={18} />
          </button>
          <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-base">
            {customer.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">New Visit</h1>
            <p className="text-xs text-gray-500">{customer.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock size={12} />
          <span>{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl p-2 shadow-sm border border-gray-200 dark:border-dark-600 mb-5">
        <div className="flex items-center">
          {steps.map((s, i) => {
            const done = currentIdx > i;
            const active = currentIdx === i;
            return (
              <button key={s.key} disabled={!done && !active}
                onClick={() => { if (done || active) setStep(s.key); }}
                className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-xs font-medium transition-all relative
                  ${done ? "text-primary-600 dark:text-primary-400 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/20" : ""}
                  ${active ? "text-gray-900 dark:text-white bg-gray-100 dark:bg-dark-700" : ""}
                  ${!done && !active ? "text-gray-300 dark:text-gray-600" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                  ${done ? "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400" : ""}
                  ${active ? "bg-primary-600 text-white" : ""}
                  ${!done && !active ? "bg-gray-100 dark:bg-dark-700 text-gray-300 dark:text-gray-600" : ""}`}>
                  {done ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {step === "service" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity size={16} className="text-primary-500" /> Visit Type
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {VISIT_TYPES.map((vt) => {
                const Icon = vt.icon;
                return (
                  <button key={vt.value}
                    onClick={() => setVisitType(vt.value)}
                    className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl text-xs font-medium border transition-all
                      ${visitType === vt.value
                        ? "bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 shadow-sm"
                        : "bg-gray-50 dark:bg-dark-750 border-gray-200 dark:border-dark-600 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-dark-500"}`}>
                    <Icon size={16} />
                    {vt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Calendar size={16} className="text-primary-500" /> Visit Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Date</label>
                <input type="date" value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="input-field text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Doctor</label>
                <input placeholder="Doctor name (optional)" value={visitDoctor}
                  onChange={(e) => setVisitDoctor(e.target.value)}
                  className="input-field text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Remarks</label>
                <input placeholder="Any remarks" value={visitRemarks}
                  onChange={(e) => setVisitRemarks(e.target.value)}
                  className="input-field text-sm" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep("prescription")}
              className="btn-primary flex items-center gap-2 px-6 py-2.5">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "prescription" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={usePrescription}
                onChange={(e) => setUsePrescription(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-500 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Use prescription</span>
            </label>
          </div>

          {usePrescription && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Eye size={16} className="text-primary-500" /> Right Eye (O.D.)
                  </h3>
                  <div className="space-y-4">
                    {["dv", "nv", "pc"].map((k) => (
                      <EyeRow key={k} label={k === "dv" ? "Distance Vision" : k === "nv" ? "Near Vision" : "Progressive Corridor"}
                        data={prescription.rightEye[k]}
                        onChange={(v) => setRight(k, v)} />
                    ))}
                  </div>
                </div>
                <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Eye size={16} className="text-primary-500" /> Left Eye (O.S.)
                  </h3>
                  <div className="space-y-4">
                    {["dv", "nv", "pc"].map((k) => (
                      <EyeRow key={k} label={k === "dv" ? "Distance Vision" : k === "nv" ? "Near Vision" : "Progressive Corridor"}
                        data={prescription.leftEye[k]}
                        onChange={(v) => setLeft(k, v)} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">PD (Pupillary Distance)</label>
                    <input placeholder="e.g. 62" value={prescription.pd}
                      onChange={(e) => setPrescription((p) => ({ ...p, pd: e.target.value }))}
                      className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Problems</label>
                    <input placeholder="e.g. headaches" value={prescription.problems}
                      onChange={(e) => setPrescription((p) => ({ ...p, problems: e.target.value }))}
                      className="input-field text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Notes</label>
                    <input placeholder="Additional notes" value={prescription.notes}
                      onChange={(e) => setPrescription((p) => ({ ...p, notes: e.target.value }))}
                      className="input-field text-sm" />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end">
            <button onClick={() => setStep("order")}
              className="btn-primary flex items-center gap-2 px-6 py-2.5">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "order" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Eye size={16} className="text-primary-500" /> Frames ({orderFrames.length})
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setScanModal(true)}
                  className="btn-ghost btn-sm flex items-center gap-1.5 text-xs">
                  <ScanLine size={14} /> Scan
                </button>
                <button onClick={() => setOrderFrames((prev) => [...prev, { sku: "", brand: "", model: "", color: "", price: 0 }])}
                  className="btn-primary btn-sm flex items-center gap-1.5 text-xs">
                  <Plus size={14} /> Add Frame
                </button>
              </div>
            </div>
            {orderFrames.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No frames added yet</p>
            ) : (
              <div className="space-y-2">
                {orderFrames.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-dark-750 rounded-xl px-3 py-2 relative">
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-2">
                      <input placeholder="SKU" value={f.sku}
                        onChange={(e) => { updateFrame(i, "sku", e.target.value); searchInventory(e.target.value, "frame", i); }}
                        onFocus={() => setIsFocused(true)} onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                        className="input-field text-xs py-1.5" />
                      <input placeholder="Brand" value={f.brand}
                        onChange={(e) => updateFrame(i, "brand", e.target.value)}
                        className="input-field text-xs py-1.5" />
                      <input placeholder="Model" value={f.model}
                        onChange={(e) => updateFrame(i, "model", e.target.value)}
                        className="input-field text-xs py-1.5" />
                      <input placeholder="Color" value={f.color}
                        onChange={(e) => updateFrame(i, "color", e.target.value)}
                        className="input-field text-xs py-1.5" />
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                        <input type="number" placeholder="Price" value={f.price || ""}
                          onChange={(e) => updateFrame(i, "price", Number(e.target.value))}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className="input-field text-xs py-1.5 pl-5" />
                      </div>
                    </div>
                    {suggestionsFor?.type === "frame" && suggestionsFor.idx === i && isFocused && suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-xl shadow-lg max-h-48 overflow-y-auto z-10">
                        {suggestions.map((s: any, si: number) => (
                          <button key={si} type="button"
                            onMouseDown={() => {
                              updateFrame(i, "sku", s.sku || "");
                              updateFrame(i, "brand", s.brand || "");
                              updateFrame(i, "model", s.model || "");
                              updateFrame(i, "color", s.color || "");
                              updateFrame(i, "price", s.sellingPrice || 0);
                              setSuggestions([]);
                              setSuggestionsFor(null);
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-dark-700 flex items-center gap-3">
                            <span className="font-medium">{s.sku}</span>
                            <span className="text-gray-500">{s.brand} {s.model}</span>
                            <span className="text-gray-400 ml-auto"> · ₹{s.sellingPrice || 0}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button onClick={() => removeFrame(i)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Tag size={16} className="text-primary-500" /> Lenses ({orderLenses.length})
              </h2>
              <button onClick={() => setOrderLenses((prev) => [...prev, { sku: "", brand: "", features: [], index: "", price: 0, coating: "" }])}
                className="btn-primary btn-sm flex items-center gap-1.5 text-xs">
                <Plus size={14} /> Add Lens
              </button>
            </div>
            {orderLenses.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No lenses added yet</p>
            ) : (
              <div className="space-y-2">
                {orderLenses.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-dark-750 rounded-xl px-3 py-2">
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-6 gap-2">
                      <input placeholder="SKU" value={l.sku}
                        onChange={(e) => updateLens(i, "sku", e.target.value)}
                        className="input-field text-xs py-1.5" />
                      <input placeholder="Brand" value={l.brand}
                        onChange={(e) => updateLens(i, "brand", e.target.value)}
                        className="input-field text-xs py-1.5" />
                      <input placeholder="Type (comma sep)" value={l.features.join(", ")}
                        onChange={(e) => updateLens(i, "features", e.target.value.split(",").map((s: string) => s.trim()))}
                        className="input-field text-xs py-1.5" />
                      <input placeholder="Index" value={l.index}
                        onChange={(e) => updateLens(i, "index", e.target.value)}
                        className="input-field text-xs py-1.5" />
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                        <input type="number" placeholder="Price" value={l.price || ""}
                          onChange={(e) => updateLens(i, "price", Number(e.target.value))}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className="input-field text-xs py-1.5 pl-5" />
                      </div>
                      <input placeholder="Coating" value={l.coating}
                        onChange={(e) => updateLens(i, "coating", e.target.value)}
                        className="input-field text-xs py-1.5" />
                    </div>
                    <button onClick={() => removeLens(i)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Grid3X3 size={16} className="text-primary-500" /> Accessories ({orderAccessories.length})
              </h2>
              <button onClick={() => setOrderAccessories((prev) => [...prev, { name: "", price: 0 }])}
                className="btn-primary btn-sm flex items-center gap-1.5 text-xs">
                <Plus size={14} /> Add Accessory
              </button>
            </div>
            {orderAccessories.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No accessories added yet</p>
            ) : (
              <div className="space-y-2">
                {orderAccessories.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-dark-750 rounded-xl px-3 py-2">
                    <div className="flex-1 grid grid-cols-2 gap-2">
                      <input placeholder="Name" value={a.name}
                        onChange={(e) => updateAccessory(i, "name", e.target.value)}
                        className="input-field text-xs py-1.5" />
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                        <input type="number" placeholder="Price" value={a.price || ""}
                          onChange={(e) => updateAccessory(i, "price", Number(e.target.value))}
                          onWheel={(e) => (e.target as HTMLElement).blur()}
                          className="input-field text-xs py-1.5 pl-5" />
                      </div>
                    </div>
                    <button onClick={() => removeAccessory(i)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2">
            <button onClick={() => { syncBillFromOrder(orderFrames, orderLenses, orderAccessories); setStep("billing"); }}
              className="btn-primary flex items-center gap-2 px-6 py-2.5 flex-1 justify-center">
              Sync to Billing <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "billing" && (
        <div className="space-y-5">
          <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <FileText size={16} className="text-primary-500" /> Bill Items ({billItems.length})
              </h2>
              <button onClick={() => setBillItems((prev) => [...prev, { description: "", price: 0, qty: 1 }])}
                className="btn-primary btn-sm flex items-center gap-1.5 text-xs">
                <Plus size={14} /> Add Item
              </button>
            </div>
            {billItems.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No bill items. Add items or sync from order.</p>
            ) : (
              <div className="space-y-2">
                {billItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-dark-750 rounded-xl px-3 py-2">
                    <input placeholder="Description" value={item.description}
                      onChange={(e) => updateBillItem(i, "description", e.target.value)}
                      className="input-field text-xs py-1.5 flex-1" />
                    <div className="relative w-20">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                      <input type="number" placeholder="Price" value={item.price || ""}
                        onChange={(e) => updateBillItem(i, "price", Number(e.target.value))}
                        onWheel={(e) => (e.target as HTMLElement).blur()}
                        className="input-field text-xs py-1.5 pl-5 w-full" />
                    </div>
                    <input type="number" placeholder="Qty" value={item.qty || 1} min="1"
                      onChange={(e) => updateBillItem(i, "qty", Math.max(1, Number(e.target.value)))}
                      onWheel={(e) => (e.target as HTMLElement).blur()}
                      className="input-field text-xs py-1.5 w-14 text-center" />
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-16 text-right">₹{(item.price * item.qty).toFixed(0)}</span>
                    <button onClick={() => removeBillItem(i)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200 dark:border-dark-600">
              <span className="text-sm text-gray-500">Total Amount</span>
              <span className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep("payment")}
              className="btn-primary flex items-center gap-2 px-6 py-2.5">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {step === "payment" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Percent size={16} className="text-primary-500" /> Discount
              </h2>
              <div className="flex gap-2 mb-3">
                <button onClick={() => setDiscountType("percent")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${discountType === "percent" ? "bg-primary-600 text-white shadow-sm" : "text-gray-500"}`}>%</button>
                <button onClick={() => setDiscountType("amount")}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${discountType === "amount" ? "bg-primary-600 text-white shadow-sm" : "text-gray-500"}`}>₹</button>
              </div>
              {discountType === "percent" ? (
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">%</span>
                  <input type="number" placeholder="Discount %" value={discountPercent || ""}
                    onChange={(e) => setDiscountPercent(Number(e.target.value))}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="input-field text-sm pl-7" />
                </div>
              ) : (
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">₹</span>
                  <input type="number" placeholder="Discount amount" value={discountAmount || ""}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="input-field text-sm pl-7" />
                </div>
              )}
              {discountVal > 0 && (
                <p className="text-xs text-gray-500 mt-2">- ₹{discountVal.toLocaleString()}</p>
              )}
            </div>

            <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CreditCard size={16} className="text-primary-500" /> Payment
              </h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Mode</label>
                  <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}
                    className="input-field text-sm">
                    {["Cash", "UPI", "Card", "Bank Transfer", "Insurance"].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                  <input type="number" placeholder="Amount collected" value={advancePaid || ""}
                    onChange={(e) => setAdvancePaid(Number(e.target.value))}
                    onWheel={(e) => (e.target as HTMLElement).blur()}
                    className="input-field text-sm pl-8" />
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-dark-600">
                  <span className="text-gray-500">Total</span>
                  <span className="font-medium">₹{totalAmount.toLocaleString()}</span>
                </div>
                {discountVal > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-red-500">Discount</span>
                    <span className="font-medium text-red-500">- ₹{discountVal.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white">
                  <span>Final Total</span>
                  <span>₹{finalTotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600">
                  <span>Collected</span>
                  <span className="font-semibold">₹{advancePaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-gray-500">Balance</span>
                  <span className={advancePaid >= finalTotal ? "text-green-600" : "text-amber-600"}>
                    {advancePaid >= finalTotal ? "₹0 (Paid)" : `₹${Math.max(0, finalTotal - advancePaid).toLocaleString()}`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-dark-600">
            <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Truck size={16} className="text-primary-500" /> Delivery
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Delivery Address</label>
                <textarea placeholder="Address (optional)" value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  className="input-field text-sm" rows={2} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Expected Delivery Date</label>
                <input type="date" value={deliveryDate}
                  onChange={(e) => setDeliveryDate(e.target.value)}
                  className="input-field text-sm" />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={() => setStep("confirmation")}
              className="btn-primary flex items-center gap-2 px-6 py-2.5">
              Review <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ==================== STEP: CONFIRMATION ==================== */}
      {step === "confirmation" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
            <CheckCircle size={18} className="text-primary-500" />
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Confirmation</h2>
              <p className="text-xs text-gray-500">Review all details before saving</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Service</h4>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{VISIT_TYPES.find(t => t.value === visitType)?.label || visitType}</p>
              <p className="text-xs text-gray-500">{visitDate} {visitDoctor ? `· ${visitDoctor}` : ""}</p>
              {visitRemarks && <p className="text-xs text-gray-500 mt-1">{visitRemarks}</p>}
            </div>
            {usePrescription && (
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Prescription</h4>
                {prescription.pd && <p className="text-xs text-gray-600 dark:text-gray-400">PD: {prescription.pd}</p>}
                {prescription.problems && <p className="text-xs text-gray-600 dark:text-gray-400">Problems: {prescription.problems}</p>}
                {prescription.notes && <p className="text-xs text-gray-600 dark:text-gray-400">Notes: {prescription.notes}</p>}
              </div>
            )}
            {orderFrames.length > 0 && (
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Frames</h4>
                {orderFrames.map((f, i) => (
                  <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{f.brand} {f.model} ({f.color}) · ₹{f.price}</p>
                ))}
              </div>
            )}
            {orderLenses.length > 0 && (
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Lenses</h4>
                {orderLenses.map((l, i) => (
                  <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{l.brand} {l.features.join(", ")} {l.coating} · ₹{l.price}</p>
                ))}
              </div>
            )}
            {orderAccessories.length > 0 && (
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Accessories</h4>
                {orderAccessories.map((a, i) => (
                  <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{a.name} · ₹{a.price}</p>
                ))}
              </div>
            )}
            <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Billing</h4>
              {billItems.filter(i => i.description && i.price > 0).map((item, i) => (
                <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{item.description} x{item.qty} = ₹{(item.price * item.qty).toFixed(0)}</p>
              ))}
              <div className="border-t border-gray-200 dark:border-dark-600 mt-2 pt-2 flex justify-between">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">Total</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">₹{totalAmount.toLocaleString()}</span>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-500">-₹{discountVal.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">Advance</span>
                <span className="text-green-600 font-semibold">₹{advancePaid.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">Balance</span>
                <span className="font-semibold">₹{Math.max(0, finalTotal - advancePaid).toLocaleString()}</span>
              </div>
            </div>
            {deliveryAddress && (
              <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Delivery</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">{deliveryAddress}</p>
                {deliveryDate && <p className="text-xs text-gray-500">Expected: {deliveryDate}</p>}
              </div>
            )}
          </div>

          <div className="flex justify-between pt-3 border-t border-gray-100 dark:border-dark-700">
            <button onClick={() => setStep("payment")} className="btn-secondary px-4 py-2 text-sm flex items-center gap-1.5">
              <ChevronLeft size={15} /> Back
            </button>
            <button onClick={saveTransaction} disabled={saving || (advancePaid <= 0 && advancePaid < finalTotal)}
              className="btn-success px-6 py-2.5 text-sm flex items-center gap-2 font-semibold disabled:opacity-50 shadow-sm">
              {saving ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
              ) : countdown > 0 ? (
                <><MessageCircle size={16} /> WhatsApp in {countdown}s</>
              ) : (
                <><Save size={16} /> Save & Send WhatsApp</>
              )}
            </button>
          </div>
        </div>
      )}

      {currentIdx > 0 && step !== "confirmation" && (
        <div className="flex justify-between pt-4">
          <button onClick={() => setStep(stepKeys[Math.max(0, currentIdx - 1)])}
            className="btn-ghost flex items-center gap-1.5 text-sm px-4 py-2">
            <ChevronLeft size={16} /> Back
          </button>
        </div>
      )}

      {/* Scan QR Modal */}
      <Modal open={scanModal} onClose={() => setScanModal(false)} title="Scan Frame QR" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-gray-500">Enter SKU or barcode to auto-fill frame details.</p>
          <input className="input-field" placeholder="SKU or barcode" autoFocus
            onChange={async (e) => {
              const q = e.target.value.trim();
              if (q.length > 2) {
                const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(q)}`);
                if (res.success && res.data.length > 0) {
                  const item = res.data[0];
                  const newFrame = { sku: item.sku || "", brand: item.brand || "", model: item.model || "", color: item.color || "", price: item.sellingPrice || 0 };
                  const next = [...orderFrames, newFrame];
                  setOrderFrames(next);
                  syncBillFromOrder(next, orderLenses, orderAccessories);
                  setScanModal(false);
                }
              }
            }} />
          <button onClick={() => { setScanModal(false); setCameraActive(true); }}
            className="w-full text-center py-2 text-xs font-semibold text-primary-600 hover:text-primary-700 border border-dashed border-gray-300 dark:border-dark-600 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all flex items-center justify-center gap-1.5">
            <ScanLine size={14} /> Use Camera
          </button>
        </div>
      </Modal>
      {cameraActive && (
        <CameraScanner onScan={async (code) => {
          const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(code)}`);
          if (res.success && res.data.length > 0) {
            const item = res.data[0];
            const newFrame = { sku: item.sku || "", brand: item.brand || "", model: item.model || "", color: item.color || "", price: item.sellingPrice || 0 };
            const next = [...orderFrames, newFrame];
            setOrderFrames(next);
            syncBillFromOrder(next, orderLenses, orderAccessories);
          }
          setCameraActive(false);
        }} onClose={() => setCameraActive(false)} />
      )}
    </div>
  );
}

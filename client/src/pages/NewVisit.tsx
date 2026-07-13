import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import { Search, Plus, Trash2, ChevronLeft, ChevronRight, Save, Camera, User, Eye, Activity, ShoppingCart, CreditCard, CheckCircle, Calendar } from "lucide-react";
import Modal from "../components/Modal";
import CameraScanner from "../components/CameraScanner";
import { cleanEyeSet } from "../utils/rx";
import { useTranslate } from "../context/TranslateContext";
const GENDER_OPTIONS = ["Male", "Female", "Other"];
const VISIT_TYPES = [
  { value: "new", label: "New Glasses" },
  { value: "frame_change", label: "Frame Change" },
  { value: "new_lens", label: "New Lens" },
  { value: "contact_lens", label: "Contact Lens" },
  { value: "service", label: "Service" },
  { value: "other", label: "Other" },
];

export default function NewVisit() {
  const toast = useToast();
  const { uiT } = useTranslate();
  const [phoneSearch, setPhoneSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<any>(null);
  const [searchTimer, setSearchTimer] = useState<any>(null);
  const [isFocused, setIsFocused] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);

  const [customerForm, setCustomerForm] = useState({
    name: "", mobile: "", email: "", address: "", city: "", age: undefined as number | undefined, gender: ""
  });
  const [visitType, setVisitType] = useState("new");
  const [visitDate, setVisitDate] = useState("");
  const [visitDoctor, setVisitDoctor] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");

  const [usePrescription, setUsePrescription] = useState(false);
  const [prescription, setPrescription] = useState({
    rightEye: { dv: {} as Record<string, string>, nv: {} as Record<string, string>, pc: {} as Record<string, string> },
    leftEye: { dv: {} as Record<string, string>, nv: {} as Record<string, string>, pc: {} as Record<string, string> },
    pd: "", notes: ""
  });

  // Frame fields
  const [orderFrames, setOrderFrames] = useState<Array<{ sku: string; brand: string; model: string; color: string; price: number }>>([]);
  // Lens fields
  const [orderLenses, setOrderLenses] = useState<Array<{ sku: string; brand: string; features: string[]; index: string; price: number; coating: string }>>([]);
  // Accessories
  const [orderAccessories, setOrderAccessories] = useState<Array<{ name: string; price: number }>>([]);
  const [orderDeliveryDate, setOrderDeliveryDate] = useState("");

  // Bill
  const [billItems, setBillItems] = useState<Array<{ description: string; price: number }>>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");

  // Scan
  const [scanModal, setScanModal] = useState(false);
  const [scanTarget, setScanTarget] = useState<"frame" | null>(null);

  // Suggestion search
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsForIdx, setSuggestionsForIdx] = useState<number | null>(null);

  // Steps
  const steps = [
    { key: "customer", label: uiT("Customer", "ग्राहक"), icon: User },
    { key: "examination", label: uiT("Examination", "जांच"), icon: Activity },
    { key: "order", label: uiT("Order", "ऑर्डर"), icon: ShoppingCart },
    { key: "billing", label: uiT("Billing", "बिलिंग"), icon: CreditCard },
    { key: "payment", label: uiT("Payment", "भुगतान"), icon: CheckCircle },
  ];
  const [step, setStep] = useState("customer");

  function searchInventory(q: string, idx: number) {
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length < 2) { setSuggestions([]); setSuggestionsForIdx(null); return; }
    const t = setTimeout(async () => {
      const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(q)}`);
      if (res.success) {
        setSuggestions(res.data || []);
        setSuggestionsForIdx(res.data.length > 0 ? idx : null);
      }
    }, 300);
    setSearchTimer(t);
  }

  function addFrame() { setOrderFrames([...orderFrames, { sku: "", brand: "", model: "", color: "", price: 0 }]); }
  function updateFrame(i: number, k: string, v: any) {
    const copy = [...orderFrames]; (copy as any)[i][k] = v; setOrderFrames(copy);
  }
  function removeFrame(i: number) { setOrderFrames(orderFrames.filter((_, idx) => idx !== i)); }

  function addLens() { setOrderLenses([...orderLenses, { sku: "", brand: "", features: [], index: "", price: 0, coating: "" }]); }
  function updateLens(i: number, k: string, v: any) {
    const copy = [...orderLenses]; (copy as any)[i][k] = v; setOrderLenses(copy);
  }
  function removeLens(i: number) { setOrderLenses(orderLenses.filter((_, idx) => idx !== i)); }

  function toggleFeature(i: number, f: string) {
    const copy = [...orderLenses];
    const idx = copy[i].features.indexOf(f);
    if (idx >= 0) copy[i].features.splice(idx, 1); else copy[i].features.push(f);
    setOrderLenses(copy);
  }

  function addAccessory() { setOrderAccessories([...orderAccessories, { name: "", price: 0 }]); }
  function updateAccessory(i: number, k: string, v: any) {
    const copy = [...orderAccessories]; (copy as any)[i][k] = v; setOrderAccessories(copy);
  }
  function removeAccessory(i: number) { setOrderAccessories(orderAccessories.filter((_, idx) => idx !== i)); }

  function addBillItem() { setBillItems([...billItems, { description: "", price: 0 }]); }
  function updateBillItem(i: number, k: string, v: any) {
    const copy = [...billItems]; (copy as any)[i][k] = v; setBillItems(copy);
  }
  function removeBillItem(i: number) { setBillItems(billItems.filter((_, idx) => idx !== i)); }

  useEffect(() => { setTotalAmount(billItems.reduce((s, i) => s + i.price, 0)); }, [billItems]);

  async function searchCustomer(num: string) {
    setSelectedCustomer(null); setIsNewCustomer(false); setSearched(true);
    const res = await api.get<any[]>(`/api/customers?phone=${encodeURIComponent(num)}`);
    if (res.success && res.data.length > 0) {
      const fullList = await Promise.all(res.data.map(async (c: any) => {
        const fullRes = await api.get<any>(`/api/customers/${c._id}`);
        const full = fullRes.success ? fullRes.data : c;
        const vRes = await api.get<any[]>(`/api/visits?customerId=${c._id}`);
        const lastV = vRes.success && vRes.data.length > 0
          ? new Date(vRes.data[0].visitDate).toLocaleDateString() : undefined;
        return { ...full, lastVisit: lastV };
      }));
      setSearchResults(fullList);
    } else { setSearchResults([]); }
  }

  function selectCustomer(c: any) {
    setSelectedCustomer(c);
    setCustomerForm({ name: c.name || "", mobile: c.mobile || "", email: c.email || "", address: c.address || "", city: c.city || "", age: c.age, gender: c.gender || "" });
    setSearchResults([]);
    // Pre-fill from last visit/prescription/order
    (async () => {
      const [visitsRes, prescRes, ordersRes] = await Promise.all([
        api.get<any[]>(`/api/visits?customerId=${c._id}`),
        api.get<any[]>(`/api/prescriptions?customerId=${c._id}`),
        api.get<any[]>(`/api/orders?customerId=${c._id}`),
      ]);
      if (visitsRes.success && visitsRes.data.length > 0) {
        const last = visitsRes.data[0];
        setVisitDate(last.visitDate ? last.visitDate.split("T")[0] : "");
        setVisitDoctor(last.doctorName || "");
        setVisitRemarks(last.remarks || "");
      }
      if (prescRes.success && prescRes.data.length > 0) {
        const prev = prescRes.data[0];
        setPrescription({
          rightEye: prev.rightEye || { dv: {}, nv: {}, pc: {} },
          leftEye: prev.leftEye || { dv: {}, nv: {}, pc: {} },
          pd: prev.pd || "", notes: prev.notes || "",
        });
        setUsePrescription(true);
      }
      if (ordersRes.success && ordersRes.data.length > 0) {
        const last = ordersRes.data[0];
        setOrderFrames(last.frame ? [{ sku: last.frame || "", brand: last.frameBrand || "", model: last.frameModel || "", color: last.frameColor || "", price: last.framePrice || 0 }] : []);
        setOrderLenses(last.lens ? [{ sku: last.lens || "", brand: last.lensBrand || "", features: last.lensType ? last.lensType.split(", ") : [], index: last.lensIndex || "", price: last.lensPrice || 0, coating: last.coating || "" }] : []);
        setOrderDeliveryDate(last.deliveryDate ? last.deliveryDate.split("T")[0] : "");
      }
    })();
  }

  function resetForm() {
    setStep("customer"); setPhoneSearch(""); setSelectedCustomer(null); setIsNewCustomer(false);
    setSearchResults([]); setSearched(false);
    setCustomerForm({ name: "", mobile: "", email: "", address: "", city: "", age: undefined, gender: "" });
    setVisitType("new"); setVisitDate(""); setVisitDoctor(""); setVisitRemarks("");
    setUsePrescription(false);
    setPrescription({ rightEye: { dv: {}, nv: {}, pc: {} }, leftEye: { dv: {}, nv: {}, pc: {} }, pd: "", notes: "" });
    setOrderFrames([]); setOrderLenses([]); setOrderAccessories([]); setOrderDeliveryDate("");
    setBillItems([]); setTotalAmount(0); setAdvancePaid(0); setPaymentMode("Cash");
    setDeliveryAddress(""); setDeliveryDate(""); setSuccess(null);
  }

  function canProceed(): boolean {
    switch (step) {
      case "customer": return !!(selectedCustomer || (customerForm.name && customerForm.mobile));
      case "examination": return true;
      case "order": return true;
      case "billing": return billItems.some((i) => i.description && i.price > 0);
      case "payment": return advancePaid > 0 || advancePaid >= totalAmount;
      default: return false;
    }
  }

  async function saveTransaction() {
    setSaving(true);
    try {
      const payload: any = {};
      if (selectedCustomer) payload.customerId = selectedCustomer._id;
      else {
        if (customerForm.mobile) {
          const ex = await api.get<any[]>(`/api/customers?phone=${encodeURIComponent(customerForm.mobile)}`);
          if (ex.success && ex.data.length > 0) payload.customerId = ex.data[0]._id;
        }
      }

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
      }

      const validItems = billItems.filter((i) => i.description && i.price > 0);
      if (validItems.length > 0) {
        payload.bill = { items: validItems, totalAmount };
        payload.payment = { amount: advancePaid, mode: paymentMode };
      }

      if (deliveryAddress) payload.delivery = { address: deliveryAddress, expectedDeliveryDate: deliveryDate || undefined };

      const res = await api.post("/api/workspace/transaction", payload);
      if (res.success) {
        toast.success("Visit & order created successfully!");
        resetForm();
      } else {
        toast.error(res.message || "Failed to save");
      }
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    }
    setSaving(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {success ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{uiT("Visit Completed!", "विज़िट पूर्ण!")}</h2>
          <p className="text-sm text-gray-500 mb-6">{uiT("The visit and order have been saved successfully.", "विज़िट और ऑर्डर सफलतापूर्वक सहेजे गए।")}</p>
          <button onClick={resetForm} className="btn-primary px-6 py-2.5">{uiT("New Visit", "नई विज़िट")}</button>
        </div>
      ) : (
        <>
          {/* Steps indicator */}
          <div className="flex items-center justify-between bg-white dark:bg-slate-800 rounded-2xl p-2 shadow-sm border border-gray-200 dark:border-slate-600">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const currentIdx = steps.findIndex((x) => x.key === step);
              const done = i < currentIdx;
              return (
                <button key={s.key} onClick={() => setStep(s.key)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                    s.key === step ? "bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300" :
                    done ? "text-green-600 dark:text-green-400" : "text-gray-400 dark:text-gray-500"
                  }`}>
                  <Icon size={16} />
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Step: Customer */}
          {step === "customer" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <User size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{uiT("Customer", "ग्राहक")}</h2>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Search by Mobile", "मोबाइल से खोजें")}</label>
                <div className="flex gap-2">
                  <input ref={phoneRef} type="text" inputMode="numeric" placeholder={uiT("Enter phone number", "फ़ोन नंबर दर्ज करें")}
                    className="input-field flex-1" value={phoneSearch}
                    onChange={(e) => setPhoneSearch(e.target.value)} />
                  <button onClick={() => searchCustomer(phoneSearch)} disabled={phoneSearch.length < 3}
                    className="btn-primary px-4 flex items-center gap-2 disabled:opacity-50"><Search size={16} /> {uiT("Search", "खोजें")}</button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((c) => (
                    <button key={c._id} type="button" onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-dark-700 transition-all">
                      <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.mobile}{c.lastVisit ? ` · ${uiT("Last visit:", "अंतिम विज़िट:")}${c.lastVisit}` : ""}</div>
                    </button>
                  ))}
                </div>
              )}

              {searched && searchResults.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl">
                  <p className="text-sm text-gray-500 mb-3">{uiT("No existing customer found with this number.", "इस नंबर से कोई ग्राहक नहीं मिला।")}</p>
                  <button onClick={() => { setIsNewCustomer(true); setCustomerForm({ ...customerForm, mobile: phoneSearch }); }}
                    className="btn-primary px-4 py-2">{uiT("Add New Customer", "नया ग्राहक जोड़ें")}</button>
                </div>
              )}

              {(selectedCustomer || isNewCustomer) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("Full Name *", "पूरा नाम *")}</label>
                    <input className="input-field" placeholder={uiT("Customer name", "ग्राहक का नाम")} value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("Mobile *", "मोबाइल *")}</label>
                    <input className="input-field" placeholder={uiT("Phone", "फ़ोन")} value={customerForm.mobile}
                      onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("Email", "ईमेल")}</label>
                    <input className="input-field" placeholder={uiT("Email", "ईमेल")} value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("Address", "पता")}</label>
                    <input className="input-field" placeholder={uiT("Address", "पता")} value={customerForm.address}
                      onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("City", "शहर")}</label>
                    <input className="input-field" placeholder={uiT("City", "शहर")} value={customerForm.city}
                      onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("Age", "आयु")}</label>
                      <input type="number" className="input-field" placeholder={uiT("Age", "आयु")} value={customerForm.age ?? ""}
                        onChange={(e) => setCustomerForm({ ...customerForm, age: e.target.value ? Number(e.target.value) : undefined })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("Gender", "लिंग")}</label>
                      <select className="input-field" value={customerForm.gender}
                        onChange={(e) => setCustomerForm({ ...customerForm, gender: e.target.value })}>
                        <option value="">{uiT("Select", "चुनें")}</option>
                        {GENDER_OPTIONS.map((g) => (<option key={g} value={g}>{uiT(g, g === "Male" ? "पुरुष" : g === "Female" ? "महिला" : "अन्य")}</option>))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button onClick={() => setStep("examination")} disabled={!canProceed()}
                  className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50">
                  {uiT("Next", "अगला")} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step: Examination */}
          {step === "examination" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <Activity size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{uiT("Examination", "जांच")}</h2>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{uiT("Visit Type", "विज़िट प्रकार")}</label>
                <div className="flex flex-wrap gap-1.5">
                  {VISIT_TYPES.map((t) => (
                    <button key={t.value} type="button" onClick={() => setVisitType(t.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        visitType === t.value ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                      }`}>{uiT(t.label, t.value === "new" ? "नए चश्मे" : t.value === "frame_change" ? "फ्रेम बदलें" : t.value === "new_lens" ? "नया लेंस" : t.value === "contact_lens" ? "कॉन्टैक्ट लेंस" : t.value === "service" ? "सेवा" : "अन्य")}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Visit Date", "विज़िट तिथि")}</label>
                  <input type="date" className="input-field" value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Doctor", "डॉक्टर")}</label>
                  <input className="input-field" placeholder={uiT("Doctor name", "डॉक्टर का नाम")} value={visitDoctor}
                    onChange={(e) => setVisitDoctor(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Remarks", "टिप्पणी")}</label>
                  <input className="input-field" placeholder={uiT("Any remarks", "कोई टिप्पणी")} value={visitRemarks}
                    onChange={(e) => setVisitRemarks(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="usePresc" checked={usePrescription}
                  onChange={(e) => setUsePrescription(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500" />
                <label htmlFor="usePresc" className="text-sm font-medium text-gray-700 dark:text-gray-300">{uiT("Add Prescription", "प्रिस्क्रिप्शन जोड़ें")}</label>
              </div>

              {usePrescription && (
                <div className="space-y-4">
                  {(["rightEye", "leftEye"] as const).map((side) => {
                    const label = side === "rightEye" ? uiT("Right Eye (R/E)", "दायाँ आँख (R/E)") : uiT("Left Eye (L/E)", "बायाँ आँख (L/E)");
                    const data = prescription[side];
                    return (
                      <div key={side}>
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{label}</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {(["dv", "nv", "pc"] as const).map((type) => {
                            const typeLabel = type === "dv" ? uiT("Distance Vision", "दूर दृष्टि") : type === "nv" ? uiT("Near Vision", "निकट दृष्टि") : uiT("Prism", "प्रिज़्म");
                            const fields = type === "pc" ? ["h", "v", "add"] : ["sph", "cyl", "axis", "prism", "add"];
                            return (
                              <div key={type} className="border border-gray-200 dark:border-slate-600 rounded-xl p-3">
                                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1.5">{typeLabel}</p>
                                <div className="space-y-1">
                                  {fields.map((f) => (
                                    <div key={f} className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-medium text-gray-400 w-6 uppercase">{f}</span>
                                      <input className="w-full text-xs py-1 px-1.5 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800"
                                        value={(data[type] as any)?.[f] || ""}
                                        onChange={(e) => {
                                          const copy = { ...prescription };
                                          if (!copy[side][type]) copy[side][type] = {};
                                          (copy[side][type] as any)[f] = e.target.value;
                                          setPrescription(copy);
                                        }} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("PD (Pupillary Distance)", "PD (पुपिलरी डिस्टेंस)")}</label>
                      <input className="input-field" placeholder="e.g. 62" value={prescription.pd}
                        onChange={(e) => setPrescription({ ...prescription, pd: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{uiT("Notes", "नोट्स")}</label>
                      <input className="input-field" placeholder={uiT("Prescription notes", "प्रिस्क्रिप्शन नोट्स")} value={prescription.notes}
                        onChange={(e) => setPrescription({ ...prescription, notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep("customer")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> {uiT("Back", "वापस")}</button>
                <button onClick={() => setStep("order")} className="btn-primary flex items-center gap-2 px-6">{uiT("Next", "अगला")} <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step: Order */}
          {step === "order" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <ShoppingCart size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{uiT("Order Details", "ऑर्डर विवरण")}</h2>
              </div>

              {visitType !== "service" && visitType !== "other" && (
                <>

                  {/* Frames */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Eye size={14} /> {uiT("Frames", "फ्रेम")}</h3>
                      <button onClick={addFrame} className="text-xs text-primary-600 hover:text-primary-700 font-medium">{uiT("+ Add Frame", "+ फ्रेम जोड़ें")}</button>
                    </div>
                    {orderFrames.map((f, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-20" placeholder="SKU" value={f.sku} onChange={(e) => updateFrame(i, "sku", e.target.value)} />
                        <div className="relative flex-1 min-w-[100px]">
                          <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-full" placeholder="Brand" value={f.brand}
                            onChange={(e) => { updateFrame(i, "brand", e.target.value); searchInventory(e.target.value, i); }}
                            onFocus={() => setIsFocused(true)} onBlur={() => setTimeout(() => setIsFocused(false), 200)} />
                          {suggestionsForIdx === i && isFocused && suggestions.length > 0 && (
                            <div className="absolute z-10 top-full left-0 w-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                              {suggestions.map((s: any) => (
                                <button key={s._id} type="button" onMouseDown={() => { updateFrame(i, "brand", s.brand); updateFrame(i, "model", s.model || ""); updateFrame(i, "sku", s.sku || ""); }}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-dark-700">{s.brand}{s.model ? ` ${s.model}` : ""} <span className="text-gray-400">({s.sku})</span></button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-20" placeholder="Model" value={f.model} onChange={(e) => updateFrame(i, "model", e.target.value)} />
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-20" placeholder="Color" value={f.color} onChange={(e) => updateFrame(i, "color", e.target.value)} />
                        <input type="number" className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-20" placeholder="Price" value={f.price || ""} onChange={(e) => updateFrame(i, "price", Number(e.target.value))} />
                        <button onClick={() => removeFrame(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-1">
                      <button type="button" onClick={() => setScanTarget("frame")} className="text-xs text-gray-500 hover:text-primary-600 flex items-center gap-1"
                        onMouseDown={() => setScanModal(true)}>
                        <Camera size={12} /> {uiT("Scan QR", "QR स्कैन करें")}
                      </button>
                    </div>
                  </div>

                  {/* Lenses */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Eye size={14} /> {uiT("Lenses", "लेंस")}</h3>
                      <button onClick={addLens} className="text-xs text-primary-600 hover:text-primary-700 font-medium">{uiT("+ Add Lens", "+ लेंस जोड़ें")}</button>
                    </div>
                    {orderLenses.map((l, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-20" placeholder="SKU" value={l.sku} onChange={(e) => updateLens(i, "sku", e.target.value)} />
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-28" placeholder="Brand" value={l.brand} onChange={(e) => updateLens(i, "brand", e.target.value)} />
                        <div className="flex gap-1 flex-wrap">
                          {[{ en: "Single Vision", hi: "सिंगल विज़न" }, { en: "Bifocal", hi: "बाईफोकल" }, { en: "Progressive", hi: "प्रोग्रेसिव" }, { en: "Blue Cut", hi: "ब्लू कट" }, { en: "Photochromic", hi: "फोटोक्रोमिक" }, { en: "Anti-Glare", hi: "एंटी-ग्लेयर" }].map((f) => (
                            <button key={f.en} type="button" onClick={() => toggleFeature(i, f.en)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                l.features.includes(f.en) ? "bg-primary-100 dark:bg-primary-900/30 border-primary-300 text-primary-700 dark:text-primary-300" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500"
                              }`}>{uiT(f.en, f.hi)}</button>
                          ))}
                        </div>
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-16" placeholder="Index" value={l.index} onChange={(e) => updateLens(i, "index", e.target.value)} />
                        <input type="number" className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-20" placeholder="Price" value={l.price || ""} onChange={(e) => updateLens(i, "price", Number(e.target.value))} />
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-20" placeholder="Coating" value={l.coating} onChange={(e) => updateLens(i, "coating", e.target.value)} />
                        <button onClick={() => removeLens(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>

                  {/* Accessories */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{uiT("Accessories", "सहायक उपकरण")}</h3>
                      <button onClick={addAccessory} className="text-xs text-primary-600 hover:text-primary-700 font-medium">{uiT("+ Add Accessory", "+ सहायक जोड़ें")}</button>
                    </div>
                    {orderAccessories.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 mb-1.5">
                        <input className="input-field flex-1 text-xs" placeholder="Name" value={a.name} onChange={(e) => updateAccessory(i, "name", e.target.value)} />
                        <input type="number" className="input-field w-24 text-xs" placeholder="Price" value={a.price || ""} onChange={(e) => updateAccessory(i, "price", Number(e.target.value))} />
                        <button onClick={() => removeAccessory(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Date */}
                  <div className="flex items-center gap-3 pt-2">
                    <Calendar size={16} className="text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{uiT("Delivery", "डिलीवरी")}</h3>
                  </div>
                  <div className="max-w-xs">
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{uiT("Expected Delivery Date", "अपेक्षित डिलीवरी तिथि")}</label>
                    <input type="date" className="input-field text-base" value={orderDeliveryDate}
                      onChange={(e) => setOrderDeliveryDate(e.target.value)} />
                    <div className="flex gap-1.5 mt-1.5">
                      {[
                        { label: uiT("Today", "आज"), days: 0 },
                        { label: uiT("Tomorrow", "कल"), days: 1 },
                        { label: uiT("3 Days", "3 दिन"), days: 3 },
                        { label: uiT("5 Days", "5 दिन"), days: 5 },
                        { label: uiT("7 Days", "7 दिन"), days: 7 },
                      ].map((s) => {
                        const d = new Date();
                        d.setDate(d.getDate() + s.days);
                        const dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
                        const active = orderDeliveryDate === dateStr;
                        return (
                          <button key={s.label} type="button" onClick={() => setOrderDeliveryDate(dateStr)}
                            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-all ${active ? "bg-primary-600 text-white shadow-sm" : "bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600"
                              }`}>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep("examination")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> {uiT("Back", "वापस")}</button>
                <button onClick={() => setStep("billing")} className="btn-primary flex items-center gap-2 px-6">{uiT("Next", "अगला")} <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step: Billing */}
          {step === "billing" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <CreditCard size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{uiT("Billing", "बिलिंग")}</h2>
              </div>

              <div>
                {billItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input className="input-field flex-1 text-sm" placeholder="Description" value={item.description}
                      onChange={(e) => updateBillItem(i, "description", e.target.value)} />
                    <input type="number" className="input-field w-24 text-sm" placeholder="Amount" value={item.price || ""}
                      onChange={(e) => updateBillItem(i, "price", Number(e.target.value))} />
                    <button onClick={() => removeBillItem(i)} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16} /></button>
                  </div>
                ))}
                <button onClick={addBillItem} className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1 mt-2">
                  <Plus size={16} /> {uiT("Add Item", "आइटम जोड़ें")}
                </button>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-dark-700">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{uiT("Total", "कुल")}</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">\u20B9{totalAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep("order")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> {uiT("Back", "वापस")}</button>
                <button onClick={() => setStep("payment")} disabled={!canProceed()}
                  className="btn-primary flex items-center gap-2 px-6 disabled:opacity-50">{uiT("Next", "अगला")} <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step: Payment */}
          {step === "payment" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <CheckCircle size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{uiT("Payment", "भुगतान")}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Amount Paid", "भुगतान राशि")}</label>
                  <input type="number" className="input-field text-lg font-bold" placeholder="0"
                    value={advancePaid || ""} onChange={(e) => setAdvancePaid(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{uiT("Payment Mode", "भुगतान मोड")}</label>
                  <select className="input-field" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                    {[{ en: "Cash", hi: "नकद" }, { en: "Card", hi: "कार्ड" }, { en: "UPI", hi: "UPI" }, { en: "Bank Transfer", hi: "बैंक ट्रांसफर" }, { en: "Insurance", hi: "बीमा" }].map((m) => (<option key={m.en} value={m.en}>{uiT(m.en, m.hi)}</option>))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{uiT("Total Bill", "कुल बिल")}</span>
                  <span className="font-semibold">\u20B9{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{uiT("Paid", "भुगतान")}</span>
                  <span className="font-semibold text-green-600">\u20B9{advancePaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-slate-600">
                  <span className="font-medium">{uiT("Pending", "बाकी")}</span>
                  <span className="font-bold text-amber-600">\u20B9{Math.max(0, totalAmount - advancePaid).toLocaleString()}</span>
                </div>
              </div>

              {/* Delivery */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{uiT("Delivery (optional)", "डिलीवरी (वैकल्पिक)")}</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{uiT("Address", "पता")}</label>
                  <input className="input-field" placeholder={uiT("Delivery address", "डिलीवरी पता")} value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{uiT("Expected Date", "अपेक्षित तिथि")}</label>
                  <input type="date" className="input-field" value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep("billing")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> {uiT("Back", "वापस")}</button>
                <button onClick={saveTransaction} disabled={saving || (advancePaid <= 0 && advancePaid < totalAmount)}
                  className="btn-success flex items-center gap-2 px-8 py-3 text-base disabled:opacity-50">
                  {saving ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> {uiT("Saving...", "सहेज रहे हैं...")}</>
                  : <><Save size={18} /> {uiT("Save & Generate Order", "सहेजें और ऑर्डर बनाएं")}</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Scan QR Modal */}
      <Modal open={scanModal} onClose={() => setScanModal(false)} title={uiT("Scan Frame", "फ्रेम स्कैन करें")} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">{uiT("Point your scanner at the QR code or type the SKU below.", "अपना स्कैनर QR कोड पर रखें या नीचे SKU टाइप करें।")}</p>
          <div className="flex gap-2">
            <input className="input-field flex-1" placeholder={uiT("SKU or code", "SKU या कोड")} autoFocus
              onChange={async (e) => {
                const q = e.target.value.trim();
                if (q.length > 2) {
                  const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(q)}`);
                  if (res.success && res.data.length > 0) {
                    const item = res.data[0];
                    if (scanTarget === "frame") {
                      addFrame();
                      const idx = orderFrames.length;
                      setTimeout(() => {
                        updateFrame(idx, "sku", item.sku || "");
                        updateFrame(idx, "brand", item.brand || "");
                        updateFrame(idx, "model", item.model || "");
                        updateFrame(idx, "color", item.color || "");
                        updateFrame(idx, "price", item.price || 0);
                      }, 50);
                    }
                    setScanModal(false);
                  }
                }
              }} />
          </div>
          <CameraScanner onScan={async (code) => {
            const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(code)}`);
            if (res.success && res.data.length > 0) {
              const item = res.data[0];
              if (scanTarget === "frame") {
                addFrame();
                const idx = orderFrames.length;
                setTimeout(() => {
                  updateFrame(idx, "sku", item.sku || "");
                  updateFrame(idx, "brand", item.brand || "");
                  updateFrame(idx, "model", item.model || "");
                  updateFrame(idx, "color", item.color || "");
                  updateFrame(idx, "price", item.price || 0);
                }, 50);
              }
              setScanModal(false);
            } else {
              toast.error("Item not found");
            }
          }} />
        </div>
      </Modal>

      {/* Order Complete */}
    </div>
  );
}

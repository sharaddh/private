import React, { useState, useEffect, useRef } from "react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import PageSkeleton from "../components/PageSkeleton";
import { Search, Plus, Trash2, ChevronLeft, ChevronRight, Save, Camera, User, Eye, Activity, ShoppingCart, CreditCard, CheckCircle, Calendar } from "lucide-react";
import Modal from "../components/Modal";
import CameraScanner from "../components/CameraScanner";

// ---- helpers ----
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
  const [phoneSearch, setPhoneSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
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
    { key: "customer", label: "Customer", icon: User },
    { key: "examination", label: "Examination", icon: Activity },
    { key: "order", label: "Order", icon: ShoppingCart },
    { key: "billing", label: "Billing", icon: CreditCard },
    { key: "payment", label: "Payment", icon: CheckCircle },
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

  if (loading) return <PageSkeleton page="newvisit" />;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {success ? (
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Visit Completed!</h2>
          <p className="text-sm text-gray-500 mb-6">The visit and order have been saved successfully.</p>
          <button onClick={resetForm} className="btn-primary px-6 py-2.5">New Visit</button>
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
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Customer</h2>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Search by Mobile</label>
                <div className="flex gap-2">
                  <input ref={phoneRef} type="text" inputMode="numeric" placeholder="Enter phone number"
                    className="input-field flex-1" value={phoneSearch}
                    onChange={(e) => setPhoneSearch(e.target.value)} />
                  <button onClick={() => searchCustomer(phoneSearch)} disabled={phoneSearch.length < 3}
                    className="btn-primary px-4 flex items-center gap-2 disabled:opacity-50"><Search size={16} /> Search</button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map((c) => (
                    <button key={c._id} type="button" onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-dark-700 transition-all">
                      <div className="font-medium text-gray-900 dark:text-white">{c.name}</div>
                      <div className="text-xs text-gray-500">{c.mobile}{c.lastVisit ? ` · Last visit: ${c.lastVisit}` : ""}</div>
                    </button>
                  ))}
                </div>
              )}

              {searched && searchResults.length === 0 && (
                <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-slate-600 rounded-xl">
                  <p className="text-sm text-gray-500 mb-3">No existing customer found with this number.</p>
                  <button onClick={() => { setIsNewCustomer(true); setCustomerForm({ ...customerForm, mobile: phoneSearch }); }}
                    className="btn-primary px-4 py-2">Add New Customer</button>
                </div>
              )}

              {(selectedCustomer || isNewCustomer) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                    <input className="input-field" placeholder="Customer name" value={customerForm.name}
                      onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mobile *</label>
                    <input className="input-field" placeholder="Phone" value={customerForm.mobile}
                      onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input className="input-field" placeholder="Email" value={customerForm.email}
                      onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                    <input className="input-field" placeholder="Address" value={customerForm.address}
                      onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                    <input className="input-field" placeholder="City" value={customerForm.city}
                      onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Age</label>
                      <input type="number" className="input-field" placeholder="Age" value={customerForm.age ?? ""}
                        onChange={(e) => setCustomerForm({ ...customerForm, age: e.target.value ? Number(e.target.value) : undefined })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Gender</label>
                      <select className="input-field" value={customerForm.gender}
                        onChange={(e) => setCustomerForm({ ...customerForm, gender: e.target.value })}>
                        <option value="">Select</option>
                        {GENDER_OPTIONS.map((g) => (<option key={g} value={g}>{g}</option>))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button onClick={() => setStep("examination")} disabled={!canProceed()}
                  className="btn-primary px-6 py-2.5 flex items-center gap-2 disabled:opacity-50">
                  Next <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* Step: Examination */}
          {step === "examination" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <Activity size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Examination</h2>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Visit Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {VISIT_TYPES.map((t) => (
                    <button key={t.value} type="button" onClick={() => setVisitType(t.value)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        visitType === t.value ? "bg-primary-600 text-white" : "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400"
                      }`}>{t.label}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Visit Date</label>
                  <input type="date" className="input-field" value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Doctor</label>
                  <input className="input-field" placeholder="Doctor name" value={visitDoctor}
                    onChange={(e) => setVisitDoctor(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Remarks</label>
                  <input className="input-field" placeholder="Any remarks" value={visitRemarks}
                    onChange={(e) => setVisitRemarks(e.target.value)} />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="usePresc" checked={usePrescription}
                  onChange={(e) => setUsePrescription(e.target.checked)}
                  className="rounded border-gray-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500" />
                <label htmlFor="usePresc" className="text-sm font-medium text-gray-700 dark:text-gray-300">Add Prescription</label>
              </div>

              {usePrescription && (
                <div className="space-y-4">
                  {(["rightEye", "leftEye"] as const).map((side) => {
                    const label = side === "rightEye" ? "Right Eye (R/E)" : "Left Eye (L/E)";
                    const data = prescription[side];
                    return (
                      <div key={side}>
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">{label}</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {(["dv", "nv", "pc"] as const).map((type) => {
                            const typeLabel = type === "dv" ? "Distance Vision" : type === "nv" ? "Near Vision" : "Prism";
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PD (Pupillary Distance)</label>
                      <input className="input-field" placeholder="e.g. 62" value={prescription.pd}
                        onChange={(e) => setPrescription({ ...prescription, pd: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                      <input className="input-field" placeholder="Prescription notes" value={prescription.notes}
                        onChange={(e) => setPrescription({ ...prescription, notes: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep("customer")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> Back</button>
                <button onClick={() => setStep("order")} className="btn-primary flex items-center gap-2 px-6">Next <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step: Order */}
          {step === "order" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <ShoppingCart size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Order Details</h2>
              </div>

              {visitType !== "service" && visitType !== "other" && (
                <>

                  {/* Frames */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Eye size={14} /> Frames</h3>
                      <button onClick={addFrame} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add Frame</button>
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
                        <Camera size={12} /> Scan QR
                      </button>
                    </div>
                  </div>

                  {/* Lenses */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2"><Eye size={14} /> Lenses</h3>
                      <button onClick={addLens} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add Lens</button>
                    </div>
                    {orderLenses.map((l, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 mb-2 p-2 bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-100 dark:border-slate-600">
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-20" placeholder="SKU" value={l.sku} onChange={(e) => updateLens(i, "sku", e.target.value)} />
                        <input className="text-xs py-1.5 px-2 rounded-md border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 w-28" placeholder="Brand" value={l.brand} onChange={(e) => updateLens(i, "brand", e.target.value)} />
                        <div className="flex gap-1 flex-wrap">
                          {["Single Vision", "Bifocal", "Progressive", "Blue Cut", "Photochromic", "Anti-Glare"].map((f) => (
                            <button key={f} type="button" onClick={() => toggleFeature(i, f)}
                              className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                                l.features.includes(f) ? "bg-primary-100 dark:bg-primary-900/30 border-primary-300 text-primary-700 dark:text-primary-300" : "bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-600 text-gray-500"
                              }`}>{f}</button>
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
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Accessories</h3>
                      <button onClick={addAccessory} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Add Accessory</button>
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
                <button onClick={() => setStep("examination")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> Back</button>
                <button onClick={() => setStep("billing")} className="btn-primary flex items-center gap-2 px-6">Next <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step: Billing */}
          {step === "billing" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <CreditCard size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Billing</h2>
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
                  <Plus size={16} /> Add Item
                </button>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-dark-700">
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Total</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">\u20B9{totalAmount.toLocaleString()}</span>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep("order")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> Back</button>
                <button onClick={() => setStep("payment")} disabled={!canProceed()}
                  className="btn-primary flex items-center gap-2 px-6 disabled:opacity-50">Next <ChevronRight size={16} /></button>
              </div>
            </div>
          )}

          {/* Step: Payment */}
          {step === "payment" && (
            <div className="card space-y-5">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100 dark:border-dark-700">
                <CheckCircle size={18} className="text-primary-500" />
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Payment</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Amount Paid</label>
                  <input type="number" className="input-field text-lg font-bold" placeholder="0"
                    value={advancePaid || ""} onChange={(e) => setAdvancePaid(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Payment Mode</label>
                  <select className="input-field" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                    {["Cash", "Card", "UPI", "Bank Transfer", "Insurance"].map((m) => (<option key={m}>{m}</option>))}
                  </select>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-slate-700 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Bill</span>
                  <span className="font-semibold">\u20B9{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Paid</span>
                  <span className="font-semibold text-green-600">\u20B9{advancePaid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-200 dark:border-slate-600">
                  <span className="font-medium">Pending</span>
                  <span className="font-bold text-amber-600">\u20B9{Math.max(0, totalAmount - advancePaid).toLocaleString()}</span>
                </div>
              </div>

              {/* Delivery */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Delivery (optional)</h3>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                  <input className="input-field" placeholder="Delivery address" value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Expected Date</label>
                  <input type="date" className="input-field" value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <button onClick={() => setStep("billing")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> Back</button>
                <button onClick={saveTransaction} disabled={saving || (advancePaid <= 0 && advancePaid < totalAmount)}
                  className="btn-success flex items-center gap-2 px-8 py-3 text-base disabled:opacity-50">
                  {saving ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
                  : <><Save size={18} /> Save & Generate Order</>}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Scan QR Modal */}
      <Modal open={scanModal} onClose={() => setScanModal(false)} title="Scan Frame" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Point your scanner at the QR code or type the SKU below.</p>
          <div className="flex gap-2">
            <input className="input-field flex-1" placeholder="SKU or code" autoFocus
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

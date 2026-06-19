import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  Search, UserPlus, Phone, User, Eye, ShoppingCart,
  CreditCard, Truck, Check, ChevronRight, ChevronLeft, Save,
  X, Plus, Printer, ArrowRight, AlertCircle, MessageCircle,
  RotateCcw, Clock, DollarSign, Edit3, Info, RefreshCw
} from "lucide-react";

type Step = "customer" | "examination" | "order" | "billing" | "payment" | "done";

interface CustomerData {
  _id?: string; name: string; mobile: string; email?: string;
  address?: string; city?: string; age?: number; gender?: string;
  totalVisits?: number; totalSpent?: number; pendingAmount?: number; lastVisit?: string;
}

interface EyeData { sph?: number; cyl?: number; axis?: number; va?: string; }
interface EyeSet { dv?: EyeData; nv?: EyeData; pc?: EyeData; }

export default function Workspace() {
  const navigate = useNavigate();
  const phoneRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("customer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  // Step 1: Customer search + selection
  const [phoneSearch, setPhoneSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerData>({
    name: "", mobile: "", email: "", address: "", city: "", age: undefined, gender: "",
  });

  // Step 2: Examination
  const [visitDoctor, setVisitDoctor] = useState("");
  const [visitRemarks, setVisitRemarks] = useState("");
  const [prescription, setPrescription] = useState({
    rightEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    leftEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    pd: "", notes: "",
  });
  const [usePrescription, setUsePrescription] = useState(true);

  // Step 3: Order
  const [orderFrame, setOrderFrame] = useState("");
  const [orderLens, setOrderLens] = useState("");
  const [orderCoating, setOrderCoating] = useState("");
  const [orderAccessories, setOrderAccessories] = useState("");
  const [orderQty, setOrderQty] = useState(1);
  const [orderDeliveryDate, setOrderDeliveryDate] = useState("");
  const [useOrder, setUseOrder] = useState(true);

  // Step 4: Billing
  const [billItems, setBillItems] = useState<{ description: string; qty: number; price: number }[]>([
    { description: "", qty: 1, price: 0 },
  ]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [billTax, setBillTax] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);

  // Inventory suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsForIdx, setSuggestionsForIdx] = useState<number | null>(null);
  const searchTimer = useRef<any>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Step 5: Payment
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Step 6: Delivery
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [useDelivery, setUseDelivery] = useState(false);

  useEffect(() => { phoneRef.current?.focus(); }, []);

  // Auto-fill bill from order
  useEffect(() => {
    if (useOrder && orderFrame) {
      setBillItems((prev) => {
        const hasFrame = prev.some((i) => i.description.toLowerCase().includes("frame"));
        const hasLens = prev.some((i) => i.description.toLowerCase().includes("lens"));
        const hasCoating = prev.some((i) => i.description.toLowerCase().includes("coating"));
        const newItems = prev.filter((i) => i.description);
        if (!hasFrame && orderFrame) newItems.push({ description: `Frame - ${orderFrame}`, qty: orderQty, price: 0 });
        if (!hasLens && orderLens) newItems.push({ description: `Lens - ${orderLens}`, qty: 1, price: 0 });
        if (!hasCoating && orderCoating) newItems.push({ description: `Coating - ${orderCoating}`, qty: 1, price: 0 });
        return newItems.length > 0 ? newItems : [{ description: "", qty: 1, price: 0 }];
      });
    }
  }, [orderFrame, orderLens, orderCoating, orderQty, useOrder]);

  // Auto-fill delivery address from customer
  useEffect(() => {
    if (selectedCustomer?.address && !deliveryAddress) {
      setDeliveryAddress(selectedCustomer.address);
    }
  }, [selectedCustomer]);

  const subtotal = billItems.reduce((s, i) => s + i.qty * i.price, 0);
  const totalAmount = subtotal - billDiscount + billTax;
  const pendingAmt = totalAmount - advancePaid;

  // Load previous data for returning customer
  async function loadPreviousData(customerId: string) {
    const [visitsRes, prescRes, ordersRes] = await Promise.all([
      api.get(`/api/visits?customerId=${customerId}`),
      api.get(`/api/prescriptions?customerId=${customerId}`),
      api.get(`/api/orders?customerId=${customerId}`),
    ]);
    if (visitsRes.success && visitsRes.data.length > 0) {
      const last = visitsRes.data[0];
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
    }
    if (ordersRes.success && ordersRes.data.length > 0) {
      const last = ordersRes.data[0];
      setOrderFrame(last.frame || "");
      setOrderLens(last.lens || "");
      setOrderCoating(last.coating || "");
      if (last.accessories) setOrderAccessories(last.accessories.join(", "));
      setUseOrder(true);
    }
  }

  async function searchCustomer() {
    const num = phoneSearch.replace(/\D/g, "");
    if (num.length < 3) return;
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setSearched(true);
    const res = await api.get(`/api/customers?phone=${encodeURIComponent(num)}`);
    if (res.success && res.data.length > 0) {
      // Fetch full data + last visit for each
      const fullList = await Promise.all(res.data.map(async (c: any) => {
        const fullRes = await api.get(`/api/customers/${c._id}`);
        const full = fullRes.success ? fullRes.data : c;
        const vRes = await api.get(`/api/visits?customerId=${c._id}`);
        const lastV = vRes.success && vRes.data.length > 0
          ? new Date(vRes.data[0].visitDate).toLocaleDateString() : undefined;
        return { ...full, lastVisit: lastV };
      }));
      setSearchResults(fullList);
    } else {
      setSearchResults([]);
      setIsNewCustomer(true);
      setCustomerForm((prev) => ({ ...prev, mobile: num }));
    }
  }

  function selectCustomer(c: any) {
    setSelectedCustomer({
      _id: c._id, name: c.name, mobile: c.mobile || "", email: c.email || "",
      address: c.address || "", city: c.city || "", age: c.age, gender: c.gender || "",
      totalVisits: c.totalVisits, totalSpent: c.totalSpent, pendingAmount: c.pendingAmount, lastVisit: c.lastVisit,
    });
    setCustomerForm({
      name: c.name, mobile: c.mobile || "", email: c.email || "",
      address: c.address || "", city: c.city || "", age: c.age, gender: c.gender || "",
    });
    setDeliveryAddress(c.address || deliveryAddress);
    setIsNewCustomer(false);
    loadPreviousData(c._id);
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") searchCustomer();
  }

  function searchInventory(query: string, idx: number) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.length < 2) { setSuggestions([]); setSuggestionsForIdx(null); return; }
    searchTimer.current = setTimeout(async () => {
      const res = await api.get(`/api/inventory?q=${encodeURIComponent(query)}`);
      if (res.success) {
        setSuggestions(res.data || []);
        setSuggestionsForIdx(res.data.length > 0 ? idx : null);
      }
    }, 300);
  }

  function applySuggestion(idx: number, item: any) {
    updateBillItem(idx, "description", item.brand && item.model ? `${item.brand} ${item.model}` : item.sku);
    updateBillItem(idx, "price", item.sellingPrice || 0);
    setSuggestions([]); setSuggestionsForIdx(null);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setSuggestions([]); setSuggestionsForIdx(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function saveTransaction() {
    setSaving(true); setError(""); setSuccess(null);
    try {
      const payload: any = {};
      const custId = selectedCustomer?._id || customerForm._id;
      payload.customer = { ...customerForm, _id: custId };

      if (usePrescription || visitDoctor || visitRemarks) {
        payload.visit = {};
        if (visitDoctor) payload.visit.doctorName = visitDoctor;
        if (visitRemarks) payload.visit.remarks = visitRemarks;
        payload.prescription = {
          rightEye: cleanEyeSet(prescription.rightEye),
          leftEye: cleanEyeSet(prescription.leftEye),
          pd: prescription.pd || undefined, notes: prescription.notes || undefined,
        };
      }

      if (useOrder && (orderFrame || orderLens)) {
        payload.order = {
          frame: orderFrame || undefined, lens: orderLens || undefined,
          coating: orderCoating || undefined,
          accessories: orderAccessories ? orderAccessories.split(",").map((s) => s.trim()).filter(Boolean) : [],
          quantity: orderQty, deliveryDate: orderDeliveryDate || undefined,
        };
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

      if (useDelivery && deliveryAddress) {
        payload.delivery = { address: deliveryAddress, expectedDeliveryDate: deliveryDate || undefined };
      }

      const res = await api.post("/api/workspace/transaction", payload);
      if (res.success) {
        setSuccess(res.data);
        setStep("done");
      } else {
        setError(res.message || "Transaction failed");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally { setSaving(false); }
  }

  function cleanEyeSet(e: EyeSet): EyeSet {
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

  function updateEye(side: "rightEye" | "leftEye", type: "dv" | "nv" | "pc", field: string, value: string) {
    setPrescription((prev) => {
      const eyeSet = { ...prev[side] };
      eyeSet[type] = { ...eyeSet[type], [field]: value === "" ? undefined : field === "va" ? value : Number(value) };
      return { ...prev, [side]: eyeSet };
    });
  }

  function resetAll() {
    setStep("customer"); setPhoneSearch(""); setSelectedCustomer(null); setIsNewCustomer(false);
    setSearchResults([]); setSearched(false);
    setCustomerForm({ name: "", mobile: "", email: "", address: "", city: "", age: undefined, gender: "" });
    setVisitDoctor(""); setVisitRemarks("");
    setPrescription({ rightEye: { dv: {}, nv: {}, pc: {} }, leftEye: { dv: {}, nv: {}, pc: {} }, pd: "", notes: "" });
    setOrderFrame(""); setOrderLens(""); setOrderCoating(""); setOrderAccessories(""); setOrderQty(1); setOrderDeliveryDate("");
    setUseOrder(true);
    setBillItems([{ description: "", qty: 1, price: 0 }]);
    setBillDiscount(0); setBillTax(0); setAdvancePaid(0);
    setPaymentAmount(0); setPaymentMode("Cash"); setPaymentNotes("");
    setDeliveryAddress(""); setDeliveryDate(""); setUseDelivery(false);
    setError(""); setSuccess(null); setUsePrescription(true);
    phoneRef.current?.focus();
  }

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
              {(["sph", "cyl", "axis", "va"] as const).map((field) => (
                <div key={field}>
                  <label className="text-[10px] text-gray-400 block">{field.toUpperCase()}</label>
                  <input type={field === "va" ? "text" : "number"} step={field === "va" ? undefined : "0.25"}
                    className="input-field py-1.5 text-xs"
                    value={data[type]?.[field] ?? ""}
                    onChange={(e) => updateEye(side, type, field, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function sendWhatsApp(phone: string, bill: any, customer: any, payment: any, order: any) {
    const num = phone.replace(/\D/g, "");
    if (!num) return;
    const items = (bill?.items || []).map((i: any) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("%0a");
    const msg = `*KMJ Optical* 🕶%0a%0a*Bill:* ${bill?.billNumber || ""}%0a*Date:* ${new Date().toLocaleDateString("en-IN")}%0a%0a*Customer:* ${customer?.name || ""}%0a*Mobile:* ${customer?.mobile || ""}%0a%0a*Items:*%0a${items}%0a%0a*Subtotal:* ₹${(bill?.subtotal || 0).toFixed(0)}%0a${bill?.discount ? `*Discount:* -₹${bill.discount.toFixed(0)}%0a` : ""}${bill?.tax ? `*Tax:* +₹${bill.tax.toFixed(0)}%0a` : ""}*Total:* ₹${(bill?.totalAmount || 0).toFixed(0)}%0a*Paid:* ₹${(bill?.advancePaid || 0).toFixed(0)}%0a*Pending:* ₹${(bill?.pendingAmount || 0).toFixed(0)}%0a%0a*Payment:* ${payment?.paymentMode || "Cash"}%0a%0a*Order:* ${order?.frame || ""} ${order?.lens || ""}${order?.coating ? ` + ${order.coating}` : ""}%0a%0aThank you for your visit! 🙏`;
    window.open(`https://wa.me/91${num}?text=${msg}`, "_blank");
  }

  function sendPickupWhatsApp(phone: string, order: any) {
    const num = phone.replace(/\D/g, "");
    if (!num) return;
    const msg = `*KMJ Optical* 🕶%0a%0aHi ${selectedCustomer?.name || ""},%0aYour order is ready for pickup! 🎉%0a%0a*Order:* ${order?.frame || ""} ${order?.lens || ""}${order?.coating ? ` + ${order.coating}` : ""}%0a*Due Amount:* ₹${(success?.bill?.pendingAmount || 0).toFixed(0)}%0a%0aPlease visit our store to collect.%0aThank you! 🙏`;
    window.open(`https://wa.me/91${num}?text=${msg}`, "_blank");
  }

  const steps = [
    { key: "customer", label: "Customer", icon: User },
    { key: "examination", label: "Prescription", icon: Eye },
    { key: "order", label: "Purchase", icon: ShoppingCart },
    { key: "billing", label: "Bill", icon: DollarSign },
    { key: "payment", label: "Payment", icon: CreditCard },
  ] as const;
  const currentIdx = steps.findIndex((s) => s.key === step);

  function canProceed(): boolean {
    switch (step) {
      case "customer": return !!selectedCustomer || (isNewCustomer && customerForm.name.length > 0);
      case "examination": return true;
      case "order": return true;
      case "billing": return billItems.some((i) => i.description && i.price > 0);
      case "payment": return paymentAmount >= 0;
      default: return true;
    }
  }

  function addBillItem() { setBillItems((prev) => [...prev, { description: "", qty: 1, price: 0 }]); }
  function removeBillItem(idx: number) { if (billItems.length > 1) setBillItems((prev) => prev.filter((_, i) => i !== idx)); }
  function updateBillItem(idx: number, field: "description" | "qty" | "price", value: string | number) {
    setBillItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  // ----- DONE SCREEN -----
  if (step === "done" && success) {
    const bill = success.bill;
    const customer = success.customer;
    const payment = success.payment;
    const order = success.order;
    const delivery = success.delivery;
    const mobile = customer?.mobile || selectedCustomer?.mobile || "";
    return (
      <div className="max-w-2xl mx-auto space-y-4 pt-4 pb-20">
        <div className="card text-center py-6">
          <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Transaction Complete!</h2>
          <p className="text-sm text-gray-500">Bill: {bill?.billNumber || ""}</p>
        </div>

        {/* Customer Info */}
        {customer && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Customer</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">{customer.name?.charAt(0) || "?"}</div>
              <div>
                <p className="font-medium text-gray-900">{customer.name}</p>
                <p className="text-sm text-gray-500">{customer.mobile}</p>
              </div>
            </div>
          </div>
        )}

        {/* Prescription Summary */}
        {success.prescription && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Prescription</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">Right Eye</p>
                {success.prescription.rightEye?.dv?.sph != null && <p>DV: {success.prescription.rightEye.dv.sph} {success.prescription.rightEye.dv.cyl != null ? `/ ${success.prescription.rightEye.dv.cyl}` : ""}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Left Eye</p>
                {success.prescription.leftEye?.dv?.sph != null && <p>DV: {success.prescription.leftEye.dv.sph} {success.prescription.leftEye.dv.cyl != null ? `/ ${success.prescription.leftEye.dv.cyl}` : ""}</p>}
              </div>
              {success.prescription.pd && <div className="col-span-2"><p>PD: {success.prescription.pd}</p></div>}
            </div>
          </div>
        )}

        {/* Order Summary */}
        {order && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Order</h3>
            <div className="space-y-1 text-sm">
              {order.frame && <p><span className="text-gray-500">Frame:</span> {order.frame}</p>}
              {order.lens && <p><span className="text-gray-500">Lens:</span> {order.lens}</p>}
              {order.coating && <p><span className="text-gray-500">Coating:</span> {order.coating}</p>}
              {order.accessories?.length > 0 && <p><span className="text-gray-500">Accessories:</span> {order.accessories.join(", ")}</p>}
              <span className={`mt-2 inline-block badge ${
                order.status === "Delivered" ? "badge-green" :
                order.status === "Ready" ? "badge-blue" : "badge-yellow"
              }`}>{order.status || "Draft"}</span>
            </div>
          </div>
        )}

        {/* Bill Summary */}
        {bill && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Bill</h3>
            <div className="space-y-1.5 text-sm">
              {(bill.items || []).map((it: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{it.description} x{it.quantity || 1}</span>
                  <span className="font-medium">₹{((it.quantity || 1) * (it.unitPrice || 0)).toFixed(0)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-1.5 mt-1.5 space-y-0.5">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{(bill.subtotal || 0).toFixed(0)}</span></div>
                {bill.discount > 0 && <div className="flex justify-between text-red-500"><span>Discount</span><span>-₹{bill.discount.toFixed(0)}</span></div>}
                {bill.tax > 0 && <div className="flex justify-between text-amber-600"><span>Tax</span><span>+₹{bill.tax.toFixed(0)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 text-base pt-1"><span>Total</span><span>₹{(bill.totalAmount || 0).toFixed(0)}</span></div>
                {bill.advancePaid > 0 && <div className="flex justify-between text-emerald-600"><span>Paid</span><span>₹{bill.advancePaid.toFixed(0)}</span></div>}
                {bill.pendingAmount > 0 && <div className="flex justify-between text-amber-600 font-medium"><span>Pending</span><span>₹{bill.pendingAmount.toFixed(0)}</span></div>}
              </div>
            </div>
          </div>
        )}

        {/* Delivery */}
        {delivery && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Delivery</h3>
            <p className="text-sm text-gray-600">
              Status: {delivery.status}
              {delivery.expectedDeliveryDate && ` | Expected: ${new Date(delivery.expectedDeliveryDate).toLocaleDateString()}`}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          {mobile && bill && (
            <button onClick={() => sendWhatsApp(mobile, bill, customer, payment, order)}
              className="btn-success flex items-center gap-2">
              <MessageCircle size={18} /> Send WhatsApp Bill
            </button>
          )}
          {mobile && order && (
            <button onClick={() => sendPickupWhatsApp(mobile, order)}
              className="btn-secondary flex items-center gap-2">
              <RefreshCw size={18} /> Notify for Pickup
            </button>
          )}
          <button onClick={() => { if (bill) window.open(`/bills`, "_blank"); }}
            className="btn-secondary flex items-center gap-2">
            <Printer size={16} /> Print
          </button>
          <button onClick={resetAll} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> New Transaction
          </button>
        </div>
      </div>
    );
  }

  // ----- MAIN FLOW -----
  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20">
      {/* Step indicator */}
      <div className="flex items-center gap-0 bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.key;
          const isDone = currentIdx > i;
          return (
            <button key={s.key} onClick={() => { if (i < currentIdx) setStep(s.key); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                isActive ? "bg-indigo-600 text-white shadow-md" :
                isDone ? "text-emerald-600 hover:bg-emerald-50" :
                "text-gray-400"
              }`}>
              <Icon size={16} />
              <span className="hidden sm:inline">{s.label}</span>
              {isDone && <Check size={14} />}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ===== STEP 1: CUSTOMER SEARCH ===== */}
      {step === "customer" && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Find Customer</h2>
          <p className="text-sm text-gray-500 mb-5">Enter phone number to search existing customers or add new.</p>

          <div className="flex gap-3 mb-5">
            <div className="relative flex-1">
              <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input ref={phoneRef} type="tel" placeholder="Enter phone number..."
                value={phoneSearch} onChange={(e) => setPhoneSearch(e.target.value)}
                onKeyDown={handlePhoneKeyDown} className="input-field pl-10 text-lg" />
            </div>
            <button onClick={searchCustomer} className="btn-primary px-6"><Search size={18} /></button>
          </div>

          {/* Multi-customer search results */}
          {searched && searchResults.length > 0 && (
            <div className="space-y-3 mb-4">
              <p className="text-sm font-medium text-gray-500">{searchResults.length} customer(s) found</p>
              {searchResults.map((c: any) => (
                <div key={c._id}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all cursor-pointer"
                  onClick={() => selectCustomer(c)}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg">
                      {c.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                      <p className="text-sm text-gray-500">{c.mobile}</p>
                      {c.lastVisit && <p className="text-xs text-gray-400">Last visit: {c.lastVisit}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{c.totalVisits || 0} visits</p>
                    {(c.pendingAmount || 0) > 0 && <p className="text-xs text-amber-600 font-medium">₹{c.pendingAmount} due</p>}
                    <span className="text-indigo-600 text-sm font-medium mt-1 inline-block">Select →</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add new customer (no results or clicked add new) */}
          {searched && searchResults.length === 0 && isNewCustomer && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
              <p className="text-sm font-medium text-amber-800 mb-3">New customer — fill in the details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input className="input-field" placeholder="Full name" value={customerForm.name}
                    onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input className="input-field" value={customerForm.mobile} disabled />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input className="input-field" placeholder="email@example.com" value={customerForm.email || ""}
                    onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
                  <input type="number" className="input-field" placeholder="Age" value={customerForm.age ?? ""}
                    onChange={(e) => setCustomerForm({ ...customerForm, age: e.target.value ? Number(e.target.value) : undefined })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gender</label>
                  <select className="input-field" value={customerForm.gender || ""}
                    onChange={(e) => setCustomerForm({ ...customerForm, gender: e.target.value })}>
                    <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
                  <input className="input-field" placeholder="City" value={customerForm.city || ""}
                    onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
                  <input className="input-field" placeholder="Address" value={customerForm.address || ""}
                    onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
                </div>
              </div>
            </div>
          )}

          {/* Add new button when results exist but user may want different customer */}
          {searched && searchResults.length > 0 && (
            <button onClick={() => { setIsNewCustomer(true); setSelectedCustomer(null); setCustomerForm((prev) => ({ ...prev, name: "", email: "", address: "", city: "", age: undefined, gender: "" })); }}
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium text-sm mb-4">
              <UserPlus size={16} /> Add new customer with this number
            </button>
          )}

          <div className="flex justify-end mt-4">
            <button onClick={() => { if (selectedCustomer || isNewCustomer) setStep("examination"); else searchCustomer(); }}
              disabled={!canProceed()} className="btn-primary flex items-center gap-2">
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 2: EXAMINATION ===== */}
      {step === "examination" && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Eye Examination</h2>
              <p className="text-sm text-gray-500">Record today's prescription. Previous values are pre-filled.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!usePrescription} onChange={(e) => setUsePrescription(!e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              Skip
            </label>
          </div>

          {usePrescription && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor Name</label>
                  <input className="input-field" placeholder="Doctor's name" value={visitDoctor}
                    onChange={(e) => setVisitDoctor(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Remarks</label>
                  <input className="input-field" placeholder="Any remarks" value={visitRemarks}
                    onChange={(e) => setVisitRemarks(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderEyeFields("rightEye", "Right Eye")}
                {renderEyeFields("leftEye", "Left Eye")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">PD</label>
                  <input className="input-field" placeholder="e.g. 62mm" value={prescription.pd}
                    onChange={(e) => setPrescription({ ...prescription, pd: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
                  <input className="input-field" placeholder="Additional notes" value={prescription.notes}
                    onChange={(e) => setPrescription({ ...prescription, notes: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button onClick={() => setStep("customer")} className="btn-secondary flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={() => setStep("order")} className="btn-primary flex items-center gap-2">
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: ORDER (PURCHASE) ===== */}
      {step === "order" && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Purchase Details</h2>
              <p className="text-sm text-gray-500">Specify frame, lens, coating, and accessories.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={!useOrder} onChange={(e) => setUseOrder(!e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              No items
            </label>
          </div>

          {useOrder && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Frame Brand / Model</label>
                <input className="input-field" placeholder="e.g. RayBan RB2180" value={orderFrame}
                  onChange={(e) => setOrderFrame(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Lens Type</label>
                <input className="input-field" placeholder="e.g. Anti-glare 1.56" value={orderLens}
                  onChange={(e) => setOrderLens(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Coating</label>
                <input className="input-field" placeholder="e.g. Blue Cut" value={orderCoating}
                  onChange={(e) => setOrderCoating(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                <input type="number" min="1" className="input-field" value={orderQty}
                  onChange={(e) => setOrderQty(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Accessories</label>
                <input className="input-field" placeholder="Comma separated (case, cloth, cleaner)" value={orderAccessories}
                  onChange={(e) => setOrderAccessories(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Date</label>
                <input type="date" className="input-field" value={orderDeliveryDate}
                  onChange={(e) => setOrderDeliveryDate(e.target.value)} />
              </div>
            </div>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button onClick={() => setStep("examination")} className="btn-secondary flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={() => setStep("billing")} className="btn-primary flex items-center gap-2">
              Continue to Bill <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 4: BILLING ===== */}
      {step === "billing" && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Billing</h2>
          <p className="text-sm text-gray-500 mb-5">Add items and set prices. Order items are pre-filled.</p>

          <div className="space-y-3 mb-4">
            {billItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start bg-gray-50 p-3 rounded-xl relative">
                <div className="flex-1 relative">
                  <input className="input-field text-sm" placeholder="Item description (type for suggestions)" value={item.description}
                    onChange={(e) => { updateBillItem(idx, "description", e.target.value); searchInventory(e.target.value, idx); }} />
                  {suggestionsForIdx === idx && suggestions.length > 0 && (
                    <div ref={suggestionRef} className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((inv: any) => (
                        <button key={inv._id} type="button" onClick={() => applySuggestion(idx, inv)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-indigo-50 text-left border-b border-gray-100 last:border-0">
                          <div>
                            <p className="font-medium text-gray-900">{inv.brand && inv.model ? `${inv.brand} ${inv.model}` : inv.sku}</p>
                            <p className="text-xs text-gray-400">{inv.category || ""}{inv.color ? ` | ${inv.color}` : ""}</p>
                          </div>
                          <span className="font-semibold text-indigo-600">₹{inv.sellingPrice || 0}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="w-16">
                  <input type="number" min="1" className="input-field text-sm text-center" placeholder="Qty" value={item.qty}
                    onChange={(e) => updateBillItem(idx, "qty", Number(e.target.value))} />
                </div>
                <div className="w-24">
                  <input type="number" min="0" step="0.01" className="input-field text-sm text-right" placeholder="Price" value={item.price}
                    onChange={(e) => updateBillItem(idx, "price", Number(e.target.value))} />
                </div>
                <div className="w-16 text-right pt-2.5 text-sm font-medium text-gray-700">₹{(item.qty * item.price).toFixed(0)}</div>
                <button onClick={() => removeBillItem(idx)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 mt-1"><X size={16} /></button>
              </div>
            ))}
            <button onClick={addBillItem} className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              <Plus size={16} /> Add Item
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount (₹)</label>
              <input type="number" min="0" step="0.01" className="input-field" value={billDiscount}
                onChange={(e) => setBillDiscount(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tax (₹)</label>
              <input type="number" min="0" step="0.01" className="input-field" value={billTax}
                onChange={(e) => setBillTax(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Advance Paid (₹)</label>
              <input type="number" min="0" step="0.01" className="input-field" value={advancePaid}
                onChange={(e) => setAdvancePaid(Number(e.target.value))} />
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            {billDiscount > 0 && <div className="flex justify-between text-red-600"><span>Discount</span><span>-₹{billDiscount.toFixed(2)}</span></div>}
            {billTax > 0 && <div className="flex justify-between text-amber-600"><span>Tax</span><span>+₹{billTax.toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
              <span>Total</span><span>₹{totalAmount.toFixed(2)}</span>
            </div>
            {advancePaid > 0 && <div className="flex justify-between text-emerald-600"><span>Advance</span><span>-₹{advancePaid.toFixed(2)}</span></div>}
            {pendingAmt > 0 && <div className="flex justify-between text-amber-600 font-medium"><span>Pending</span><span>₹{pendingAmt.toFixed(2)}</span></div>}
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button onClick={() => setStep("order")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> Back</button>
            <button onClick={() => { setPaymentAmount(advancePaid > 0 ? advancePaid : totalAmount); setStep("payment"); }}
              className="btn-primary flex items-center gap-2">
              Continue to Payment <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 5: PAYMENT ===== */}
      {step === "payment" && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Payment</h2>
          <p className="text-sm text-gray-500 mb-5">Complete transaction.</p>

          <div className="bg-gray-50 rounded-xl p-6 mb-5 text-center">
            <p className="text-sm text-gray-500 mb-1">Total Amount</p>
            <p className="text-4xl font-bold text-gray-900">₹{totalAmount.toFixed(2)}</p>
            {pendingAmt > 0 && <p className="text-sm text-amber-600 mt-1">Pending: ₹{pendingAmt.toFixed(2)}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Amount</label>
              <input type="number" step="0.01" className="input-field text-lg font-bold" value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {["Cash", "UPI", "Card", "Bank Transfer"].map((mode) => (
                  <button key={mode} onClick={() => setPaymentMode(mode)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                      paymentMode === mode ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}>{mode}</button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes</label>
              <input className="input-field" placeholder="Payment notes" value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)} />
            </div>
          </div>

          {/* Delivery section */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={useDelivery} onChange={(e) => setUseDelivery(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <div>
                <p className="text-sm font-medium text-amber-800">Schedule Delivery</p>
                <p className="text-xs text-amber-600">Set delivery address and expected date</p>
              </div>
            </label>
            {useDelivery && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Address</label>
                  <textarea className="input-field" rows={2} value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Expected Delivery Date</label>
                  <input type="date" className="input-field" value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button onClick={() => setStep("billing")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> Back</button>
            <button onClick={saveTransaction} disabled={saving || paymentAmount <= 0}
              className="btn-success flex items-center gap-2 px-8 py-3 text-base">
              {saving ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
              : <><Save size={18} /> Complete Transaction</>}
            </button>
          </div>
        </div>
      )}

      {/* Summary bar - always visible with current data */}
      {(step !== "customer" && step !== "done") && selectedCustomer && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 lg:pl-72 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-400">{selectedCustomer.mobile} {orderFrame && `• ${orderFrame}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {totalAmount > 0 && <span className="font-semibold text-gray-900">₹{totalAmount.toFixed(0)}</span>}
              <span className="text-gray-400 hidden sm:inline">Step {currentIdx + 1} of 5</span>
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
                <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / 5) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

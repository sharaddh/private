import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  Search, UserPlus, Phone, User, Eye, ShoppingCart, FileText,
  CreditCard, Truck, Check, ChevronRight, ChevronLeft, Save,
  X, Plus, Minus, Printer, ArrowRight, AlertCircle, Clock, DollarSign
} from "lucide-react";

type Step = "customer" | "examination" | "order" | "billing" | "payment" | "done";

interface CustomerData {
  _id?: string;
  name: string;
  mobile: string;
  email?: string;
  address?: string;
  city?: string;
  age?: number;
  gender?: string;
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

  // Step 1: Customer
  const [phoneSearch, setPhoneSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
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
  const [useOrder, setUseOrder] = useState(false);

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
    setSuggestions([]);
    setSuggestionsForIdx(null);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (suggestionRef.current && !suggestionRef.current.contains(e.target as Node)) {
        setSuggestions([]);
        setSuggestionsForIdx(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Step 5: Payment
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMode, setPaymentMode] = useState("Cash");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Step 6: Delivery
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [useDelivery, setUseDelivery] = useState(false);

  useEffect(() => {
    phoneRef.current?.focus();
  }, []);

  // Auto-fill bill from order
  useEffect(() => {
    if (useOrder && orderFrame) {
      setBillItems((prev) => {
        const hasFrame = prev.some((i) => i.description.toLowerCase().includes("frame"));
        const hasLens = prev.some((i) => i.description.toLowerCase().includes("lens"));
        const newItems = [...prev];
        if (!hasFrame && orderFrame) {
          newItems.push({ description: `Frame - ${orderFrame}`, qty: orderQty, price: 0 });
        }
        if (!hasLens && orderLens) {
          newItems.push({ description: `Lens - ${orderLens}`, qty: orderQty, price: 0 });
        }
        if (orderCoating && !prev.some((i) => i.description.toLowerCase().includes("coating"))) {
          newItems.push({ description: `Coating - ${orderCoating}`, qty: 1, price: 0 });
        }
        return newItems;
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
  const pendingAmount = totalAmount - advancePaid;

  async function searchCustomer() {
    const num = phoneSearch.replace(/\D/g, "");
    if (num.length < 3) return;
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    const res = await api.get(`/api/customers?phone=${encodeURIComponent(num)}`);
    if (res.success && res.data.length > 0) {
      const c = res.data[0];
      setSearchResults([c]);
      setSelectedCustomer({
        _id: c._id, name: c.name, mobile: c.mobile || "", email: c.email || "",
        address: c.address || "", city: c.city || "", age: c.age, gender: c.gender,
      });
      setCustomerForm({
        name: c.name, mobile: c.mobile || "", email: c.email || "",
        address: c.address || "", city: c.city || "", age: c.age, gender: c.gender || "",
      });
      setDeliveryAddress(c.address || deliveryAddress);
      setStep("examination");
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
    });
    setCustomerForm({
      name: c.name, mobile: c.mobile || "", email: c.email || "",
      address: c.address || "", city: c.city || "", age: c.age, gender: c.gender || "",
    });
    setDeliveryAddress(c.address || deliveryAddress);
    setIsNewCustomer(false);
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") searchCustomer();
  }

  async function createCustomer(): Promise<string | null> {
    const payload: any = { name: customerForm.name, mobile: customerForm.mobile || undefined };
    if (customerForm.email) payload.email = customerForm.email;
    if (customerForm.address) payload.address = customerForm.address;
    if (customerForm.city) payload.city = customerForm.city;
    if (customerForm.age) payload.age = customerForm.age;
    if (customerForm.gender) payload.gender = customerForm.gender;

    const res = customerForm._id
      ? await api.put(`/api/customers/${customerForm._id}`, payload)
      : await api.post("/api/customers", payload);

    if (res.success) {
      setSelectedCustomer({ ...customerForm, _id: res.data._id });
      return res.data._id;
    }
    setError(res.message || "Failed to save customer");
    return null;
  }

  async function saveTransaction() {
    setSaving(true);
    setError("");
    setSuccess(null);

    try {
      const payload: any = {};

      // Customer
      const custId = selectedCustomer?._id || customerForm._id;
      payload.customer = { ...customerForm, _id: custId };

      // Visit & Prescription
      if (usePrescription || visitDoctor || visitRemarks) {
        payload.visit = {};
        if (visitDoctor) payload.visit.doctorName = visitDoctor;
        if (visitRemarks) payload.visit.remarks = visitRemarks;

        payload.prescription = {
          rightEye: cleanEyeSet(prescription.rightEye),
          leftEye: cleanEyeSet(prescription.leftEye),
          pd: prescription.pd || undefined,
          notes: prescription.notes || undefined,
        };
      }

      // Order
      if (useOrder && (orderFrame || orderLens)) {
        payload.order = {
          frame: orderFrame || undefined,
          lens: orderLens || undefined,
          coating: orderCoating || undefined,
          accessories: orderAccessories ? orderAccessories.split(",").map((s) => s.trim()).filter(Boolean) : [],
          quantity: orderQty,
          deliveryDate: orderDeliveryDate || undefined,
        };
      }

      // Bill
      const validItems = billItems.filter((i) => i.description && i.price > 0);
      if (validItems.length > 0) {
        payload.bill = {
          items: validItems.map((i) => ({ description: i.description, quantity: i.qty, unitPrice: i.price })),
          discount: billDiscount || 0,
          tax: billTax || 0,
          advancePaid: advancePaid || 0,
        };
      }

      // Payment
      if (paymentAmount > 0) {
        payload.payment = {
          amount: paymentAmount,
          paymentMode,
          notes: paymentNotes || undefined,
        };
      }

      // Delivery
      if (useDelivery && deliveryAddress) {
        payload.delivery = {
          address: deliveryAddress,
          expectedDeliveryDate: deliveryDate || undefined,
        };
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
    } finally {
      setSaving(false);
    }
  }

  function cleanEyeSet(e: EyeSet): EyeSet {
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

  function updateEye(side: "rightEye" | "leftEye", type: "dv" | "nv" | "pc", field: string, value: string) {
    setPrescription((prev) => {
      const eyeSet = { ...prev[side] };
      eyeSet[type] = { ...eyeSet[type], [field]: value === "" ? undefined : field === "va" ? value : Number(value) };
      return { ...prev, [side]: eyeSet };
    });
  }

  function resetAll() {
    setStep("customer");
    setPhoneSearch("");
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setSearchResults([]);
    setCustomerForm({ name: "", mobile: "", email: "", address: "", city: "", age: undefined, gender: "" });
    setVisitDoctor("");
    setVisitRemarks("");
    setPrescription({ rightEye: { dv: {}, nv: {}, pc: {} }, leftEye: { dv: {}, nv: {}, pc: {} }, pd: "", notes: "" });
    setOrderFrame(""); setOrderLens(""); setOrderCoating(""); setOrderAccessories(""); setOrderQty(1); setOrderDeliveryDate("");
    setUseOrder(false);
    setBillItems([{ description: "", qty: 1, price: 0 }]);
    setBillDiscount(0); setBillTax(0); setAdvancePaid(0);
    setPaymentAmount(0); setPaymentMode("Cash"); setPaymentNotes("");
    setDeliveryAddress(""); setDeliveryDate(""); setUseDelivery(false);
    setError(""); setSuccess(null);
    setUsePrescription(true);
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
                  <input
                    type={field === "va" ? "text" : "number"}
                    step={field === "va" ? undefined : "0.25"}
                    className="input-field py-1.5 text-xs"
                    value={data[type]?.[field] ?? ""}
                    onChange={(e) => updateEye(side, type, field, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  const steps = [
    { key: "customer", label: "Customer", icon: User },
    { key: "examination", label: "Examination", icon: Eye },
    { key: "order", label: "Order", icon: ShoppingCart },
    { key: "billing", label: "Billing", icon: FileText },
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

  // Add default bill items if Frame/Lens have prices
  function addBillItem() {
    setBillItems((prev) => [...prev, { description: "", qty: 1, price: 0 }]);
  }

  function removeBillItem(idx: number) {
    if (billItems.length > 1) setBillItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateBillItem(idx: number, field: "description" | "qty" | "price", value: string | number) {
    setBillItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  }

  function printReceipt() {
    const bill = success?.bill;
    const customer = success?.customer;
    const payment = success?.payment;
    if (!bill) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Receipt ${bill.billNumber}</title>
      <style>body{font-family:system-ui;padding:40px;max-width:680px;margin:auto;color:#1a1a1a}
        .header{text-align:center;margin-bottom:32px;border-bottom:2px solid #1a1a1a;padding-bottom:16px}
        .header h1{margin:0;font-size:22px}.header p{margin:4px 0;color:#555;font-size:13px}
        .info{display:flex;justify-content:space-between;margin-bottom:24px;font-size:13px}
        .info div{line-height:1.6}table{width:100%;border-collapse:collapse;margin-bottom:24px}
        th,td{border:1px solid #ddd;padding:10px 12px;text-align:left;font-size:13px}
        th{background:#f5f5f5;font-weight:600}
        .right{text-align:right}.totals{text-align:right;font-size:14px;line-height:1.8}
        .totals .grand{font-size:18px;font-weight:bold;border-top:2px solid #1a1a1a;padding-top:8px}
        .footer{text-align:center;margin-top:32px;padding-top:16px;border-top:1px solid #ddd;font-size:12px;color:#888}
      </style></head><body>
      <div class="header">
        <h1>KMJ Optical</h1>
        <p>${bill.billNumber || ""}</p>
        <p>Date: ${new Date(bill.createdAt || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
      </div>
      <div class="info">
        <div>
          <strong>Customer</strong>
          <p>${customer?.name || ""}</p>
          <p>${customer?.mobile || ""}</p>
          ${customer?.address ? `<p>${customer.address}</p>` : ""}
        </div>
        ${payment ? `<div style="text-align:right">
          <strong>Payment</strong>
          <p>Mode: ${payment.paymentMode || "Cash"}</p>
          <p>Date: ${new Date(payment.paymentDate || Date.now()).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
        </div>` : ""}
      </div>
      <table>
        <tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
        ${(bill.items || []).map((it: any) => `
          <tr><td>${it.description || ""}</td><td>${it.quantity || 1}</td>
          <td class="right">₹${(it.unitPrice || 0).toFixed(2)}</td>
          <td class="right">₹${((it.quantity || 1) * (it.unitPrice || 0)).toFixed(2)}</td></tr>
        `).join("")}
      </table>
      <div class="totals">
        <p>Subtotal: ₹${(bill.subtotal || 0).toFixed(2)}</p>
        ${bill.discount ? `<p>Discount: -₹${bill.discount.toFixed(2)}</p>` : ""}
        ${bill.tax ? `<p>Tax: +₹${bill.tax.toFixed(2)}</p>` : ""}
        <p class="grand">Total: ₹${(bill.totalAmount || 0).toFixed(2)}</p>
        ${bill.advancePaid ? `<p>Paid: ₹${bill.advancePaid.toFixed(2)}</p>` : ""}
        ${bill.pendingAmount > 0 ? `<p style="color:#d97706">Pending: ₹${bill.pendingAmount.toFixed(2)}</p>` : ""}
      </div>
      <div class="footer">Thank you for your business!</div>
      <script>window.print()</script></body></html>
    `);
    w.document.close();
  }

  if (step === "done" && success) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 pt-8">
        <div className="card text-center py-12">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Transaction Complete!</h2>
          <p className="text-gray-500 mb-6">All records have been saved successfully.</p>

          <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8">
            {success.customer && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Customer</p>
                <p className="font-semibold text-gray-900">{success.customer.name}</p>
              </div>
            )}
            {success.bill && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Bill</p>
                <p className="font-semibold text-gray-900">{success.bill.billNumber}</p>
                <p className="text-xs text-emerald-600 font-medium">₹{success.bill.totalAmount?.toFixed(2)}</p>
              </div>
            )}
            {success.prescription && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Prescription</p>
                <p className="font-semibold text-gray-900">Saved</p>
              </div>
            )}
            {success.payment && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Payment</p>
                <p className="font-semibold text-gray-900">₹{success.payment.amount?.toFixed(2)}</p>
              </div>
            )}
            {success.delivery && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">Delivery</p>
                <p className="font-semibold text-gray-900">{success.delivery.status}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-center">
            <button onClick={printReceipt} className="btn-secondary flex items-center gap-2">
              <Printer size={16} /> Print Receipt
            </button>
            <button onClick={resetAll} className="btn-primary flex items-center gap-2">
              <Plus size={16} /> New Transaction
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0 bg-white rounded-2xl p-1 border border-gray-200 shadow-sm">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.key;
          const isDone = currentIdx > i;
          return (
            <button
              key={s.key}
              onClick={() => { if (i < currentIdx) setStep(s.key); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                isActive ? "bg-indigo-600 text-white shadow-md" :
                isDone ? "text-emerald-600 hover:bg-emerald-50" :
                "text-gray-400"
              }`}
            >
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

      {/* Step 1: Customer */}
      {step === "customer" && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Find Customer</h2>
          <p className="text-sm text-gray-500 mb-6">Search by phone number to start a new transaction.</p>

          <div className="flex gap-3 mb-6">
            <div className="relative flex-1">
              <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={phoneRef}
                type="tel"
                placeholder="Enter phone number..."
                value={phoneSearch}
                onChange={(e) => setPhoneSearch(e.target.value)}
                onKeyDown={handlePhoneKeyDown}
                className="input-field pl-10 text-lg"
              />
            </div>
            <button onClick={searchCustomer} className="btn-primary px-6">
              <Search size={18} />
            </button>
          </div>

          {selectedCustomer && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-700 font-bold text-lg">
                    {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedCustomer.name}</p>
                    <p className="text-sm text-gray-500">{selectedCustomer.mobile}</p>
                    {selectedCustomer.email && <p className="text-xs text-gray-400">{selectedCustomer.email}</p>}
                  </div>
                </div>
                <span className="badge-green">Existing Customer</span>
              </div>
            </div>
          )}

          {isNewCustomer && !selectedCustomer && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
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
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
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

          <div className="flex justify-end mt-6">
            <button
              onClick={() => {
                if (selectedCustomer || isNewCustomer) setStep("examination");
                else searchCustomer();
              }}
              disabled={!canProceed()}
              className="btn-primary flex items-center gap-2"
            >
              Continue <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Examination */}
      {step === "examination" && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Eye Examination</h2>
              <p className="text-sm text-gray-500">Record today's visit and prescription.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={usePrescription} onChange={(e) => setUsePrescription(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              Skip prescription
            </label>
          </div>

          {usePrescription && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Doctor Name</label>
                  <input className="input-field" placeholder="Doctor's name" value={visitDoctor}
                    onChange={(e) => setVisitDoctor(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Visit Remarks</label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">PD (Pupillary Distance)</label>
                  <input className="input-field" placeholder="e.g. 62mm" value={prescription.pd}
                    onChange={(e) => setPrescription({ ...prescription, pd: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Prescription Notes</label>
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

      {/* Step 3: Order */}
      {step === "order" && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
              <p className="text-sm text-gray-500">Specify frame, lens, and accessories.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input type="checkbox" checked={useOrder} onChange={(e) => setUseOrder(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              No order needed
            </label>
          </div>

          {useOrder && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Frame</label>
                <input className="input-field" placeholder="Frame model/brand" value={orderFrame}
                  onChange={(e) => setOrderFrame(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Lens</label>
                <input className="input-field" placeholder="Lens type" value={orderLens}
                  onChange={(e) => setOrderLens(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Coating</label>
                <input className="input-field" placeholder="Coating type" value={orderCoating}
                  onChange={(e) => setOrderCoating(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                <input type="number" min="1" className="input-field" value={orderQty}
                  onChange={(e) => setOrderQty(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Accessories</label>
                <input className="input-field" placeholder="Comma separated" value={orderAccessories}
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
              Continue to Billing <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Billing */}
      {step === "billing" && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Billing</h2>
          <p className="text-sm text-gray-500 mb-6">Add items and set prices.</p>

          <div className="space-y-3 mb-4">
            {billItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start bg-gray-50 p-3 rounded-xl relative">
                <div className="flex-1 relative">
                  <input className="input-field text-sm" placeholder="Item description (start typing for suggestions)" value={item.description}
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
                <div className="w-20">
                  <input type="number" min="1" className="input-field text-sm text-center" placeholder="Qty" value={item.qty}
                    onChange={(e) => updateBillItem(idx, "qty", Number(e.target.value))} />
                </div>
                <div className="w-28">
                  <input type="number" min="0" step="0.01" className="input-field text-sm text-right" placeholder="Price" value={item.price}
                    onChange={(e) => updateBillItem(idx, "price", Number(e.target.value))} />
                </div>
                <div className="w-16 text-right pt-2.5 text-sm font-medium text-gray-700">
                  ₹{(item.qty * item.price).toFixed(0)}
                </div>
                <button onClick={() => removeBillItem(idx)} className="p-2 hover:bg-red-50 rounded-lg text-red-400 mt-1">
                  <X size={16} />
                </button>
              </div>
            ))}
            <button onClick={addBillItem} className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              <Plus size={16} /> Add Item
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Discount</label>
              <input type="number" min="0" step="0.01" className="input-field" value={billDiscount}
                onChange={(e) => setBillDiscount(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tax</label>
              <input type="number" min="0" step="0.01" className="input-field" value={billTax}
                onChange={(e) => setBillTax(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Advance Paid</label>
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
            {pendingAmount > 0 && <div className="flex justify-between text-amber-600 font-medium"><span>Pending</span><span>₹{pendingAmount.toFixed(2)}</span></div>}
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button onClick={() => setStep("order")} className="btn-secondary flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </button>
            <div className="flex gap-2">
              <button onClick={() => { setPaymentAmount(totalAmount); setStep("payment"); }}
                className="btn-primary flex items-center gap-2">
                Continue to Payment <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Payment */}
      {step === "payment" && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Payment</h2>
          <p className="text-sm text-gray-500 mb-6">Complete the transaction by recording payment.</p>

          <div className="bg-gray-50 rounded-xl p-6 mb-6 text-center">
            <p className="text-sm text-gray-500 mb-1">Total Amount</p>
            <p className="text-4xl font-bold text-gray-900">₹{totalAmount.toFixed(2)}</p>
            {pendingAmount > 0 && <p className="text-sm text-amber-600 mt-1">Pending: ₹{pendingAmount.toFixed(2)}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Amount</label>
              <input type="number" step="0.01" className="input-field text-lg font-bold" value={paymentAmount}
                onChange={(e) => setPaymentAmount(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {["Cash", "UPI", "Card", "Bank Transfer"].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPaymentMode(mode)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                      paymentMode === mode
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
              <input className="input-field" placeholder="Payment notes" value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)} />
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={useDelivery} onChange={(e) => setUseDelivery(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
              <div>
                <p className="text-sm font-medium text-amber-800">Schedule Delivery</p>
                <p className="text-xs text-amber-600">Set delivery address and expected date</p>
              </div>
            </label>
          </div>

          {useDelivery && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200">
            <button onClick={() => setStep("billing")} className="btn-secondary flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </button>
            <button
              onClick={saveTransaction}
              disabled={saving || paymentAmount <= 0}
              className="btn-success flex items-center gap-2 px-8 py-3 text-base"
            >
              {saving ? (
                <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
              ) : (
                <><Save size={18} /> Complete Transaction</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Customer summary bar */}
      {(step !== "customer" && step !== "done") && selectedCustomer && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 lg:pl-72">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm">
                {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-400">{selectedCustomer.mobile}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span className="hidden sm:inline">Step {currentIdx + 1} of 5</span>
              <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
                <div className="h-full bg-indigo-600 rounded-full transition-all"
                  style={{ width: `${((currentIdx + 1) / 5) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

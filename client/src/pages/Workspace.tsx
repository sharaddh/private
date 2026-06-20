import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import {
  Search, UserPlus, Phone, User, Eye, ShoppingCart,
  CreditCard, Truck, Check, ChevronRight, ChevronLeft, Save,
  X, Plus, Printer, ArrowRight, AlertCircle, MessageCircle,
  RotateCcw, Clock, DollarSign, Edit3, Info, RefreshCw,
  Calendar, Tag, Repeat, FileText, History, EyeOff
} from "lucide-react";

type Step = "customer" | "examination" | "order" | "billing" | "payment" | "done";

interface CustomerData {
  _id?: string; name: string; mobile: string; email?: string;
  address?: string; city?: string; age?: number; gender?: string;
  totalVisits?: number; totalSpent?: number; pendingAmount?: number; lastVisit?: string;
  createdAt?: string;
}

interface EyeData { sph?: number; cyl?: number; axis?: number; va?: string; }
interface EyeSet { dv?: EyeData; nv?: EyeData; pc?: EyeData; }

interface BillItem { description: string; qty: number; price: number; }

export default function Workspace() {
  const navigate = useNavigate();
  const phoneRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<any>(null);
  const [step, setStep] = useState<Step>("customer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<any>(null);

  // Customer summary cache for rich card
  const [customerSummary, setCustomerSummary] = useState<any>(null);

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
  const [visitShop, setVisitShop] = useState("");
  const [prevPrescription, setPrevPrescription] = useState<any>(null);
  const [prescription, setPrescription] = useState({
    rightEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    leftEye: { dv: {} as EyeData, nv: {} as EyeData, pc: {} as EyeData },
    pd: "", notes: "",
  });
  const [usePrescription, setUsePrescription] = useState(true);

  // Step 3: Order
  const [orderFrame, setOrderFrame] = useState("");
  const [orderFrameBrand, setOrderFrameBrand] = useState("");
  const [orderFrameModel, setOrderFrameModel] = useState("");
  const [orderFrameColor, setOrderFrameColor] = useState("");
  const [orderFrameSize, setOrderFrameSize] = useState("");
  const [orderFramePrice, setOrderFramePrice] = useState(0);
  const [orderLens, setOrderLens] = useState("");
  const [orderLensBrand, setOrderLensBrand] = useState("");
  const [orderLensType, setOrderLensType] = useState("Single Vision");
  const [orderLensIndex, setOrderLensIndex] = useState("");
  const [orderLensPrice, setOrderLensPrice] = useState(0);
  const [orderCoating, setOrderCoating] = useState("");
  const [orderCoatingPrice, setOrderCoatingPrice] = useState(0);
  const [orderAccessories, setOrderAccessories] = useState<{ name: string; price: number }[]>([]);
  const [showAddAccessory, setShowAddAccessory] = useState(false);
  const [newAccName, setNewAccName] = useState("");
  const [newAccPrice, setNewAccPrice] = useState(0);
  const [orderQty, setOrderQty] = useState(1);
  const [orderDeliveryDate, setOrderDeliveryDate] = useState("");
  const [useOrder, setUseOrder] = useState(true);

  // Step 4: Billing
  const [billItems, setBillItems] = useState<BillItem[]>([
    { description: "", qty: 1, price: 0 },
  ]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [billTax, setBillTax] = useState(0);
  const [advancePaid, setAdvancePaid] = useState(0);
  const [showBillPreview, setShowBillPreview] = useState(false);

  // Inventory suggestions
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggestionsForIdx, setSuggestionsForIdx] = useState<number | null>(null);
  const searchTimer = useRef<any>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Step 5: Payment (multiple payments)
  const [payments, setPayments] = useState<{ amount: number; mode: string; notes: string }[]>([
    { amount: 0, mode: "Cash", notes: "" },
  ]);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);

  // Step 6: Delivery
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [useDelivery, setUseDelivery] = useState(false);

  // Lab processing fields
  const [labAssigned, setLabAssigned] = useState("");
  const [labExpectedDate, setLabExpectedDate] = useState("");
  const [labRemarks, setLabRemarks] = useState("");

  useEffect(() => {
    phoneRef.current?.focus();
    api.get("/api/settings").then((d) => { if (d.success) setSettings(d.data); });
  }, []);

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
  const pendingAmt = totalAmount - advancePaid - totalPaid;
  const accessoriesTotal = orderAccessories.reduce((s, a) => s + a.price, 0);

  // Load previous prescription + order data for returning customer
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
      setVisitShop(last.shop || "");
    }
    if (prescRes.success && prescRes.data.length > 0) {
      const prev = prescRes.data[0];
      setPrevPrescription(prev);
      setPrescription({
        rightEye: prev.rightEye || { dv: {}, nv: {}, pc: {} },
        leftEye: prev.leftEye || { dv: {}, nv: {}, pc: {} },
        pd: prev.pd || "", notes: prev.notes || "",
      });
    }
    if (ordersRes.success && ordersRes.data.length > 0) {
      const last = ordersRes.data[0];
      setOrderFrame(last.frame || "");
      setOrderFrameBrand(last.frameBrand || "");
      setOrderFrameModel(last.frameModel || "");
      setOrderFrameColor(last.frameColor || "");
      setOrderFrameSize(last.frameSize || "");
      setOrderFramePrice(last.framePrice || 0);
      setOrderLens(last.lens || "");
      setOrderLensBrand(last.lensBrand || "");
      setOrderLensType(last.lensType || "Single Vision");
      setOrderLensIndex(last.lensIndex || "");
      setOrderLensPrice(last.lensPrice || 0);
      setOrderCoating(last.coating || "");
      setOrderCoatingPrice(last.coatingPrice || 0);
      if (last.accessories) setOrderAccessories(last.accessories.map((a: any) => typeof a === "string" ? { name: a, price: 0 } : a));
      setOrderQty(last.quantity || 1);
      setUseOrder(true);
    }
  }

  // Repeat Last Order — copies everything from last order into current form
  function repeatLastOrder(summary: any) {
    const o = summary?.lastOrder;
    if (!o) return;
    setOrderFrame(o.frame || "");
    setOrderFrameBrand(o.frameBrand || "");
    setOrderFrameModel(o.frameModel || "");
    setOrderFrameColor(o.frameColor || "");
    setOrderFrameSize(o.frameSize || "");
    setOrderFramePrice(o.framePrice || 0);
    setOrderLens(o.lens || "");
    setOrderLensBrand(o.lensBrand || "");
    setOrderLensType(o.lensType || "Single Vision");
    setOrderLensIndex(o.lensIndex || "");
    setOrderLensPrice(o.lensPrice || 0);
    setOrderCoating(o.coating || "");
    setOrderCoatingPrice(o.coatingPrice || 0);
    if (o.accessories) setOrderAccessories(o.accessories.map((a: any) => typeof a === "string" ? { name: a, price: 0 } : a));
    setOrderQty(o.quantity || 1);
    setUseOrder(true);
    // Copy pricing into bill
    const items: BillItem[] = [];
    if (o.frame) items.push({ description: `Frame - ${o.frame}`, qty: 1, price: o.framePrice || 0 });
    if (o.lens) items.push({ description: `Lens - ${o.lens}`, qty: 1, price: o.lensPrice || 0 });
    if (o.coating) items.push({ description: `Coating - ${o.coating}`, qty: 1, price: o.coatingPrice || 0 });
    if (o.accessories) {
      const accs = o.accessories.map((a: any) => typeof a === "string" ? { name: a, price: 0 } : a);
      accs.forEach((a: any) => items.push({ description: a.name, qty: 1, price: a.price || 0 }));
    }
    if (items.length > 0) setBillItems(items);
    // Copy prescription
    const p = summary?.lastPrescription;
    if (p) {
      setPrevPrescription(p);
      setPrescription({
        rightEye: p.rightEye || { dv: {}, nv: {}, pc: {} },
        leftEye: p.leftEye || { dv: {}, nv: {}, pc: {} },
        pd: p.pd || "", notes: p.notes || "",
      });
    }
    setStep("order");
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
      createdAt: c.createdAt,
    });
    setCustomerForm({
      name: c.name, mobile: c.mobile || "", email: c.email || "",
      address: c.address || "", city: c.city || "", age: c.age, gender: c.gender || "",
    });
    setDeliveryAddress(c.address || deliveryAddress);
    setIsNewCustomer(false);
    loadPreviousData(c._id);
    // Fetch rich summary
    api.get(`/api/customers/summary/${c._id}`).then((r) => {
      if (r.success) setCustomerSummary(r.data);
    });
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
          frame: orderFrame || undefined, frameBrand: orderFrameBrand || undefined,
          frameModel: orderFrameModel || undefined, frameColor: orderFrameColor || undefined,
          frameSize: orderFrameSize || undefined, framePrice: orderFramePrice || 0,
          lens: orderLens || undefined, lensBrand: orderLensBrand || undefined,
          lensType: orderLensType || undefined, lensIndex: orderLensIndex || undefined,
          lensPrice: orderLensPrice || 0,
          coating: orderCoating || undefined, coatingPrice: orderCoatingPrice || 0,
          accessories: orderAccessories.map((a) => a.name),
          quantity: orderQty, deliveryDate: orderDeliveryDate || undefined,
          labAssigned: labAssigned || undefined, labExpectedDate: labExpectedDate || undefined,
          labRemarks: labRemarks || undefined,
        };
      }

      const validItems = billItems.filter((i) => i.description && i.price > 0);
      if (validItems.length > 0) {
        payload.bill = {
          items: validItems.map((i) => ({ description: i.description, quantity: i.qty, unitPrice: i.price })),
          discount: billDiscount || 0, tax: billTax || 0, advancePaid: advancePaid || 0,
        };
      }

      const validPayments = payments.filter((p) => p.amount > 0);
      if (validPayments.length > 0) {
        payload.payment = {
          amount: totalPaid,
          paymentMode: validPayments[0].mode,
          notes: validPayments.map((p) => p.notes).filter(Boolean).join("; ") || undefined,
          entries: validPayments,
        };
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
    setSearchResults([]); setSearched(false); setCustomerSummary(null);
    setCustomerForm({ name: "", mobile: "", email: "", address: "", city: "", age: undefined, gender: "" });
    setVisitDoctor(""); setVisitRemarks(""); setVisitShop(""); setPrevPrescription(null);
    setPrescription({ rightEye: { dv: {}, nv: {}, pc: {} }, leftEye: { dv: {}, nv: {}, pc: {} }, pd: "", notes: "" });
    setOrderFrame(""); setOrderFrameBrand(""); setOrderFrameModel(""); setOrderFrameColor(""); setOrderFrameSize(""); setOrderFramePrice(0);
    setOrderLens(""); setOrderLensBrand(""); setOrderLensType("Single Vision"); setOrderLensIndex(""); setOrderLensPrice(0);
    setOrderCoating(""); setOrderCoatingPrice(0);
    setOrderAccessories([]); setOrderQty(1); setOrderDeliveryDate("");
    setUseOrder(true);
    setBillItems([{ description: "", qty: 1, price: 0 }]);
    setBillDiscount(0); setBillTax(0); setAdvancePaid(0); setShowBillPreview(false);
    setPayments([{ amount: 0, mode: "Cash", notes: "" }]);
    setDeliveryAddress(""); setDeliveryDate(""); setUseDelivery(false);
    setLabAssigned(""); setLabExpectedDate(""); setLabRemarks("");
    setError(""); setSuccess(null); setUsePrescription(true);
    phoneRef.current?.focus();
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

  function renderEyeFields(side: "rightEye" | "leftEye", label: string) {
    const data = prescription[side];
    return (
      <div className="border border-gray-200 dark:border-dark-700 rounded-xl p-4">
        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{label}</h4>
        {(["dv", "nv", "pc"] as const).map((type) => (
          <div key={type} className="mb-3">
            <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-1">
              {type === "dv" ? "Distance Vision" : type === "nv" ? "Near Vision" : "Peripheral Curve"}
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {(["sph", "cyl", "axis", "va"] as const).map((field) => {
                const changed = isChanged(side, type, field);
                const prevVal = getPrevValue(side, type, field);
                return (
                  <div key={field}>
                    <label className="text-[10px] text-gray-400 dark:text-gray-500 block">{field.toUpperCase()}</label>
                    <input type={field === "va" ? "text" : "number"} step={field === "va" ? undefined : "0.25"}
                      className={`input-field py-1.5 text-xs ${changed ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20 ring-1 ring-amber-300" : ""}`}
                      value={data[type]?.[field] ?? ""}
                      onChange={(e) => updateEye(side, type, field, e.target.value)} />
                    {changed && prevVal && <span className="text-[9px] text-amber-500 dark:text-amber-400 block mt-0.5">was {prevVal}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }

  function sendWhatsApp(phone: string, bill: any, customer: any, payment: any, order: any) {
    const num = phone.replace(/\D/g, "");
    if (!num) return;
    const shop = settings?.shopName || "KMJ Optical";
    const adminNum = settings?.adminWhatsApp?.replace(/\D/g, "") || "91";
    const items = (bill?.items || []).map((i: any) =>
      `${i.description} x${i.quantity || 1} = ₹${((i.quantity || 1) * (i.unitPrice || 0)).toFixed(0)}`
    ).join("%0a");
    const msg = `*${shop}* 🕶%0a%0a*Bill:* ${bill?.billNumber || ""}%0a*Date:* ${new Date().toLocaleDateString("en-IN")}%0a%0a*Customer:* ${customer?.name || ""}%0a*Mobile:* ${customer?.mobile || ""}%0a%0a*Items:*%0a${items}%0a%0a*Subtotal:* ₹${(bill?.subtotal || 0).toFixed(0)}%0a${bill?.discount ? `*Discount:* -₹${bill.discount.toFixed(0)}%0a` : ""}${bill?.tax ? `*Tax:* +₹${bill.tax.toFixed(0)}%0a` : ""}*Total:* ₹${(bill?.totalAmount || 0).toFixed(0)}%0a*Paid:* ₹${(bill?.advancePaid || 0).toFixed(0)}%0a*Pending:* ₹${(bill?.pendingAmount || 0).toFixed(0)}%0a%0a*Payment:* ${payment?.paymentMode || "Cash"}%0a%0a*Order:* ${order?.frame || ""} ${order?.lens || ""}${order?.coating ? ` + ${order.coating}` : ""}%0a%0aThank you for your visit! 🙏`;
    window.open(`https://wa.me/${adminNum}?text=${msg}`, "_blank");
  }

  function sendPickupWhatsApp(phone: string, order: any) {
    const num = phone.replace(/\D/g, "");
    if (!num) return;
    const shop = settings?.shopName || "KMJ Optical";
    const adminNum = settings?.adminWhatsApp?.replace(/\D/g, "") || "91";
    const msg = `*${shop}* 🕶%0a%0aHi ${selectedCustomer?.name || ""},%0aYour order is ready for pickup! 🎉%0a%0a*Order:* ${order?.frame || ""} ${order?.lens || ""}${order?.coating ? ` + ${order.coating}` : ""}%0a*Due Amount:* ₹${(success?.bill?.pendingAmount || 0).toFixed(0)}%0a%0aPlease visit our store to collect.%0aThank you! 🙏`;
    window.open(`https://wa.me/${adminNum}?text=${msg}`, "_blank");
  }

  const steps = [
    { key: "customer", label: "Customer", icon: User },
    { key: "examination", label: "Prescription", icon: Eye },
    { key: "order", label: "Products", icon: ShoppingCart },
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
      case "payment": return totalPaid > 0;
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
          <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-3">
            <Check size={28} className="text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Transaction Complete!</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Bill: {bill?.billNumber || ""}</p>
        </div>

        {/* Customer Info */}
        {customer && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Customer</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">{customer.name?.charAt(0) || "?"}</div>
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{customer.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{customer.mobile}</p>
              </div>
            </div>
          </div>
        )}

        {/* Prescription Summary */}
        {success.prescription && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Prescription</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Right Eye</p>
                {success.prescription.rightEye?.dv?.sph != null && <p>DV: {success.prescription.rightEye.dv.sph} {success.prescription.rightEye.dv.cyl != null ? `/ ${success.prescription.rightEye.dv.cyl}` : ""}</p>}
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Left Eye</p>
                {success.prescription.leftEye?.dv?.sph != null && <p>DV: {success.prescription.leftEye.dv.sph} {success.prescription.leftEye.dv.cyl != null ? `/ ${success.prescription.leftEye.dv.cyl}` : ""}</p>}
              </div>
              {success.prescription.pd && <div className="col-span-2"><p>PD: {success.prescription.pd}</p></div>}
            </div>
          </div>
        )}

        {/* Order Summary */}
        {order && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Order</h3>
            <div className="space-y-1 text-sm">
              {order.frame && <p><span className="text-gray-500 dark:text-gray-400">Frame:</span> {order.frame}</p>}
              {order.lens && <p><span className="text-gray-500 dark:text-gray-400">Lens:</span> {order.lens}</p>}
              {order.coating && <p><span className="text-gray-500 dark:text-gray-400">Coating:</span> {order.coating}</p>}
              {order.accessories?.length > 0 && <p><span className="text-gray-500 dark:text-gray-400">Accessories:</span> {order.accessories.join(", ")}</p>}
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
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bill</h3>
            <div className="space-y-1.5 text-sm">
              {(bill.items || []).map((it: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span>{it.description} x{it.quantity || 1}</span>
                  <span className="font-medium">₹{((it.quantity || 1) * (it.unitPrice || 0)).toFixed(0)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 dark:border-dark-700 pt-1.5 mt-1.5 space-y-0.5">
                <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Subtotal</span><span>₹{(bill.subtotal || 0).toFixed(0)}</span></div>
                {bill.discount > 0 && <div className="flex justify-between text-red-500 dark:text-red-400"><span>Discount</span><span>-₹{bill.discount.toFixed(0)}</span></div>}
                {bill.tax > 0 && <div className="flex justify-between text-amber-600 dark:text-amber-400"><span>Tax</span><span>+₹{bill.tax.toFixed(0)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 dark:text-white text-base pt-1"><span>Total</span><span>₹{(bill.totalAmount || 0).toFixed(0)}</span></div>
                {bill.advancePaid > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Paid</span><span>₹{bill.advancePaid.toFixed(0)}</span></div>}
                {bill.pendingAmount > 0 && <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium"><span>Pending</span><span>₹{bill.pendingAmount.toFixed(0)}</span></div>}
              </div>
            </div>
          </div>
        )}

        {/* Delivery */}
        {delivery && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Delivery</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
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
      <div className="flex items-center gap-0 bg-white dark:bg-dark-800 rounded-2xl p-1 border border-gray-200 dark:border-dark-700 shadow-sm">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.key;
          const isDone = currentIdx > i;
          return (
            <button key={s.key} onClick={() => { if (i < currentIdx) setStep(s.key); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-medium transition-all ${
                isActive ? "bg-primary-600 text-white shadow-md" :
                isDone ? "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30" :
                "text-gray-400 dark:text-gray-500"
              }`}>
              <Icon size={16} />
              <span className="hidden sm:inline">{s.label}</span>
              {isDone && <Check size={14} />}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* ===== STEP 1: CUSTOMER SEARCH ===== */}
      {step === "customer" && (
        <div className="flex gap-4">
          <div className="flex-1 space-y-4">
            <div className="card">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Find Customer</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Enter phone number to search existing customers or add new.</p>

              <div className="flex gap-3 mb-5">
                <div className="relative flex-1">
                  <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
                  <input ref={phoneRef} type="tel" placeholder="Enter phone number..."
                    value={phoneSearch} onChange={(e) => setPhoneSearch(e.target.value)}
                    onKeyDown={handlePhoneKeyDown} className="input-field pl-10 text-lg" />
                </div>
                <button onClick={searchCustomer} className="btn-primary px-6"><Search size={18} /></button>
              </div>

              {/* Multi-customer search results */}
              {searched && !selectedCustomer && searchResults.length > 0 && (
                <div className="space-y-3 mb-4">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{searchResults.length} customer(s) found</p>
                  {searchResults.map((c: any) => (
                    <div key={c._id}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/30 transition-all cursor-pointer"
                      onClick={() => selectCustomer(c)}>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">{c.name?.charAt(0)?.toUpperCase() || "?"}</div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{c.mobile}</p>
                          {c.lastVisit && <p className="text-xs text-gray-400 dark:text-gray-500">Last visit: {c.lastVisit}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 dark:text-gray-400">{c.totalVisits || 0} visits</p>
                        {(c.pendingAmount || 0) > 0 && <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">₹{c.pendingAmount} due</p>}
                        <span className="text-primary-600 dark:text-primary-400 text-sm font-medium mt-1 inline-block">Select →</span>
                      </div>
                    </div>
                  ))}

                  <button onClick={() => { setIsNewCustomer(true); setSelectedCustomer(null); setCustomerForm((prev) => ({ ...prev, name: "", email: "", address: "", city: "", age: undefined, gender: "" })); }}
                    className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium text-sm w-full justify-center py-2 border border-dashed border-primary-200 dark:border-primary-800 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20">
                    <UserPlus size={16} /> Add new customer with this number
                  </button>
                </div>
              )}

              {/* Add new customer form */}
              {searched && !selectedCustomer && searchResults.length === 0 && isNewCustomer && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-4">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-3">New customer — fill in the details</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Name *</label>
                      <input className="input-field" placeholder="Full name" value={customerForm.name}
                        onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                      <input className="input-field" value={customerForm.mobile} disabled />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email</label>
                      <input className="input-field" placeholder="email@example.com" value={customerForm.email || ""}
                        onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Age</label>
                      <input type="number" className="input-field" placeholder="Age" value={customerForm.age ?? ""}
                        onChange={(e) => setCustomerForm({ ...customerForm, age: e.target.value ? Number(e.target.value) : undefined })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Gender</label>
                      <select className="input-field" value={customerForm.gender || ""}
                        onChange={(e) => setCustomerForm({ ...customerForm, gender: e.target.value })}>
                        <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">City</label>
                      <input className="input-field" placeholder="City" value={customerForm.city || ""}
                        onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Address</label>
                      <input className="input-field" placeholder="Address" value={customerForm.address || ""}
                        onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <button onClick={() => { if (selectedCustomer || isNewCustomer) setStep("examination"); else searchCustomer(); }}
                  disabled={!canProceed()} className="btn-primary flex items-center gap-2">
                  Start New Visit <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Rich Customer Card */}
            {selectedCustomer && customerSummary && (
              <div className="card">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl shadow-md">
                      {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">{selectedCustomer.name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        <span>{selectedCustomer.gender || "—"}</span>
                        {selectedCustomer.age && <span>• {selectedCustomer.age} yrs</span>}
                        <span>•</span>
                        <span><Phone size={12} className="inline" /> {selectedCustomer.mobile}</span>
                        <span>•</span>
                        <span className="text-primary-600 dark:text-primary-400 font-medium">ID: {customerSummary.customer?.customerId || ""}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${selectedCustomer.pendingAmount && selectedCustomer.pendingAmount > 0 ? "badge-yellow" : "badge-green"}`}>
                    {selectedCustomer.pendingAmount && selectedCustomer.pendingAmount > 0 ? `₹${selectedCustomer.pendingAmount} Due` : "Cleared"}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-3 mb-4">
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedCustomer.totalVisits || 0}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Visits</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-primary-600 dark:text-primary-400">₹{(selectedCustomer.totalSpent || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Revenue</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-amber-600 dark:text-amber-400">₹{(selectedCustomer.pendingAmount || 0).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Pending</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-3 text-center">
                    <p className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      {selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">Since</p>
                  </div>
                </div>

                {/* Last Order Info */}
                {customerSummary.lastOrder && (
                  <div className="bg-gradient-to-r from-gray-50 dark:from-dark-700 to-primary-50 dark:to-primary-900/20 rounded-xl p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">Last Purchase</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {customerSummary.lastOrder.frame && `Frame: ${customerSummary.lastOrder.frame}`}
                          {customerSummary.lastOrder.frame && customerSummary.lastOrder.lens && " | "}
                          {customerSummary.lastOrder.lens && `Lens: ${customerSummary.lastOrder.lens}`}
                        </p>
                      </div>
                      <span className={`badge ${
                        customerSummary.lastOrder.status === "Delivered" ? "badge-green" :
                        customerSummary.lastOrder.status === "Ready" ? "badge-blue" :
                        customerSummary.lastOrder.status === "In Lab" ? "badge-yellow" : "badge-gray"
                      }`}>{customerSummary.lastOrder.status || "Draft"}</span>
                    </div>
                    {customerSummary.lastPrescription?.rightEye?.dv?.sph != null && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Last Rx: {customerSummary.lastPrescription.rightEye.dv.sph} / {customerSummary.lastPrescription.leftEye?.dv?.sph || ""}</p>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setStep("examination")} className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2">
                    <Eye size={15} /> New Visit
                  </button>
                  <button onClick={() => navigate(`/customers/${selectedCustomer._id}`)} className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2">
                    <History size={15} /> Full History
                  </button>
                  {customerSummary.lastOrder && (
                    <button onClick={() => repeatLastOrder(customerSummary)} className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2">
                      <Repeat size={15} /> Repeat Last Order
                    </button>
                  )}
                  {selectedCustomer.mobile && (
                    <button onClick={() => window.open(`https://wa.me/91${selectedCustomer.mobile.replace(/\D/g, "")}?text=Hi ${selectedCustomer.name}, this is KMJ Optical.`, "_blank")}
                      className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2">
                      <MessageCircle size={15} /> WhatsApp
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Customer Timeline */}
            {customerSummary?.recentOrders && customerSummary.recentOrders.length > 0 && (
              <div className="card">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Clock size={14} /> Recent Activity</h3>
                <div className="space-y-2">
                  {(customerSummary.recentOrders || []).slice(0, 5).map((o: any) => (
                    <div key={o._id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-dark-700 last:border-0">
                      <div>
                        <p className="text-sm text-gray-800">
                          {o.frame || ""}{o.frame && o.lens ? " + " : ""}{o.lens || ""}{o.coating ? " + " + o.coating : ""}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}</p>
                      </div>
                      <span className={`badge ${
                        o.status === "Delivered" ? "badge-green" :
                        o.status === "Ready" ? "badge-blue" :
                        o.status === "In Lab" ? "badge-yellow" : "badge-gray"
                      }`}>{o.status || "Draft"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right sidebar - Customer Info when selected */}
          {selectedCustomer && customerSummary && (
            <div className="w-72 hidden lg:block space-y-4">
              <div className="card">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Last Prescription</h3>
                {customerSummary.lastPrescription ? (
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Right Eye</p>
                      <p className="font-medium">
                        {customerSummary.lastPrescription.rightEye?.dv?.sph != null
                          ? `SPH ${customerSummary.lastPrescription.rightEye.dv.sph}`
                          : "—"}
                        {customerSummary.lastPrescription.rightEye?.dv?.cyl != null
                          ? ` CYL ${customerSummary.lastPrescription.rightEye.dv.cyl}`
                          : ""}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Left Eye</p>
                      <p className="font-medium">
                        {customerSummary.lastPrescription.leftEye?.dv?.sph != null
                          ? `SPH ${customerSummary.lastPrescription.leftEye.dv.sph}`
                          : "—"}
                        {customerSummary.lastPrescription.leftEye?.dv?.cyl != null
                          ? ` CYL ${customerSummary.lastPrescription.leftEye.dv.cyl}`
                          : ""}
                      </p>
                    </div>
                    {customerSummary.lastPrescription.pd && <p className="text-xs text-gray-500 dark:text-gray-400">PD: {customerSummary.lastPrescription.pd}</p>}
                  </div>
                ) : <p className="text-sm text-gray-400 dark:text-gray-500">No previous prescription</p>}
              </div>

              {customerSummary.lastVisit && (
                <div className="card">
                  <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Last Visit</h3>
                  <p className="text-sm">{customerSummary.lastVisit.doctorName ? `Dr. ${customerSummary.lastVisit.doctorName}` : "—"}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{new Date(customerSummary.lastVisit.visitDate || customerSummary.lastVisit.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                  {customerSummary.lastVisit.remarks && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{customerSummary.lastVisit.remarks}</p>}
                </div>
              )}

              <div className="card">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Quick Stats</h3>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">In Lab</span><span className="font-medium">{customerSummary.labOrders || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Ready</span><span className="font-medium">{customerSummary.readyOrders || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Total Spent</span><span className="font-medium">₹{(selectedCustomer.totalSpent || 0).toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== STEP 2: EXAMINATION ===== */}
      {step === "examination" && (
        <div className="card">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Eye Examination</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Record today's prescription. Previous values are pre-filled.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
              <input type="checkbox" checked={!usePrescription} onChange={(e) => setUsePrescription(!e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-700 text-primary-600 dark:text-primary-400 focus:ring-primary-500" />
              Skip
            </label>
          </div>

          {usePrescription && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Visit Date</label>
                  <input type="date" className="input-field" defaultValue={new Date().toISOString().split("T")[0]} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Doctor</label>
                  <input className="input-field" placeholder="Doctor's name" value={visitDoctor}
                    onChange={(e) => setVisitDoctor(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Shop</label>
                  <input className="input-field" placeholder="Shop/location" value={visitShop}
                    onChange={(e) => setVisitShop(e.target.value)} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes / Remarks</label>
                  <input className="input-field" placeholder="Any remarks" value={visitRemarks}
                    onChange={(e) => setVisitRemarks(e.target.value)} />
                </div>
              </div>
              {prevPrescription && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 mb-4 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                  <Info size={14} /> Previous values are pre-filled. Changed fields are highlighted in amber.
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderEyeFields("rightEye", "Right Eye")}
                {renderEyeFields("leftEye", "Left Eye")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">PD</label>
                  <input className="input-field" placeholder="e.g. 62mm" value={prescription.pd}
                    onChange={(e) => setPrescription({ ...prescription, pd: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notes</label>
                  <input className="input-field" placeholder="Additional notes" value={prescription.notes}
                    onChange={(e) => setPrescription({ ...prescription, notes: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button onClick={() => setStep("customer")} className="btn-secondary flex items-center gap-2">
              <ChevronLeft size={16} /> Back
            </button>
            <button onClick={() => setStep("order")} className="btn-primary flex items-center gap-2">
              Continue <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: PRODUCTS (ORDER) ===== */}
      {step === "order" && (
        <div className="flex gap-4">
          <div className="flex-1 space-y-4">
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Products</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Select frame, lens, coating, and accessories.</p>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={!useOrder} onChange={(e) => setUseOrder(!e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-dark-700 text-primary-600 dark:text-primary-400 focus:ring-primary-500" />
                  No items
                </label>
              </div>

              {useOrder && (
                <div className="space-y-6">
                  {/* Frame Section */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Tag size={14} /> Frame</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Brand</label>
                        <input className="input-field" placeholder="e.g. RayBan" value={orderFrameBrand}
                          onChange={(e) => setOrderFrameBrand(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Model</label>
                        <input className="input-field" placeholder="e.g. RB2180" value={orderFrameModel}
                          onChange={(e) => setOrderFrameModel(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Color</label>
                        <input className="input-field" placeholder="e.g. Black" value={orderFrameColor}
                          onChange={(e) => setOrderFrameColor(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Size</label>
                        <input className="input-field" placeholder="e.g. 52-18" value={orderFrameSize}
                          onChange={(e) => setOrderFrameSize(e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frame (summary)</label>
                        <input className="input-field" placeholder="Frame description" value={orderFrame}
                          onChange={(e) => setOrderFrame(e.target.value)} />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Frame Price (₹)</label>
                        <input type="number" min="0" step="0.01" className="input-field" placeholder="0" value={orderFramePrice}
                          onChange={(e) => setOrderFramePrice(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>

                  {/* Lens Section */}
                  <div className="border-t border-gray-100 dark:border-dark-700 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2"><Eye size={14} /> Lens</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Brand</label>
                        <input className="input-field" placeholder="Lens brand" value={orderLensBrand}
                          onChange={(e) => setOrderLensBrand(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                        <select className="input-field" value={orderLensType}
                          onChange={(e) => setOrderLensType(e.target.value)}>
                          <option>Single Vision</option>
                          <option>Bifocal</option>
                          <option>Progressive</option>
                          <option>Blue Cut</option>
                          <option>Photochromic</option>
                          <option>Polarized</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Index</label>
                        <input className="input-field" placeholder="e.g. 1.56" value={orderLensIndex}
                          onChange={(e) => setOrderLensIndex(e.target.value)} />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Lens (summary)</label>
                        <input className="input-field" placeholder="e.g. Anti-glare" value={orderLens}
                          onChange={(e) => setOrderLens(e.target.value)} />
                      </div>
                      <div className="col-span-2 md:col-span-4">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Lens Price (₹)</label>
                        <input type="number" min="0" step="0.01" className="input-field" placeholder="0" value={orderLensPrice}
                          onChange={(e) => setOrderLensPrice(Number(e.target.value))} />
                      </div>
                    </div>
                  </div>

                  {/* Coating Section */}
                  <div className="border-t border-gray-100 dark:border-dark-700 pt-4">
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

                  {/* Accessories Section */}
                  <div className="border-t border-gray-100 dark:border-dark-700 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Accessories</h3>
                    {orderAccessories.map((acc, idx) => (
                      <div key={idx} className="flex gap-2 mb-2 items-center">
                        <input className="input-field flex-1" placeholder="Item name" value={acc.name}
                          onChange={(e) => {
                            const updated = [...orderAccessories];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setOrderAccessories(updated);
                          }} />
                        <input type="number" min="0" className="input-field w-24" placeholder="Price" value={acc.price}
                          onChange={(e) => {
                            const updated = [...orderAccessories];
                            updated[idx] = { ...updated[idx], price: Number(e.target.value) };
                            setOrderAccessories(updated);
                          }} />
                        <button onClick={() => setOrderAccessories(orderAccessories.filter((_, i) => i !== idx))}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 dark:text-red-300"><X size={15} /></button>
                      </div>
                    ))}
                    <button onClick={() => setOrderAccessories([...orderAccessories, { name: "", price: 0 }])}
                      className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
                      <Plus size={14} /> Add Accessory
                    </button>
                  </div>

                  {/* Quantity & Delivery */}
                  <div className="border-t border-gray-100 dark:border-dark-700 pt-4 grid grid-cols-2 gap-3">
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
                </div>
              )}

              <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-dark-700">
                <button onClick={() => setStep("examination")} className="btn-secondary flex items-center gap-2">
                  <ChevronLeft size={16} /> Back
                </button>
                <button onClick={() => setStep("billing")} className="btn-primary flex items-center gap-2">
                  Continue to Bill <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Live Order Summary sidebar */}
          <div className="w-72 hidden lg:block">
            <div className="card sticky top-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Order Summary</h3>
              <div className="space-y-2 text-sm">
                {useOrder && orderFrame && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Frame</span><span className="font-medium">₹{orderFramePrice.toFixed(0)}</span></div>
                )}
                {useOrder && orderLens && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Lens</span><span className="font-medium">₹{orderLensPrice.toFixed(0)}</span></div>
                )}
                {useOrder && orderCoating && (
                  <div className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">Coating</span><span className="font-medium">₹{orderCoatingPrice.toFixed(0)}</span></div>
                )}
                {orderAccessories.filter((a) => a.name).map((a, i) => (
                  <div key={i} className="flex justify-between"><span className="text-gray-600 dark:text-gray-400">{a.name}</span><span className="font-medium">₹{a.price.toFixed(0)}</span></div>
                ))}
                <div className="border-t border-gray-200 dark:border-dark-700 pt-2 mt-2">
                  <div className="flex justify-between font-bold text-gray-900 dark:text-white"><span>Subtotal</span><span>₹{(orderFramePrice + orderLensPrice + orderCoatingPrice + accessoriesTotal).toFixed(0)}</span></div>
                  <div className="flex justify-between text-gray-500 dark:text-gray-400 text-xs mt-1"><span>Qty</span><span>{orderQty}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP 4: BILLING ===== */}
      {step === "billing" && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Billing</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Add items and set prices. Order items are pre-filled.</p>

          <div className="space-y-3 mb-4">
            {billItems.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-start bg-gray-50 dark:bg-dark-700 p-3 rounded-xl relative">
                <div className="flex-1 relative">
                  <input className="input-field text-sm" placeholder="Item description (type for suggestions)" value={item.description}
                    onChange={(e) => { updateBillItem(idx, "description", e.target.value); searchInventory(e.target.value, idx); }} />
                  {suggestionsForIdx === idx && suggestions.length > 0 && (
                    <div ref={suggestionRef} className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((inv: any) => (
                        <button key={inv._id} type="button" onClick={() => applySuggestion(idx, inv)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left border-b border-gray-100 dark:border-dark-700 last:border-0">
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">{inv.brand && inv.model ? `${inv.brand} ${inv.model}` : inv.sku}</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500">{inv.category || ""}{inv.color ? ` | ${inv.color}` : ""}</p>
                          </div>
                          <span className="font-semibold text-primary-600 dark:text-primary-400">₹{inv.sellingPrice || 0}</span>
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
                <div className="w-16 text-right pt-2.5 text-sm font-medium text-gray-700 dark:text-gray-300">₹{(item.qty * item.price).toFixed(0)}</div>
                <button onClick={() => removeBillItem(idx)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400 dark:text-red-300 mt-1"><X size={16} /></button>
              </div>
            ))}
            <button onClick={addBillItem} className="flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
              <Plus size={16} /> Add Item
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
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
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Expected Delivery</label>
              <input type="date" className="input-field" value={orderDeliveryDate}
                onChange={(e) => setOrderDeliveryDate(e.target.value)} />
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-dark-700 rounded-xl p-4 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
            {billDiscount > 0 && <div className="flex justify-between text-red-600 dark:text-red-400"><span>Discount</span><span>-₹{billDiscount.toFixed(2)}</span></div>}
            {billTax > 0 && <div className="flex justify-between text-amber-600 dark:text-amber-400"><span>Tax</span><span>+₹{billTax.toFixed(2)}</span></div>}
            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t border-gray-200 dark:border-dark-700">
              <span>Total</span><span>₹{totalAmount.toFixed(2)}</span>
            </div>
            {advancePaid > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Advance</span><span>-₹{advancePaid.toFixed(2)}</span></div>}
            {pendingAmt > 0 && <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium"><span>Pending</span><span>₹{pendingAmt.toFixed(2)}</span></div>}
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button onClick={() => setStep("order")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> Back</button>
            <div className="flex gap-2">
              <button onClick={() => setShowBillPreview(true)} className="btn-secondary flex items-center gap-2">
                <Eye size={16} /> Preview Bill
              </button>
              <button onClick={() => setStep("payment")}
                className="btn-primary flex items-center gap-2">
                Continue to Payment <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== STEP 5: PAYMENT ===== */}
      {step === "payment" && (
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Payment</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Collect payment and complete the transaction.</p>

          <div className="bg-gradient-to-r from-primary-50 dark:from-primary-900/30 to-purple-50 dark:to-purple-900/20 rounded-xl p-6 mb-5">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">₹{totalAmount.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Advance</p>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">₹{advancePaid.toFixed(0)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Balance</p>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">₹{Math.max(0, pendingAmt).toFixed(0)}</p>
              </div>
            </div>
          </div>

          {/* Multiple payments */}
          <div className="space-y-3 mb-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Payments ({payments.length})</h3>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total: ₹{totalPaid.toFixed(0)}</p>
            </div>
            {payments.map((p, idx) => (
              <div key={idx} className="bg-gray-50 dark:bg-dark-700 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">#{idx + 1}</span>
                  <div className="flex-1" />
                  <button onClick={() => { if (payments.length > 1) setPayments(payments.filter((_, i) => i !== idx)); }}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400 dark:text-red-300"><X size={14} /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Amount</label>
                    <input type="number" step="0.01" className="input-field text-sm font-medium" value={p.amount}
                      onChange={(e) => {
                        const updated = [...payments];
                        updated[idx] = { ...updated[idx], amount: Number(e.target.value) };
                        setPayments(updated);
                      }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Mode</label>
                    <div className="grid grid-cols-2 gap-1">
                      {["Cash", "UPI", "Card"].map((mode) => (
                        <button key={mode} onClick={() => {
                          const updated = [...payments];
                          updated[idx] = { ...updated[idx], mode };
                          setPayments(updated);
                        }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                            p.mode === mode ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-700"
                          }`}>{mode}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-0.5">Notes</label>
                    <input className="input-field text-xs" placeholder="Optional" value={p.notes}
                      onChange={(e) => {
                        const updated = [...payments];
                        updated[idx] = { ...updated[idx], notes: e.target.value };
                        setPayments(updated);
                      }} />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={() => setPayments([...payments, { amount: 0, mode: "Cash", notes: "" }])}
              className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 font-medium">
              <Plus size={14} /> Add Another Payment
            </button>
          </div>

          {/* Balance status */}
          {totalPaid > 0 && (
            <div className={`rounded-xl p-3 mb-5 text-center text-sm font-medium ${
              totalPaid + advancePaid >= totalAmount ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
            }`}>
              {totalPaid + advancePaid >= totalAmount
                ? "✓ Full payment received"
                : `Pending collection: ₹${Math.max(0, pendingAmt).toFixed(0)}`}
            </div>
          )}

          {/* Delivery section */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={useDelivery} onChange={(e) => setUseDelivery(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 dark:border-dark-700 text-primary-600 dark:text-primary-400 focus:ring-primary-500" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Schedule Delivery</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">Set delivery address and expected date</p>
              </div>
            </label>
            {useDelivery && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Delivery Address</label>
                  <textarea className="input-field" rows={2} value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Expected Delivery Date</label>
                  <input type="date" className="input-field" value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between mt-6 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button onClick={() => setStep("billing")} className="btn-secondary flex items-center gap-2"><ChevronLeft size={16} /> Back</button>
            <button onClick={saveTransaction} disabled={saving || totalPaid <= 0}
              className="btn-success flex items-center gap-2 px-8 py-3 text-base">
              {saving ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Saving...</>
              : <><Save size={18} /> Save & Generate Order</>}
            </button>
          </div>
        </div>
      )}

      {/* ===== DIGITAL BILL PREVIEW MODAL ===== */}
      {showBillPreview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowBillPreview(false)}>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Digital Bill Preview</h2>
              <button onClick={() => setShowBillPreview(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"><X size={18} /></button>
            </div>

            <div className="text-center mb-6">
              <h3 className="font-bold text-xl">KMJ Optical</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Bill Preview</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
            </div>

            {selectedCustomer && (
              <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 dark:bg-dark-700 rounded-xl">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold">{selectedCustomer.name?.charAt(0) || "?"}</div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedCustomer.mobile}</p>
                </div>
              </div>
            )}

            <div className="space-y-1.5 mb-4">
              {billItems.filter((i) => i.description).map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-100 dark:border-dark-700">
                  <span>{item.description} x{item.qty}</span>
                  <span className="font-medium">₹{(item.qty * item.price).toFixed(0)}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 dark:border-dark-700 pt-2 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span></div>
              {billDiscount > 0 && <div className="flex justify-between text-red-600 dark:text-red-400"><span>Discount</span><span>-₹{billDiscount.toFixed(0)}</span></div>}
              {billTax > 0 && <div className="flex justify-between text-amber-600 dark:text-amber-400"><span>GST</span><span>+₹{billTax.toFixed(0)}</span></div>}
              <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-200 dark:border-dark-700"><span>Total</span><span>₹{totalAmount.toFixed(0)}</span></div>
              {advancePaid > 0 && <div className="flex justify-between text-emerald-600 dark:text-emerald-400"><span>Advance</span><span>₹{advancePaid.toFixed(0)}</span></div>}
              {pendingAmt > 0 && <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium"><span>Balance</span><span>₹{pendingAmt.toFixed(0)}</span></div>}
            </div>

            {orderDeliveryDate && <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-4">Expected Delivery: {new Date(orderDeliveryDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>}

            <div className="flex justify-center mt-6">
              <button onClick={() => setShowBillPreview(false)} className="btn-primary">Close Preview</button>
            </div>
          </div>
        </div>
      )}

      {/* Summary bar - always visible with current data */}
      {(step !== "customer" && step !== "done") && selectedCustomer && (
        <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-dark-800 border-t border-gray-200 dark:border-dark-700 p-3 lg:pl-72 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">
                {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{selectedCustomer.mobile} {orderFrame && `• ${orderFrame}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {totalAmount > 0 && <span className="font-semibold text-gray-900 dark:text-white">₹{totalAmount.toFixed(0)}</span>}
              <span className="text-gray-400 dark:text-gray-500 hidden sm:inline">Step {currentIdx + 1} of 5</span>
              <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden hidden sm:block">
                <div className="h-full bg-primary-600 rounded-full transition-all" style={{ width: `${((currentIdx + 1) / 5) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api";
import { useToast } from "../context/ToastContext";
import { useTranslate } from "../context/TranslateContext";
import PageSkeleton from "../components/PageSkeleton";
import Modal from "../components/Modal";
import CameraScanner from "../components/CameraScanner";
import {
  Activity, Eye, ShoppingCart, CreditCard, Percent, CheckCircle,
  Search, Phone, UserPlus, Users, ArrowRight, X, ScanLine,
  User, Tag, Repeat, History, MessageCircle, RefreshCw, Clock,
  IndianRupee, AlertCircle, Check, Loader2,
} from "lucide-react";
import PageHeader from "../components/NewvistePage/PageHeader";
import VisitStepper from "../components/NewvistePage/VisitStepper";
import VisitTypeSection from "../components/NewvistePage/VisitTypeSection";
import PrescriptionPanel from "../components/NewvistePage/PrescriptionPanel";
import OrderItems from "../components/NewvistePage/OrderItems";
import BillingPanel from "../components/NewvistePage/BillingPanel";
import { formatRxBrief, cleanEyeSet } from "../utils/rx";
import PaymentPanel from "../components/NewvistePage/PaymentPanel";
import ConfirmationDashboard from "../components/NewvistePage/ConfirmationDashboard";
import BottomNav from "../components/NewvistePage/BottomNav";

interface CustomerData {
  _id?: string; name: string; mobile: string; email?: string;
  address?: string; city?: string; age?: number; gender?: string;
  totalVisits?: number; totalSpent?: number; pendingAmount?: number; lastVisit?: string;
  createdAt?: string;
}

export default function Workspace() {
  const navigate = useNavigate();
  const toast = useToast();
  const { t, uiT } = useTranslate();

  const VISIT_TYPES = [
    { value: "new", label: uiT("New Glasses", "नए चश्मे"), icon: Eye },
    { value: "frame_change", label: uiT("Frame Change", "फ्रेम बदलें"), icon: RefreshCw },
    { value: "new_lens", label: uiT("New Lens", "नया लेंस"), icon: Eye },
    { value: "contact_lens", label: uiT("Contact Lens", "कॉन्टैक्ट लेंस"), icon: Eye },
    { value: "service", label: uiT("Service", "सेवा"), icon: Activity },
    { value: "other", label: uiT("Other", "अन्य"), icon: Eye },
  ];
  const phoneRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
  const [customerSummary, setCustomerSummary] = useState<any>(null);
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const [customerForm, setCustomerForm] = useState<CustomerData>({
    name: "", mobile: "", email: "", address: "", city: "", age: undefined, gender: "",
  });

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
  const countdownRef = useRef<any>(null);
  const savingRef = useRef(false);
  const greetingSent = useRef(false);

  const isServiceType = visitType === "service" || visitType === "other";
  const steps = [
    { key: "service", label: uiT("Service", "सेवा"), icon: Activity, desc: uiT("Visit type", "विज़िट प्रकार") },
    ...(!isServiceType ? [
      { key: "prescription", label: uiT("Examination", "जांच"), icon: Eye, desc: uiT("Vision test", "दृष्टि परीक्षण") },
      { key: "order", label: uiT("Order", "ऑर्डर"), icon: ShoppingCart, desc: uiT("Frame & lens", "फ्रेम और लेंस") },
    ] : []),
    { key: "billing", label: uiT("Billing", "बिलिंग"), icon: CreditCard, desc: uiT("Items & pricing", "आइटम और मूल्य निर्धारण") },
    { key: "payment", label: uiT("Payment", "भुगतान"), icon: Percent, desc: uiT("Collect & confirm", "संग्रह और पुष्टि") },
    { key: "confirmation", label: uiT("Confirm", "पुष्टि करें"), icon: CheckCircle, desc: uiT("Review & save", "समीक्षा और सहेजें") },
  ];

  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // Redirect away from removed steps when visitType changes
  useEffect(() => {
    if (isServiceType && (step === "prescription" || step === "order")) {
      setStep("billing");
    }
  }, [visitType]);

  useEffect(() => {
    phoneRef.current?.focus();
    api.get("/api/settings").then((d) => { if (d.success) setSettings(d.data); setLoadingSettings(false); });
  }, []);

  // Calculate Total Bill dynamically
  useEffect(() => {
    const total = billItems.reduce((s, i) => s + i.price * i.qty, 0);
    setTotalAmount(total);
  }, [billItems]);

  // Auto-sync order to bill
  useEffect(() => {
    if (!selectedCustomer) return;

    const autoItems: Array<{ description: string; price: number; qty: number }> = [];

    orderFrames.forEach((f) => {
      if (f.brand || f.model || f.price > 0 || f.sku) {
        autoItems.push({
          description: `Frame: ${f.brand} ${f.model} ${f.color ? `(${f.color})` : ""}`.trim(),
          price: Number(f.price) || 0,
          qty: 1,
        });
      }
    });

    orderLenses.forEach((l) => {
      if (l.brand || l.features.length > 0 || l.price > 0 || l.sku) {
        const featuresStr = l.features.length > 0 ? l.features.join(" + ") : "Standard";
        const indexStr = l.index ? `(Index: ${l.index})` : "";
        autoItems.push({
          description: `Lens: ${l.brand} ${featuresStr} ${indexStr}`.replace(/\s+/g, " ").trim(),
          price: Number(l.price) || 0,
          qty: 1,
        });
      }
    });

    orderAccessories.forEach((a) => {
      if (a.name || a.price > 0) {
        autoItems.push({
          description: `Acc: ${a.name || "Accessory"}`,
          price: Number(a.price) || 0,
          qty: 1,
        });
      }
    });

    setBillItems((prev) => {
      const manualItems = prev.filter((p) =>
        !p.description.startsWith("Frame:") &&
        !p.description.startsWith("Lens:") &&
        !p.description.startsWith("Acc:")
      );
      return [...autoItems, ...manualItems];
    });
  }, [orderFrames, orderLenses, orderAccessories, selectedCustomer]);

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

  async function searchCustomer() {
    const num = phoneSearch.replace(/\D/g, "");
    if (num.length < 3) return;
    setSelectedCustomer(null);
    setIsNewCustomer(false);
    setSearched(true);
    const res = await api.get(`/api/customers?phone=${encodeURIComponent(num)}`);
    if (res.success && res.data.length > 0) {
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
    const cust: CustomerData = {
      _id: c._id, name: c.name, mobile: c.mobile || "", email: c.email || "",
      address: c.address || "", city: c.city || "", age: c.age, gender: c.gender || "",
      totalVisits: c.totalVisits, totalSpent: c.totalSpent, pendingAmount: c.pendingAmount, lastVisit: c.lastVisit,
      createdAt: c.createdAt,
    };
    setSelectedCustomer(cust);
    setCustomerForm({
      name: c.name, mobile: c.mobile || "", email: c.email || "",
      address: c.address || "", city: c.city || "", age: c.age, gender: c.gender || "",
    });
    setDeliveryAddress(c.address || deliveryAddress);
    setIsNewCustomer(false);

    api.get(`/api/customers/summary/${c._id}`).then((r) => {
      if (r.success) setCustomerSummary(r.data);
    });

    loadPreviousData(c._id);
  }

  async function loadPreviousData(customerId: string) {
    const [visitsRes, prescRes, ordersRes] = await Promise.all([
      api.get(`/api/visits?customerId=${customerId}`),
      api.get(`/api/prescriptions?customerId=${customerId}`),
      api.get(`/api/orders?customerId=${customerId}`),
    ]);
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

  function repeatLastOrder(summary: any) {
    const o = summary?.lastOrder;
    if (!o) return;
    setOrderFrames([{ sku: o.frame || "", brand: o.frameBrand || "", model: o.frameModel || "", color: o.frameColor || "", price: o.framePrice || 0 }]);
    setOrderLenses([{ sku: o.lens || "", brand: o.lensBrand || "", features: o.lensType ? o.lensType.split(", ") : [], index: o.lensIndex || "", price: o.lensPrice || 0, coating: o.coating || "" }]);
    if (o.accessories) setOrderAccessories(o.accessories.map((a: any) => typeof a === "string" ? { name: a, price: 0 } : a));

    const items: Array<{ description: string; qty: number; price: number }> = [];
    if (o.frame) items.push({ description: `Frame: ${o.frameBrand || ""} ${o.frameModel || ""}`.trim(), qty: 1, price: o.framePrice || 0 });
    if (o.lens) items.push({ description: `Lens: ${o.lensBrand || ""} ${o.lensType || ""}`.trim(), qty: 1, price: o.lensPrice || 0 });
    if (o.coating) items.push({ description: `Coating: ${o.coating}`, qty: 1, price: o.coatingPrice || 0 });
    if (items.length > 0) setBillItems(items);

    const p = summary?.lastPrescription;
    if (p) {
      setPrescription({
        rightEye: p.rightEye || { dv: {}, nv: {}, pc: {} },
        leftEye: p.leftEye || { dv: {}, nv: {}, pc: {} },
        pd: p.pd || "", notes: p.notes || "", problems: p.problems || "",
      });
      setUsePrescription(true);
    }
    setStep("order");
  }

  function searchInventory(q: string, type: "frame", idx: number) {
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length < 2) { setSuggestions([]); setSuggestionsFor(null); return; }
    const t = setTimeout(async () => {
      const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(q)}`);
      if (res.success) {
        setSuggestions(res.data || []);
        setSuggestionsFor(res.data && res.data.length > 0 ? { type, idx } : null);
      }
    }, 300);
    setSearchTimer(t);
  }

  async function saveTransaction() {
    if (savingRef.current) return;
    setSaving(true);
    try {
      const custId = selectedCustomer?._id;
      if (!custId) { toast.error("No customer selected"); setSaving(false); return; }

      const payload: any = { customerId: custId };

      // Always create a visit record
      payload.visit = { visitType: visitType || "new" };
      if (visitDate) payload.visit.visitDate = visitDate;
      if (visitDoctor) payload.visit.doctorName = visitDoctor;
      if (visitRemarks) payload.visit.remarks = visitRemarks;

      // Only save prescription if user opted in
      if (usePrescription) {
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

        const customerMobile = selectedCustomer?.mobile || "";
        const resData = res.data as any;
        if (customerMobile && resData?.bill) {
          greetingSent.current = false;
          setCountdown(3);
          countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
                savingRef.current = false;
                sendGreeting(resData, selectedCustomer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          savingRef.current = false;
          navigate(`/customers/${custId}?visitId=${resData?.visit?._id || ""}`);
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

  async function sendGreeting(data: any, cust: CustomerData | null) {
    if (greetingSent.current) return;
    greetingSent.current = true;
    try {
      const customerMobile = cust?.mobile || "";
      const shopName = settings?.shopName || "KMJ Optical";
      const customerName = cust?.name || "";
      const num = customerMobile.replace(/\D/g, "");
      const fullNum = num.length === 10 ? `91${num}` : num;
      const msg = t(
        `*${shopName}* 🕶\n\nHello *${customerName}*,\n\nThank you for visiting us! Your order has been placed successfully.\n\nThank you! 🙏`,
        `*${shopName}* 🕶\n\nनमस्ते *${customerName}*,\n\nहमसे मिलने के लिए धन्यवाद! आपका ऑर्डर सफलतापूर्वक हो गया है।\n\nधन्यवाद! 🙏`
      );
      await api.post("/api/whatsapp/send", { phone: fullNum, message: msg });
    } catch { /* silent */ }
    navigate(`/customers/${cust?._id || ""}?visitId=${data?.visit?._id || ""}`);
  }

  function handlePhoneKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") searchCustomer();
  }

  function resetAll() {
    setSelectedCustomer(null); setCustomerSummary(null); setIsNewCustomer(false);
    setPhoneSearch(""); setSearchResults([]); setSearched(false);
    setCustomerForm({ name: "", mobile: "", email: "", address: "", city: "", age: undefined, gender: "" });
    setStep("service"); setVisitType("new");
    setVisitDate(new Date().toISOString().split("T")[0]); setVisitDoctor(""); setVisitRemarks("");
    setUsePrescription(false);
    setPrescription({ rightEye: { dv: {}, nv: {}, pc: {} }, leftEye: { dv: {}, nv: {}, pc: {} }, pd: "", notes: "", problems: "" });
    setOrderFrames([]); setOrderLenses([]); setOrderAccessories([]);
    setBillItems([]); setTotalAmount(0); setAdvancePaid(0); setPaymentMode("Cash");
    setDiscountPercent(0); setDiscountAmount(0); setDiscountType("percent");
    setDeliveryAddress(""); setDeliveryDate("");
    phoneRef.current?.focus();
  }

  if (loadingSettings) return <PageSkeleton page="workspace" />;

  // ===== CUSTOMER SELECTION PHASE =====
  if (!selectedCustomer && !isNewCustomer) {
    return (
      <div className="min-h-screen bg-th-elevated">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <div className="card">
            <h2 className="text-2xl font-bold text-th-text mb-1">{uiT("New Visit", "नई विज़िट")}</h2>
            <p className="text-sm text-th-secondary mb-6">Enter phone number to search existing customers or add a new one.</p>

            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-muted" />
                <input ref={phoneRef} type="tel" inputMode="numeric" placeholder="Enter phone number..."
                  value={phoneSearch} onChange={(e) => setPhoneSearch(e.target.value)}
                  onKeyDown={handlePhoneKeyDown}
                  className="w-full pl-10 pr-4 py-3 bg-th-elevated border border-th-border rounded-sm text-lg text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" />
              </div>
              <button onClick={searchCustomer} className="px-6 py-3 bg-[#1ed760] hover:bg-[#1db954] text-th-text font-semibold rounded-sm transition-all flex items-center gap-2">
                <Search size={18} />
              </button>
            </div>

            {searched && searchResults.length > 0 && (
              <div className="space-y-3 mb-4">
                <p className="text-sm font-medium text-th-secondary">{searchResults.length} customer(s) found</p>
                {searchResults.map((c: any) => (
                  <div key={c._id}
                    className="flex items-center justify-between p-4 rounded-sm border border-th-border hover:border-[#1ed760] hover:bg-[#1ed760]/5 transition-all cursor-pointer"
                    onClick={() => selectCustomer(c)}>
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-[#1ed760] rounded-sm flex items-center justify-center text-th-text font-bold text-lg">
                        {c.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-th-text">{c.name}</p>
                        <p className="text-sm text-th-secondary">{c.mobile}</p>
                        {c.lastVisit && <p className="text-xs text-th-muted">Last visit: {c.lastVisit}</p>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-th-secondary">{c.totalVisits || 0} visits</p>
                      {(c.pendingAmount || 0) > 0 && <p className="text-xs text-amber-400 font-medium">₹{c.pendingAmount} due</p>}
                      <span className="text-[#1ed760] text-sm font-medium mt-1 inline-block">Select →</span>
                    </div>
                  </div>
                ))}
                <button onClick={() => { setIsNewCustomer(true); setSelectedCustomer(null); setCustomerForm((prev) => ({ ...prev, name: "", email: "", address: "", city: "", age: undefined, gender: "" })); }}
                  className="flex items-center gap-2 text-[#1ed760] hover:text-[#1ed760] font-medium text-sm w-full justify-center py-3 border-2 border-dashed border-[#1ed760] rounded-sm hover:bg-[#1ed760]/10 transition-all">
                  <UserPlus size={16} /> Add new customer with this number
                </button>
              </div>
            )}

            {searched && searchResults.length === 0 && !isNewCustomer && (
              <div className="text-center py-8 text-th-muted">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-sm">No customers found. Press Enter or click Search again to add a new customer.</p>
              </div>
            )}

            {searched && !selectedCustomer && (
              <div className="flex justify-end pt-2">
                <button onClick={() => { if (isNewCustomer && customerForm.name) setStep("service"); else searchCustomer(); }}
                  disabled={isNewCustomer && !customerForm.name}
                  className="btn-primary flex items-center gap-2">
                  Start New Visit <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Customer Summary Card */}
          {selectedCustomer && customerSummary && (
            <div className="card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-[#1ed760] rounded-lg flex items-center justify-center text-th-text font-bold text-2xl">
                    {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-th-text">{selectedCustomer.name}</h3>
                    <div className="flex items-center gap-3 text-sm text-th-secondary mt-0.5">
                      <span>{selectedCustomer.gender || "—"}</span>
                      {selectedCustomer.age && <span>• {selectedCustomer.age} yrs</span>}
                      <span>•</span>
                      <span><Phone size={12} className="inline" /> {selectedCustomer.mobile}</span>
                      {customerSummary.customer?.customerId && (
                        <>
                          <span>•</span>
                          <span className="text-[#1ed760] font-medium">ID: {customerSummary.customer.customerId}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${
                  selectedCustomer.pendingAmount && selectedCustomer.pendingAmount > 0
                    ? "bg-[#f5a623]/10 text-amber-400 border border-amber-500/20"
                    : "bg-[#1ed760]/10 text-[#1ed760] border border-[#1ed760]/20"
                }`}>
                  {selectedCustomer.pendingAmount && selectedCustomer.pendingAmount > 0 ? `₹${selectedCustomer.pendingAmount} Due` : "Cleared"}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                <div className="bg-th-elevated rounded-sm p-3 text-center">
                  <p className="text-lg font-bold text-th-text">{selectedCustomer.totalVisits || 0}</p>
                  <p className="text-[10px] text-th-secondary uppercase tracking-wide">Visits</p>
                </div>
                <div className="bg-th-elevated rounded-sm p-3 text-center">
                  <p className="text-lg font-bold text-[#1ed760]">₹{(selectedCustomer.totalSpent || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-th-secondary uppercase tracking-wide">Revenue</p>
                </div>
                <div className="bg-th-elevated rounded-sm p-3 text-center">
                  <p className="text-lg font-bold text-amber-400">₹{(selectedCustomer.pendingAmount || 0).toLocaleString()}</p>
                  <p className="text-[10px] text-th-secondary uppercase tracking-wide">Pending</p>
                </div>
                <div className="bg-th-elevated rounded-sm p-3 text-center">
                  <p className="text-sm font-bold text-th-secondary">
                    {selectedCustomer.createdAt ? new Date(selectedCustomer.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                  </p>
                  <p className="text-[10px] text-th-secondary uppercase tracking-wide">Since</p>
                </div>
              </div>

              {customerSummary.lastOrder && (
                <div className="bg-th-elevated rounded-sm p-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-th-secondary uppercase tracking-wide mb-0.5">Last Purchase</p>
                      <p className="font-medium text-th-text">
                        {customerSummary.lastOrder.frame && `Frame: ${customerSummary.lastOrder.frame}`}
                        {customerSummary.lastOrder.frame && customerSummary.lastOrder.lens && " | "}
                        {customerSummary.lastOrder.lens && `Lens: ${customerSummary.lastOrder.lens}`}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      customerSummary.lastOrder.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                      customerSummary.lastOrder.status === "Ready" ? "bg-blue-50 text-blue-700" :
                      "bg-amber-400/10 text-amber-400"
                    }`}>{customerSummary.lastOrder.status || "Draft"}</span>
                  </div>
                  {customerSummary.lastPrescription?.rightEye?.dv?.sph != null && (
                    <p className="text-xs text-th-muted mt-1">
                      Last Rx: {formatRxBrief(customerSummary.lastPrescription.rightEye.dv.sph, customerSummary.lastPrescription.rightEye.dv.cyl, customerSummary.lastPrescription.rightEye.dv.axis)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setStep("service")} className="btn-primary flex items-center gap-1.5 text-sm px-4 py-2">
                  <Activity size={15} /> {uiT("New Visit", "नई विज़िट")}
                </button>
                <button onClick={() => selectedCustomer._id && navigate(`/customers/${selectedCustomer._id}`)} className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2">
                  <History size={15} /> Full History
                </button>
                {customerSummary?.lastOrder && (
                  <button onClick={() => repeatLastOrder(customerSummary)} className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2">
                    <Repeat size={15} /> Repeat Last Order
                  </button>
                )}
                {selectedCustomer.mobile && (
                  <button onClick={async () => {
                    const num = selectedCustomer.mobile.replace(/\D/g, "");
                    const fullNum = num.length === 10 ? `91${num}` : num;
                    const msg = t(
                      `Hi ${selectedCustomer.name}, this is ${settings?.shopName || "KMJ Optical"}.`,
                      `नमस्ते ${selectedCustomer.name}, यह ${settings?.shopName || "KMJ Optical"} है।`
                    );
                    await api.post("/api/whatsapp/send", { phone: fullNum, message: msg });
                  }}
                    className="btn-secondary flex items-center gap-1.5 text-sm px-4 py-2">
                    <MessageCircle size={15} /> {uiT("WhatsApp", "WhatsApp")}
                  </button>
                )}
              </div>
            </div>
          )}

          {selectedCustomer && customerSummary?.recentOrders && customerSummary.recentOrders.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-th-secondary mb-3 flex items-center gap-2">
                <Clock size={14} /> Recent Activity
              </h3>
              <div className="space-y-2">
                {(customerSummary.recentOrders || []).slice(0, 5).map((o: any) => (
                  <div key={o._id} className="flex items-center justify-between py-2 border-b border-th-card last:border-0">
                    <div>
                      <p className="text-sm text-th-secondary">
                        {o.frame || ""}{o.frame && o.lens ? " + " : ""}{o.lens || ""}{o.coating ? " + " + o.coating : ""}
                      </p>
                      <p className="text-xs text-th-muted">
                        {o.createdAt ? new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      o.status === "Delivered" ? "bg-[#1ed760]/10 text-[#1ed760]" :
                      o.status === "Ready" ? "bg-blue-50 text-blue-700" :
                      o.status === "In Lab" ? "bg-amber-400/10 text-amber-400" : "bg-th-card text-th-secondary"
                    }`}>{o.status || "Draft"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={() => { if (selectedCustomer) setStep("service"); else searchCustomer(); }}
              disabled={!selectedCustomer}
              className="btn-primary flex items-center gap-2 px-6 py-3">
              Start New Visit <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== NEW CUSTOMER FORM =====
  if (isNewCustomer) {
    return (
      <div className="min-h-screen bg-th-elevated">
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
          <div className="card">
            <h2 className="text-xl font-bold text-th-text mb-1">{uiT("New Customer", "नया ग्राहक")}</h2>
            <p className="text-sm text-th-secondary mb-5">Fill in the details to create a new customer.</p>

            <div className="bg-[#f5a623]/10 text-amber-400 rounded-sm p-4 mb-5">
              <p className="text-sm font-medium text-amber-400">Phone: {customerForm.mobile}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-th-secondary mb-1">Name *</label>
                <input className="w-full px-4 py-2.5 bg-th-elevated border border-th-border rounded-sm text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" placeholder="Full name" value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-th-secondary mb-1">Phone</label>
                <input className="w-full px-4 py-2.5 bg-th-surface border border-th-border rounded-sm text-sm text-th-secondary" value={customerForm.mobile} disabled />
              </div>
              <div>
                <label className="block text-xs font-medium text-th-secondary mb-1">Email</label>
                <input className="w-full px-4 py-2.5 bg-th-elevated border border-th-border rounded-sm text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" placeholder="email@example.com" value={customerForm.email || ""}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-th-secondary mb-1">Age</label>
                <input type="number" className="w-full px-4 py-2.5 bg-th-elevated border border-th-border rounded-sm text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" placeholder="Age" value={customerForm.age ?? ""}
                  onChange={(e) => setCustomerForm({ ...customerForm, age: e.target.value ? Number(e.target.value) : undefined })} />
              </div>
              <div>
                <label className="block text-xs font-medium text-th-secondary mb-1">Gender</label>
                <select className="w-full px-4 py-2.5 bg-th-elevated border border-th-border rounded-sm text-sm text-th-text focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" value={customerForm.gender || ""}
                  onChange={(e) => setCustomerForm({ ...customerForm, gender: e.target.value })}>
                  <option value="">Select</option><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-th-secondary mb-1">City</label>
                <input className="w-full px-4 py-2.5 bg-th-elevated border border-th-border rounded-sm text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" placeholder="City" value={customerForm.city || ""}
                  onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-th-secondary mb-1">Address</label>
                <input className="w-full px-4 py-2.5 bg-th-elevated border border-th-border rounded-sm text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" placeholder={uiT("Address", "पता")} value={customerForm.address || ""}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} />
              </div>
            </div>

            <div className="flex justify-between mt-6 pt-4 border-t border-th-border">
              <button onClick={() => { setIsNewCustomer(false); setSearched(false); }}
                className="btn-secondary flex items-center gap-2">
                <X size={16} /> Cancel
              </button>
              <button onClick={async () => {
                if (!customerForm.name) { toast.error("Name is required"); return; }
                const res = await api.post("/api/customers", customerForm);
                if (res.success) {
                  const newCust = { ...customerForm, _id: res.data._id || res.data.id };
                  setSelectedCustomer(newCust);
                  setIsNewCustomer(false);
                  setDeliveryAddress(newCust.address || "");
                  toast.success("Customer created!");
                } else {
                  toast.error(res.message || "Failed to create customer");
                }
              }}
                disabled={!customerForm.name}
                className="btn-primary flex items-center gap-2">
                Save & Continue <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== VISIT CREATION PHASE (using shared components) =====
  const stepKeys = steps.map((s) => s.key);
  const currentIdx = stepKeys.indexOf(step);
  const discountVal = calcDiscount();
  const finalTotal = Math.max(0, totalAmount - discountVal);
  const customerId = selectedCustomer?._id || "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-th-elevated"
    >
      <PageHeader
        customer={selectedCustomer || { name: "", mobile: "" }}
        id={customerId}
        navigate={navigate}
        visitType={visitType}
        loading={false}
        saving={saving}
      />

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <VisitStepper
          steps={steps}
          currentIdx={currentIdx}
          setStep={setStep}
        />

        <AnimatePresence mode="wait">
          {step === "service" && (
            <VisitTypeSection
              key="service"
              visitType={visitType}
              setVisitType={setVisitType}
              visitDate={visitDate}
              setVisitDate={setVisitDate}
              visitDoctor={visitDoctor}
              setVisitDoctor={setVisitDoctor}
              visitRemarks={visitRemarks}
              setVisitRemarks={setVisitRemarks}
            />
          )}

          {step === "prescription" && (
            <PrescriptionPanel
              key="prescription"
              usePrescription={usePrescription}
              setUsePrescription={setUsePrescription}
              prescription={prescription}
              setPrescription={setPrescription}
            />
          )}

          {step === "order" && (
            <OrderItems
              key="order"
              orderFrames={orderFrames}
              setOrderFrames={setOrderFrames}
              updateFrame={updateFrame}
              removeFrame={removeFrame}
              orderLenses={orderLenses}
              setOrderLenses={setOrderLenses}
              updateLens={updateLens}
              removeLens={removeLens}
              orderAccessories={orderAccessories}
              setOrderAccessories={setOrderAccessories}
              updateAccessory={updateAccessory}
              removeAccessory={removeAccessory}
              setStep={setStep}
              onScan={() => setScanModal(true)}
              searchInventory={searchInventory}
              suggestions={suggestions}
              suggestionsFor={suggestionsFor}
              setSuggestions={setSuggestions}
              setSuggestionsFor={setSuggestionsFor}
              isFocused={isFocused}
              setIsFocused={setIsFocused}
            />
          )}

          {step === "billing" && (
            <BillingPanel
              key="billing"
              billItems={billItems}
              setBillItems={setBillItems}
              updateBillItem={updateBillItem}
              removeBillItem={removeBillItem}
              totalAmount={totalAmount}
            />
          )}

          {step === "payment" && (
            <PaymentPanel
              key="payment"
              discountType={discountType}
              setDiscountType={setDiscountType}
              discountPercent={discountPercent}
              setDiscountPercent={setDiscountPercent}
              discountAmount={discountAmount}
              setDiscountAmount={setDiscountAmount}
              discountVal={discountVal}
              totalAmount={totalAmount}
              advancePaid={advancePaid}
              setAdvancePaid={setAdvancePaid}
              paymentMode={paymentMode}
              setPaymentMode={setPaymentMode}
              finalTotal={finalTotal}
              deliveryAddress={deliveryAddress}
              setDeliveryAddress={setDeliveryAddress}
              deliveryDate={deliveryDate}
              setDeliveryDate={setDeliveryDate}
            />
          )}

          {step === "confirmation" && (
            <ConfirmationDashboard
              key="confirmation"
              visitType={visitType}
              visitDate={visitDate}
              visitDoctor={visitDoctor}
              visitRemarks={visitRemarks}
              usePrescription={usePrescription}
              prescription={prescription}
              orderFrames={orderFrames}
              orderLenses={orderLenses}
              orderAccessories={orderAccessories}
              billItems={billItems}
              totalAmount={totalAmount}
              discountVal={discountVal}
              finalTotal={finalTotal}
              advancePaid={advancePaid}
              deliveryAddress={deliveryAddress}
              deliveryDate={deliveryDate}
            />
          )}
        </AnimatePresence>
      </div>

      <BottomNav
        currentIdx={currentIdx}
        step={step}
        setStep={setStep}
        stepKeys={stepKeys}
        saveTransaction={saveTransaction}
        saving={saving}
        countdown={countdown}
      />

      <Modal open={scanModal} onClose={() => setScanModal(false)} title="Scan Frame QR" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-th-secondary">Enter SKU or barcode to auto-fill frame details.</p>
          <input className="w-full px-4 py-2.5 bg-th-elevated/80 border border-th-border rounded-sm text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" placeholder="SKU or barcode" autoFocus
            onChange={async (e) => {
              const q = e.target.value.trim();
              if (q.length > 2) {
                const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(q)}`);
                if (res.success && res.data && res.data.length > 0) {
                  const item = res.data[0];
                  const newFrame = { sku: item.sku || "", brand: item.brand || "", model: item.model || "", color: item.color || "", price: item.sellingPrice || 0 };
                  setOrderFrames((prev) => [...prev, newFrame]);
                  setScanModal(false);
                }
              }
            }} />
          <button onClick={() => { setScanModal(false); setCameraActive(true); }}
            className="w-full text-center py-2.5 text-xs font-semibold text-[#1ed760] border-2 border-dashed border-th-border rounded-sm hover:bg-[#1ed760]/10 transition-all flex items-center justify-center gap-1.5">
            <ScanLine size={14} /> Use Camera
          </button>
        </div>
      </Modal>

      {cameraActive && (
        <CameraScanner onScan={async (code) => {
          const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(code)}`);
          if (res.success && res.data && res.data.length > 0) {
            const item = res.data[0];
            const newFrame = { sku: item.sku || "", brand: item.brand || "", model: item.model || "", color: item.color || "", price: item.sellingPrice || 0 };
            setOrderFrames((prev) => [...prev, newFrame]);
          }
          setCameraActive(false);
        }} onClose={() => setCameraActive(false)} />
      )}
    </motion.div>
  );
}

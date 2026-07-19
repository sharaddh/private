import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import api from "../api";
import { useToast } from "../context/ToastContext";
import { useTranslate } from "../context/TranslateContext";
import PageSkeleton from "../components/PageSkeleton";
import Modal from "../components/Modal";
import CameraScanner from "../components/CameraScanner";
import { cleanEyeSet } from "../utils/rx";
import { normalizeWhatsAppPhone } from "../utils/whatsapp";
import { whatsappService } from "../services";
import {
  ScanLine, Eye, RefreshCw, Maximize2, Circle, Wrench, Grid3X3,
  Activity, ShoppingCart, CreditCard, Percent, CheckCircle,
} from "lucide-react";
import PageHeader from "../components/NewvistePage/PageHeader";
import VisitStepper from "../components/NewvistePage/VisitStepper";
import VisitTypeSection from "../components/NewvistePage/VisitTypeSection";
import PrescriptionPanel from "../components/NewvistePage/PrescriptionPanel";
import OrderItems from "../components/NewvistePage/OrderItems";
import BillingPanel from "../components/NewvistePage/BillingPanel";
import PaymentPanel from "../components/NewvistePage/PaymentPanel";
import ConfirmationDashboard from "../components/NewvistePage/ConfirmationDashboard";
import BottomNav from "../components/NewvistePage/BottomNav";

export default function CustomerNewVisit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { t, uiT } = useTranslate();

  const VISIT_TYPES = [
    { value: "new", label: uiT("New Glasses", "नए चश्मे"), icon: Eye },
    { value: "frame_change", label: uiT("Frame Change", "फ्रेम बदलें"), icon: RefreshCw },
    { value: "new_lens", label: uiT("New Lens", "नया लेंस"), icon: Maximize2 },
    { value: "contact_lens", label: uiT("Contact Lens", "कॉन्टैक्ट लेंस"), icon: Circle },
    { value: "service", label: uiT("Service", "सेवा"), icon: Wrench },
    { value: "other", label: uiT("Other", "अन्य"), icon: Grid3X3 },
  ];

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
    { key: "billing", label: uiT("Billing", "बिलिंग"), icon: CreditCard, desc: uiT("Items & pricing", "आइटम और मूल्य") },
    { key: "payment", label: uiT("Payment", "भुगतान"), icon: Percent, desc: uiT("Collect & confirm", "संग्रह और पुष्टि") },
    { key: "confirmation", label: uiT("Confirm", "पुष्टि"), icon: CheckCircle, desc: uiT("Review & save", "समीक्षा और सहेजें") },
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
        if (visitsRes.success && visitsRes.data && visitsRes.data.length > 0) {
          const last = visitsRes.data[0];
          setVisitDoctor(last.doctorName || "");
        }
        if (prescRes.success && prescRes.data && prescRes.data.length > 0) {
          const prev = prescRes.data[0];
          setPrescription({
            rightEye: prev.rightEye || { dv: {}, nv: {}, pc: {} },
            leftEye: prev.leftEye || { dv: {}, nv: {}, pc: {} },
            pd: prev.pd || "", notes: prev.notes || "", problems: prev.problems || "",
          });
          setUsePrescription(true);
        }
        const ordersList = ((ordersRes.data as any)?.data || (Array.isArray(ordersRes.data) ? ordersRes.data : []) as any[]);
        if (ordersRes.success && ordersList.length > 0) {
          const last = ordersList[0];
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

      try {
        const saved = sessionStorage.getItem(`visitDraft_${id}`);
        if (saved) {
          const d = JSON.parse(saved);
          if (d.step) setStep(d.step);
          if (d.visitType) setVisitType(d.visitType);
          if (d.visitDate) setVisitDate(d.visitDate);
          if (d.visitDoctor !== undefined) setVisitDoctor(d.visitDoctor);
          if (d.visitRemarks !== undefined) setVisitRemarks(d.visitRemarks);
          if (d.usePrescription !== undefined) setUsePrescription(d.usePrescription);
          if (d.prescription) setPrescription(d.prescription);
          if (d.orderFrames) setOrderFrames(d.orderFrames);
          if (d.orderLenses) setOrderLenses(d.orderLenses);
          if (d.orderAccessories) setOrderAccessories(d.orderAccessories);
          if (d.billItems) setBillItems(d.billItems);
          if (d.advancePaid !== undefined) setAdvancePaid(d.advancePaid);
          if (d.paymentMode) setPaymentMode(d.paymentMode);
          if (d.discountPercent !== undefined) setDiscountPercent(d.discountPercent);
          if (d.discountAmount !== undefined) setDiscountAmount(d.discountAmount);
          if (d.discountType) setDiscountType(d.discountType);
          if (d.deliveryAddress !== undefined) setDeliveryAddress(d.deliveryAddress);
          if (d.deliveryDate !== undefined) setDeliveryDate(d.deliveryDate);
        }
      } catch {}
    })();
  }, [id]);

  // Calculate Total Bill dynamically
  useEffect(() => {
    const total = billItems.reduce((s, i) => s + i.price * i.qty, 0);
    setTotalAmount(total);
  }, [billItems]);

  // Backup draft
  useEffect(() => {
    if (!id || loading) return;
    const data = { step, visitType, visitDate, visitDoctor, visitRemarks, usePrescription, prescription, orderFrames, orderLenses, orderAccessories, billItems, advancePaid, paymentMode, discountPercent, discountAmount, discountType, deliveryAddress, deliveryDate };
    sessionStorage.setItem(`visitDraft_${id}`, JSON.stringify(data));
  }, [id, loading, step, visitType, visitDate, visitDoctor, visitRemarks, usePrescription, prescription, orderFrames, orderLenses, orderAccessories, billItems, advancePaid, paymentMode, discountPercent, discountAmount, discountType, deliveryAddress, deliveryDate]);

  // ?? REAL-TIME AUTOMATIC SYNC ??
  // This watches your cart and updates the bill silently in the background
  useEffect(() => {
    if (loading) return; 

    const autoItems: Array<{ description: string; price: number; qty: number }> = [];
    
    // Add Frames
    orderFrames.forEach((f) => {
      if (f.brand || f.model || f.price > 0 || f.sku) {
        autoItems.push({ 
          description: `Frame: ${f.brand} ${f.model} ${f.color ? `(${f.color})` : ""}`.trim(), 
          price: Number(f.price) || 0, 
          qty: 1 
        });
      }
    });

    // Add Lenses
    orderLenses.forEach((l) => {
      if (l.brand || l.features.length > 0 || l.price > 0 || l.sku) {
        const featuresStr = l.features.length > 0 ? l.features.join(" + ") : "Standard";
        const indexStr = l.index ? `(Index: ${l.index})` : "";
        autoItems.push({ 
          description: `Lens: ${l.brand} ${featuresStr} ${indexStr}`.replace(/\s+/g, ' ').trim(), 
          price: Number(l.price) || 0, 
          qty: 1 
        });
      }
    });

    // Add Accessories
    orderAccessories.forEach((a) => {
      if (a.name || a.price > 0) {
        autoItems.push({ 
          description: `Acc: ${a.name || "Accessory"}`, 
          price: Number(a.price) || 0, 
          qty: 1 
        });
      }
    });

    setBillItems((prev) => {
      // Keep any manual items the user added themselves (doesn't start with Frame:, Lens:, or Acc:)
      const manualItems = prev.filter(p => 
        !p.description.startsWith("Frame:") && 
        !p.description.startsWith("Lens:") && 
        !p.description.startsWith("Acc:")
      );
      
      return [...autoItems, ...manualItems];
    });

  }, [orderFrames, orderLenses, orderAccessories, loading]);

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

  // Blank prop placeholder for the OrderItems component (Real sync is handled by the useEffect above!)
  function syncBillFromOrder() {}

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

      // Always create a visit record
      payload.visit = { visitType: visitType || "new" };
      if (visitDate) payload.visit.visitDate = visitDate;
      if (visitDoctor) payload.visit.doctorName = visitDoctor;
      if (visitRemarks) payload.visit.remarks = visitRemarks;

      // Only save prescription if user opted in
      const rxRight = cleanEyeSet(prescription.rightEye);
      const rxLeft = cleanEyeSet(prescription.leftEye);
      const hasRxData = rxRight || rxLeft || prescription.pd;
      if (usePrescription || hasRxData) {
        payload.prescription = {
          rightEye: rxRight,
          leftEye: rxLeft,
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
        sessionStorage.removeItem(`visitDraft_${id}`);

        const customerMobile = customer?.mobile || "";
        const resData = res.data as any;
        if (customerMobile && resData?.bill) {
          greetingSent.current = false;
          setCountdown(3);
          countdownRef.current = setInterval(() => {
            setCountdown((prev) => {
              if (prev <= 1) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
                sendGreeting(resData, customer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        } else {
          savingRef.current = false;
          navigate(`/customers/${id}?visitId=${resData?.visit?._id || ""}`);
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
      const fullNum = normalizeWhatsAppPhone(customerMobile);
      if (!fullNum) return;
      const msg = t(
        `*${shopName}* 🕶\n\nHello *${customerName}*,\n\nThank you for visiting us! Your order has been placed successfully.\n\nThank you! 🙏`,
        `*${shopName}* 🕶\n\nनमस्ते *${customerName}*,\n\nहमसे मिलने के लिए धन्यवाद! आपका ऑर्डर सफलतापूर्वक हो गया है।\n\nधन्यवाद! 🙏`
      );
      const res = await whatsappService.sendMessage({ phone: fullNum, message: msg });
      if (!res.success || (res.data && !res.data.sent && !res.data.queued)) {
        toast.info(uiT("Greeting message could not be sent: " + (res.message || "WhatsApp not connected"), "अभिवादन संदेश नहीं भेजा जा सका: " + (res.message || "WhatsApp कनेक्ट नहीं है")));
      }
    } catch (e: any) {
      toast.info(uiT("Greeting message skipped", "अभिवादन संदेश छोड़ दिया गया"));
    }
    navigate(`/customers/${id}?visitId=${data?.visit?._id || ""}`);
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

  if (loading) return <PageSkeleton page="customerdetail" />;
  if (!customer) return <div className="min-h-screen bg-th-base flex items-center justify-center"><p className="text-sm text-th-secondary">Customer not found</p></div>;

  const stepKeys = steps.map(s => s.key);
  const currentIdx = stepKeys.indexOf(step);
  const discountVal = calcDiscount();
  const finalTotal = Math.max(0, totalAmount - discountVal);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-th-base"
    >
      <PageHeader
        customer={customer}
        id={id!}
        navigate={navigate}
        visitType={visitType}
        loading={loading}
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
          <input className="w-full px-4 py-2.5 bg-th-base/80 border border-th-border rounded-sm text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-2 focus:ring-[#1ed760]/20 focus:border-[#1ed760] transition-all" placeholder="SKU or barcode" autoFocus
            onChange={async (e) => {
              const q = e.target.value.trim();
              if (q.length > 2) {
                const res = await api.get<any[]>(`/api/inventory?q=${encodeURIComponent(q)}`);
                if (res.success && res.data && res.data.length > 0) {
                  const item = res.data[0];
                  const newFrame = { sku: item.sku || "", brand: item.brand || "", model: item.model || "", color: item.color || "", price: item.sellingPrice || 0 };
                  const next = [...orderFrames, newFrame];
                  setOrderFrames(next);
                  setScanModal(false);
                }
              }
            }} />
          <button onClick={() => { setScanModal(false); setCameraActive(true); }}
            className="w-full text-center py-2.5 text-xs font-semibold text-[#1ed760] border border-dashed border-th-border rounded-sm bg-[#1ed760]/10 transition-all flex items-center justify-center gap-1.5">
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
            const next = [...orderFrames, newFrame];
            setOrderFrames(next);
          }
          setCameraActive(false);
        }} onClose={() => setCameraActive(false)} />
      )}
    </motion.div>
  );
}
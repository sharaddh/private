import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { settingsService, orderService, billService } from "../services";
import PageSkeleton from "../components/PageSkeleton";
import { useToast } from "../context/ToastContext";
import { useTranslate } from "../context/TranslateContext";
import { Search, Phone, Check, ChevronRight, Plus, Loader2, Package, Clock, X, User, FileText, CreditCard, Receipt, Glasses, Eye, FlaskConical, Circle } from "lucide-react";
import type { Customer, Order, Bill, ShopSettings, BillItem, PaymentMode } from "../types";

export default function Pickup() {
  const { uiT } = useTranslate();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const globalToast = useToast();
  const [phone, setPhone] = useState<string>("");
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [readyOrders, setReadyOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [bill, setBill] = useState<Bill | null>(null);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [collectAmount, setCollectAmount] = useState<number>(0);
  const [collectMode, setCollectMode] = useState<string>("Cash");
  const [delivering, setDelivering] = useState<boolean>(false);
  const [waStatus, setWaStatus] = useState<string>("checking");
  const [message, setMessage] = useState<string>("");
  const [showCreateBill, setShowCreateBill] = useState<boolean>(false);
  const [billItems, setBillItems] = useState<{ description: string; qty: number; price: number }[]>([{ description: "", qty: 1, price: 0 }]);
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [showConfirmDeliver, setShowConfirmDeliver] = useState<boolean>(false);
  const [loadedFromUrl, setLoadedFromUrl] = useState<boolean>(false);

  const billSubtotal = billItems.reduce((s, i) => s + i.qty * i.price, 0);
  const billTotal = Math.max(0, billSubtotal - billDiscount);

  const orderIdFromUrl = searchParams.get("orderId");

  useEffect(() => {
    settingsService.get().then((d) => { if (d.success) setSettings(d.data ?? null); });
    api.get<{ status: string }>("/api/whatsapp/status").then((d) => { if (d.success && d.data) setWaStatus(d.data.status); });
    fetchReadyOrders();
  }, []);

  useEffect(() => {
    if (orderIdFromUrl && !selectedOrder && !loadedFromUrl) {
      setLoadedFromUrl(true);
      const match = readyOrders.find((o) => o._id === orderIdFromUrl);
      if (match) {
        pickReadyOrder(match);
      } else {
        loadOrderById(orderIdFromUrl);
      }
    }
  }, [readyOrders, orderIdFromUrl]);

  async function fetchReadyOrders() {
    const res = await orderService.list<Order[]>();
    if (res.success) {
      setReadyOrders(((res.data as any)?.data || (Array.isArray(res.data) ? res.data : []) as any[]).filter((o: any) => o.status === "Ready"));
    }
  }

  async function loadOrderById(orderId: string) {
    setIsLoading(true);
    try {
      const res = await api.get<Order>("/api/orders/" + orderId);
      if (res.success && res.data) {
        const o = res.data as any;
        const custRes = await api.get<Customer>("/api/customers/" + (typeof o.customerId === "object" ? o.customerId._id : o.customerId));
        if (custRes.success && custRes.data) {
          const c = custRes.data;
          setSelectedCustomer(c);
          setPhone(c.mobile || "");
          const [ordersRes, billsRes] = await Promise.all([
            api.get<Order[]>("/api/orders?customerId=" + c._id),
            billService.list<Bill[]>(),
          ]);
          if (ordersRes.success) setOrders(((ordersRes.data as any)?.data || (Array.isArray(ordersRes.data) ? ordersRes.data : []) as any[]).filter((o2: any) => o2.status === "Ready"));
          let custBills: Bill[] = [];
          if (billsRes.success) {
            custBills = ((billsRes.data as any)?.data || (Array.isArray(billsRes.data) ? billsRes.data : []) as Bill[]).filter((b: Bill) => {
              const cid = typeof b.customerId === "object" ? b.customerId?._id : b.customerId;
              return cid === c._id;
            });
            setBills(custBills);
          }
          setSelectedOrder(o);
          await syncBillForOrder(o, custBills);
        }
      }
    } finally { setIsLoading(false); }
  }

  async function searchCustomer() {
    const num = phone.replace(/\D/g, "");
    if (num.length < 3) return;
    setIsLoading(true);
    try {
      const res = await api.get<Customer[]>("/api/customers?phone=" + encodeURIComponent(num));
      const custList = ((res.data as any)?.data || res.data || []) as Customer[];
      if (res.success && custList.length > 0) { setCustomers(custList); setMessage(""); }
      else { setCustomers([]); setMessage(uiT("No customer found with this number", "इस नंबर से कोई ग्राहक नहीं मिला")); }
    } finally { setIsLoading(false); setSelectedCustomer(null); setOrders([]); setSelectedOrder(null); setBill(null); }
  }

  async function pickReadyOrder(o: Order) {
    const mobile = typeof o.customerId === "object" ? o.customerId?.mobile : "";
    if (!mobile) return;
    setPhone(mobile);
    setIsLoading(true);
    try {
      const res = await api.get<Customer[]>("/api/customers?phone=" + encodeURIComponent(mobile));
      const custList = ((res.data as any)?.data || res.data || []) as Customer[];
      if (res.success && custList.length > 0) {
        setCustomers(custList);
        const c = custList[0];
        setSelectedCustomer(c);
        const [ordersRes, billsRes] = await Promise.all([
          api.get<Order[]>("/api/orders?customerId=" + c._id),
          billService.list<Bill[]>(),
        ]);
        if (ordersRes.success) setOrders(((ordersRes.data as any)?.data || (Array.isArray(ordersRes.data) ? ordersRes.data : []) as any[]).filter((o2: any) => o2.status === "Ready"));
        let custBills: Bill[] = [];
        if (billsRes.success) {
          custBills = ((billsRes.data as any)?.data || (Array.isArray(billsRes.data) ? billsRes.data : []) as Bill[]).filter((b: Bill) => {
          const cid = typeof b.customerId === "object" ? b.customerId?._id : b.customerId;
          return cid === c._id;
        });
          setBills(custBills);
        }
        setSelectedOrder(o);
        await syncBillForOrder(o, custBills);
      }
    } finally { setIsLoading(false); }
  }

  async function syncBillForOrder(o: Order, custBills?: Bill[]): Promise<Bill | null> {
    const targetId = o.visitId || o._id;
    let b = (custBills || bills).find((b) => b.visitId === targetId) || null;
    setBill(b);
    if (!b) {
      const items: { description: string; qty: number; price: number }[] = [];
      if ((o as any).frame) items.push({ description: (o as any).frameBrand ? `${(o as any).frame} (${o.frameBrand})` : (o as any).frame, qty: 1, price: (o as any).framePrice || 0 });
      if (o.lensBrand) items.push({ description: o.lensBrand ? `${o.lensBrand} ${o.lensType || ""}` : o.lensBrand, qty: 1, price: (o as any).lensPrice || 0 });
      if (o.coating) items.push({ description: o.coating, qty: 1, price: (o as any).coatingPrice || 0 });
      if ((o as any).accessories?.length) {
        (o as any).accessories.forEach((a: string) => items.push({ description: a, qty: 1, price: 0 }));
      }
      if (items.length === 0) items.push({ description: "", qty: 1, price: 0 });
      setBillItems(items);
      setBillDiscount(0);
    } else {
      setCollectAmount(b.pendingAmount > 0 ? b.pendingAmount : 0);
    }
    return b;
  }

  async function selectCustomer(c: Customer) {
    setSelectedCustomer(c); setShowCreateBill(false); setIsLoading(true);
    try {
      const [ordersRes, billsRes] = await Promise.all([
        api.get<Order[]>("/api/orders?customerId=" + c._id),
        billService.list<Bill[]>(),
      ]);
      if (ordersRes.success) {
        const pending = ((ordersRes.data as any)?.data || (Array.isArray(ordersRes.data) ? ordersRes.data : []) as any[]).filter((o: any) => o.status === "Ready");
        setOrders(pending);
        if (pending.length === 0) setMessage(uiT("No orders ready for pickup", "पिकअप के लिए कोई ऑर्डर तैयार नहीं"));
      }
      if (billsRes.success) {
        const custBills = ((billsRes.data as any)?.data || (Array.isArray(billsRes.data) ? billsRes.data : []) as Bill[]).filter((b: Bill) => {
          const cid = typeof b.customerId === "object" ? b.customerId?._id : b.customerId;
          return cid === c._id;
        }).sort((a: Bill, b: Bill) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setBills(custBills);
      }
    } finally { setIsLoading(false); }
  }

  async function selectOrder(o: Order) {
    setSelectedOrder(o); setMessage(""); setShowCreateBill(false);
    const b = await syncBillForOrder(o);
    if (b) {
      setCollectAmount(b.pendingAmount > 0 ? b.pendingAmount : 0);
      setBill(b);
    } else {
      setBill(null);
      const items: { description: string; qty: number; price: number }[] = [];
      if ((o as any).frame) items.push({ description: (o as any).frameBrand ? `${(o as any).frame} (${o.frameBrand})` : (o as any).frame, qty: 1, price: (o as any).framePrice || 0 });
      if (o.lensBrand) items.push({ description: o.lensBrand ? `${o.lensBrand} ${o.lensType || ""}` : o.lensBrand, qty: 1, price: (o as any).lensPrice || 0 });
      if (o.coating) items.push({ description: o.coating, qty: 1, price: (o as any).coatingPrice || 0 });
      if ((o as any).accessories?.length) {
        (o as any).accessories.forEach((a: string) => items.push({ description: a, qty: 1, price: 0 }));
      }
      if (items.length === 0) items.push({ description: "", qty: 1, price: 0 });
      setBillItems(items); setBillDiscount(0);
    }
  }

  function addBillItem() { setBillItems([...billItems, { description: "", qty: 1, price: 0 }]); }
  function updateBillItem(idx: number, field: string, value: string | number) {
    const updated = billItems.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    setBillItems(updated);
  }
  function removeBillItem(idx: number) {
    if (billItems.length <= 1) return;
    setBillItems(billItems.filter((_, i) => i !== idx));
  }

  async function handleCreateBill() {
    if (!selectedCustomer || !selectedOrder) return;
    const items = billItems.filter((i) => i.description && i.price > 0);
    if (items.length === 0) { setMessage(uiT("Add at least one item with description and price", "कम से कम एक आइटम विवरण और मूल्य के साथ जोड़ें")); return; }
    const res = await billService.createWithItems({
      customerId: selectedCustomer._id,
      items: items.map((i) => ({ description: i.description, quantity: i.qty, unitPrice: i.price })),
      discount: billDiscount,
      tax: 0,
      advancePaid: 0,
    });
    if (res.success) {
      setBill(res.data!); setCollectAmount(res.data!.pendingAmount || 0); setShowCreateBill(false);
      setMessage(`✓ ${uiT("Bill created", "बिल बनाया गया")} ${uiT("successfully", "सफलतापूर्वक")}`);
      const billsRes = await billService.list<Bill[]>();
      if (billsRes.success) setBills(((billsRes.data as any)?.data || (Array.isArray(billsRes.data) ? billsRes.data : []) as Bill[]).filter((b: Bill) => {
        const cid = typeof b.customerId === "object" ? b.customerId?._id : b.customerId;
        return cid === selectedCustomer._id;
      }));
      globalToast.success(uiT("Bill created", "बिल बनाया गया"));
    } else { setMessage(res.message || uiT("Failed to create bill", "बिल बनाने में विफल")); }
  }

  async function handleDeliver() {
    if (!selectedOrder) return;
    setDelivering(true); setMessage("");
    const isDelivered = (selectedOrder as any).status === "Delivered";
    if (isDelivered && collectAmount > 0) {
      const res = await api.patch(`/api/orders/${selectedOrder._id}/collect-payment`, { collectPayment: collectAmount, paymentMode: collectMode });
      if (res.success) {
        setMessage(`✓ ${uiT("Payment collected successfully!", "भुगतान सफलतापूर्वक एकत्रित हुआ!")}`);
        globalToast.success(uiT("Payment collected", "भुगतान एकत्रित हुआ"));
        loadOrderById(selectedOrder._id);
      } else { setMessage(res.message || uiT("Failed to collect payment", "भुगतान एकत्र करने में विफल")); globalToast.error(res.message || "Failed"); }
    } else {
      const payload: Record<string, unknown> = { status: "Delivered" };
      if (collectAmount > 0) { payload.collectPayment = collectAmount; payload.paymentMode = collectMode; }
      const res = await api.patch(`/api/orders/${selectedOrder._id}/status`, payload);
      if (res.success) {
        setMessage(`✓ ${uiT("Order delivered successfully!", "ऑर्डर सफलतापूर्वक डिलीवर हुआ!")}`);
        globalToast.success(uiT("Order delivered — notification sent", "ऑर्डर डिलीवर हुआ — सूचना भेजी गई"));
        fetchReadyOrders();
        selectCustomer(selectedCustomer!); setSelectedOrder(null); setBill(null);
      } else { setMessage(res.message || uiT("Failed to deliver order", "ऑर्डर डिलीवर करने में विफल")); globalToast.error(res.message || uiT("Failed to deliver", "डिलीवर करने में विफल")); }
    }
    setDelivering(false); setShowConfirmDeliver(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      {/* Header */}
      <div className="card bg-th-surface rounded-lg p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#1ed760] rounded-full flex items-center justify-center text-black">
              <Package size={20} aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-th-text">{uiT("Pickup", "पिकअप")}</h1>
              <p className="text-sm text-th-secondary">{uiT("Collect ready orders and manage deliveries.", "तैयार ऑर्डर एकत्र करें और डिलीवरी प्रबंधित करें।")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {waStatus === "connected" ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1ed760]/10 text-[#1ed760] rounded-lg text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1ed760] animate-pulse" />
                {uiT("WhatsApp Connected", "WhatsApp जुड़ा हुआ")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-th-elevated text-th-secondary rounded-lg text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-th-secondary" />
                WhatsApp {waStatus === "checking" ? "..." : uiT("Disconnected", "डिस्कनेक्ट")}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ready orders grid */}
      {readyOrders.length > 0 && !selectedCustomer && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-[#1ed760]" aria-hidden="true" />
            <p className="text-sm font-semibold text-th-text">
              {readyOrders.length} {uiT("order(s) ready for pickup", "ऑर्डर पिकअप के लिए तैयार")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {readyOrders.map((o) => {
              const cName = typeof o.customerId === "object" ? o.customerId?.name : "";
              const cMobile = typeof o.customerId === "object" ? o.customerId?.mobile : "";
              const totalPrice = ((o as any).framePrice || 0) + ((o as any).lensPrice || 0) + ((o as any).coatingPrice || 0);
              return (
                <div key={o._id} onClick={() => pickReadyOrder(o)}
                  role="button"
                  aria-label={uiT("Select order for", "ऑर्डर चुनें") + " " + (cName || "")}
                  className="bg-th-surface rounded-lg p-4 cursor-pointer hover:bg-th-card active:scale-95 transition-all shadow-lg">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760] font-bold text-sm">
                      {(cName?.charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-th-text truncate">{cName || "—"}</p>
                      {cMobile && <p className="text-xs text-th-secondary">{cMobile}</p>}
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-[#1ed760]/10 text-[#1ed760] uppercase tracking-wider">{uiT("Ready", "तैयार")}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(o as any).frameBrand ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-th-elevated px-2 py-0.5 rounded-lg text-th-secondary font-medium truncate max-w-full">
                        <Glasses size={11} className="text-th-secondary flex-shrink-0" aria-hidden="true" /> {(o as any).frameBrand}{(o as any).frameModel ? ` ${(o as any).frameModel}` : ""}
                      </span>
                    ) : (o as any).frame ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-th-elevated px-2 py-0.5 rounded-lg text-th-secondary font-medium truncate max-w-full">
                        <Glasses size={11} className="text-th-secondary flex-shrink-0" aria-hidden="true" /> {(o as any).frame}
                      </span>
                    ) : null}
                    {o.lensBrand && (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-th-elevated px-2 py-0.5 rounded-lg text-th-secondary font-medium truncate max-w-full">
                        <Eye size={11} className="text-th-secondary flex-shrink-0" aria-hidden="true" /> {o.lensBrand}{o.lensType ? ` · ${o.lensType}` : ""}
                      </span>
                    )}
                    {((o as any).accessories || []).map((a: string, i: number) => {
                      const lower = a.toLowerCase();
                      const accIcon = lower.includes("clean") || lower.includes("solution") ? <FlaskConical size={11} className="text-[#1ed760] flex-shrink-0" aria-hidden="true" />
                        : lower.includes("contact") || lower.includes("lens") ? <Circle size={11} className="text-th-secondary flex-shrink-0" aria-hidden="true" />
                        : <Package size={11} className="text-th-secondary flex-shrink-0" aria-hidden="true" />;
                      return (
                        <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-th-elevated px-2 py-0.5 rounded-lg text-th-secondary font-medium truncate max-w-full">
                          {accIcon} {a}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-th-border">
                    {o.deliveryDate ? (
                      <span className="text-xs text-th-secondary flex items-center gap-1"><Clock size={10} aria-hidden="true" /> {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                      {(o.billInfo?.totalAmount ?? 0) > 0 && <span className="text-sm font-bold text-th-text">₹{(o.billInfo?.totalAmount ?? 0).toLocaleString()}</span>}
                      <ChevronRight size={16} className="text-th-muted" aria-hidden="true" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="bg-th-surface rounded-lg shadow-lg p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-muted" aria-hidden="true" />
            <input type="tel" placeholder={uiT("Search by mobile number...", "मोबाइल नंबर से खोजें...")}
              aria-label={uiT("Search by mobile number", "मोबाइल नंबर से खोजें")}
              value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") searchCustomer(); }}
              className="input-field pl-10 text-base" />
          </div>
          <button onClick={searchCustomer} disabled={isLoading} aria-label={uiT("Search customer", "ग्राहक खोजें")} className="btn-primary px-8 py-3">
            {isLoading ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Search size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Customer list */}
      {customers.length > 0 && !selectedCustomer && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-th-secondary uppercase tracking-wider">{customers.length} {uiT("customer(s) found", "ग्राहक मिले")}</p>
          {customers.map((c) => (
            <div key={c._id} onClick={() => selectCustomer(c)}
              role="button"
              aria-label={uiT("Select customer", "ग्राहक चुनें") + " " + (c.name || "")}
              className="bg-th-surface rounded-lg p-4 cursor-pointer hover:bg-th-card transition-all shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760] font-bold text-sm">
                    {c.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-th-text">{c.name}</p>
                    <p className="text-sm text-th-secondary">{c.mobile}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-th-muted" aria-hidden="true" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected customer flow */}
      {selectedCustomer && (
        <div className="bg-th-surface rounded-lg shadow-lg">
          {/* Customer header */}
          <div className="p-4 border-b border-th-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#1ed760]/10 rounded-full flex items-center justify-center text-[#1ed760] font-bold text-sm">
                  {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-semibold text-th-text">{selectedCustomer.name}</p>
                  <p className="text-sm text-th-secondary">{selectedCustomer.mobile}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomers([]); setOrders([]); setSelectedOrder(null); setBill(null); }}
                aria-label={uiT("Change customer", "ग्राहक बदलें")}
                className="text-sm text-th-secondary hover:text-th-text">{uiT("Change", "बदलें")}</button>
            </div>
          </div>

          {/* Order list */}
          {orders.length > 0 && !selectedOrder && (
            <div className="p-5 space-y-2">
              <p className="text-xs font-semibold text-th-secondary uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Package size={14} aria-hidden="true" /> {uiT("Orders Ready", "ऑर्डर तैयार")} ({orders.length})
              </p>
              {orders.map((o) => (
                <div key={o._id} onClick={() => selectOrder(o)}
                  role="button"
                  aria-label={uiT("Select order", "ऑर्डर चुनें")}
                  className="flex items-center justify-between p-4 rounded-lg bg-th-elevated hover:bg-th-card cursor-pointer transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-th-text truncate">
                      {[(o as any).frame, o.lensBrand, o.coating].filter(Boolean).join(" + ") || uiT("Order items", "ऑर्डर आइटम")}
                    </p>
                    <p className="text-xs text-th-secondary mt-0.5">
                      {o.deliveryDate && `Expected: ${new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {bills.some((b) => b.visitId === (o.visitId || o._id)) ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-[#1ed760] bg-[#1ed760]/10 px-2.5 py-1 rounded-lg">
                        <Check size={10} aria-hidden="true" /> {uiT("Billed", "बिल बनाया")}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-th-secondary bg-th-elevated px-2.5 py-1 rounded-lg border border-th-border">
                        {uiT("No Bill", "कोई बिल नहीं")}
                      </span>
                    )}
                    <ChevronRight size={16} className="text-th-muted" aria-hidden="true" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Selected order detail */}
          {selectedOrder && (
            <div className="p-5 space-y-5">
              {/* Order header */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-th-text flex items-center gap-1.5">
                  <Package size={15} className="text-[#1ed760]" aria-hidden="true" /> {uiT("Order Details", "ऑर्डर विवरण")}
                </h3>
                <button onClick={() => { setSelectedOrder(null); setBill(null); }}
                  aria-label={uiT("Change order", "ऑर्डर बदलें")}
                  className="text-xs text-[#1ed760] hover:text-[#1ed760]/80">{uiT("Change", "बदलें")}</button>
              </div>

              {/* Order items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(selectedOrder as any).frame && (
                  <div className="bg-th-elevated rounded-lg px-4 py-3">
                    <p className="text-[10px] text-[#1ed760] uppercase tracking-wider mb-0.5 flex items-center gap-1"><Glasses size={11} aria-hidden="true" /> {uiT("Frame", "फ्रेम")}</p>
                    <p className="text-sm font-medium text-th-text">{selectedOrder.frameBrand ? `${selectedOrder.frameBrand} ${selectedOrder.frameModel || ""}`.trim() : (selectedOrder as any).frame}</p>
                    {(selectedOrder as any).framePrice > 0 && <p className="text-xs text-th-secondary mt-0.5">₹{(selectedOrder as any).framePrice}</p>}
                  </div>
                )}
                {selectedOrder.lensBrand && (
                  <div className="bg-th-elevated rounded-lg px-4 py-3">
                    <p className="text-[10px] text-th-secondary uppercase tracking-wider mb-0.5 flex items-center gap-1"><Eye size={11} aria-hidden="true" /> {uiT("Lens", "लेंस")}</p>
                    <p className="text-sm font-medium text-th-text">{selectedOrder.lensBrand}{selectedOrder.lensType ? ` · ${selectedOrder.lensType}` : ""}</p>
                    {(selectedOrder as any).lensPrice > 0 && <p className="text-xs text-th-secondary mt-0.5">₹{(selectedOrder as any).lensPrice}</p>}
                  </div>
                )}
                {selectedOrder.deliveryDate && (
                  <div className="bg-th-elevated rounded-lg px-4 py-3">
                    <p className="text-[10px] text-th-secondary uppercase tracking-wider mb-0.5">{uiT("Delivery Date", "डिलीवरी तिथि")}</p>
                    <p className="text-sm font-medium">{new Date(selectedOrder.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                )}
              </div>

              {/* Bill section */}
              {bill ? (
                <div className="bg-th-elevated rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-th-text flex items-center gap-1.5">
                      <Receipt size={15} className="text-[#1ed760]" aria-hidden="true" /> {uiT("Bill Summary", "बिल सारांश")}
                    </h3>
                    <span className="text-xs font-medium text-[#1ed760] bg-[#1ed760]/10 px-2.5 py-0.5 rounded-lg">{bill.billNumber}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {(bill.items || []).map((it, i) => (
                      <div key={i} className="flex justify-between text-th-secondary">
                        <span className="text-xs">{it.description} ×{it.quantity || 1}</span>
                        <span>₹{((it.quantity || 1) * (it.unitPrice || 0)).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                  <hr className="border-th-border" />
                  {bill.subtotal > 0 && (
                    <div className="flex justify-between text-sm text-th-secondary">
                      <span>{uiT("Subtotal", "उप-कुल")}</span><span>₹{bill.subtotal?.toFixed(0)}</span>
                    </div>
                  )}
                  {bill.discount > 0 && (
                    <div className="flex justify-between text-sm text-[#e74c3c]">
                      <span>{uiT("Discount", "छूट")}</span><span>-₹{bill.discount?.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-th-text">
                    <span>{uiT("Total", "कुल")}</span><span>₹{bill.totalAmount?.toFixed(0) || "0"}</span>
                  </div>
                  {bill.advancePaid > 0 && (
                    <div className="flex justify-between text-sm text-[#1ed760] font-medium">
                      <span>{uiT("Advance Paid", "अग्रिम भुगतान")}</span><span>₹{bill.advancePaid?.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-[#e74c3c]">
                    <span>{uiT("Pending", "बाकी")}</span><span>₹{bill.pendingAmount?.toFixed(0) || "0"}</span>
                  </div>

                  {bill.pendingAmount > 0 && (
                    <>
                      <hr className="border-th-border" />
                      <div className="pt-1">
                        <h3 className="text-sm font-semibold text-th-text mb-2">{uiT("Collect Payment", "भुगतान एकत्र करें")}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-th-secondary mb-1">{uiT("Amount", "राशि")}</label>
                            <input type="number" step="0.01" className="input-field text-lg font-bold" aria-label={uiT("Collect amount", "एकत्र राशि")} value={collectAmount}
                              onChange={(e) => setCollectAmount(Number(e.target.value))} max={bill.pendingAmount} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-th-secondary mb-1">{uiT("Mode", "मोड")}</label>
                            <div className="grid grid-cols-3 gap-1">
                              {[uiT("Cash", "नकद"), "UPI", "Card"].map((m) => (
                                <button key={m} onClick={() => setCollectMode(m)}
                                  aria-label={uiT("Payment mode", "भुगतान मोड") + ": " + m}
                                  className={`py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all ${
                                    collectMode === m ? "bg-[#1ed760] text-black border-[#1ed760]" : "bg-th-elevated text-th-secondary border-th-border"
                                  }`}>{m}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : showCreateBill ? (
                <div className="bg-th-elevated rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-th-text flex items-center gap-1.5">
                    <FileText size={15} className="text-th-secondary" aria-hidden="true" /> {uiT("Create Bill", "बिल बनाएं")}
                  </h3>
                  <p className="text-xs text-th-secondary">{uiT("Items auto-filled from order. Adjust as needed.", "आइटम ऑर्डर से स्वतः भरे गए। आवश्यकतानुसार समायोजित करें।")}</p>
                  <div className="space-y-2">
                    {billItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start bg-th-elevated p-3 rounded-lg">
                        <div className="flex-1">
                          <input className="input-field text-sm" placeholder={uiT("Item description", "आइटम विवरण")} aria-label={uiT("Item description", "आइटम विवरण")} value={item.description}
                            onChange={(e) => updateBillItem(idx, "description", e.target.value)} />
                        </div>
                        <div className="w-16">
                          <input type="number" min="1" className="input-field text-sm text-center" placeholder={uiT("Qty", "मात्रा")} aria-label={uiT("Quantity", "मात्रा")} value={item.qty}
                            onChange={(e) => updateBillItem(idx, "qty", Number(e.target.value))} />
                        </div>
                        <div className="w-24">
                          <input type="number" min="0" step="0.01" className="input-field text-sm text-right" placeholder={uiT("Price", "मूल्य")} aria-label={uiT("Price", "मूल्य")} value={item.price}
                            onChange={(e) => updateBillItem(idx, "price", Number(e.target.value))} />
                        </div>
                        <div className="w-16 text-right pt-2.5 text-sm font-medium text-th-secondary">₹{(item.qty * item.price).toFixed(0)}</div>
                        <button onClick={() => removeBillItem(idx)}
                          aria-label={uiT("Remove bill item", "बिल आइटम हटाएं")}
                          className="p-2 hover:bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]"><X size={16} aria-hidden="true" /></button>
                      </div>
                    ))}
                    <button onClick={addBillItem}
                      aria-label={uiT("Add bill item", "बिल आइटम जोड़ें")}
                      className="flex items-center gap-1.5 text-sm text-[#1ed760] hover:text-[#1ed760]/80 font-medium">
                      <Plus size={14} aria-hidden="true" /> {uiT("Add Item", "आइटम जोड़ें")}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <label className="block text-xs font-medium text-th-secondary mb-1">{uiT("Discount", "छूट")} (₹)</label>
                      <input type="number" min="0" className="input-field text-sm" aria-label={uiT("Discount amount", "छूट राशि")} value={billDiscount}
                        onChange={(e) => setBillDiscount(Number(e.target.value))} />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-th-secondary">{uiT("Subtotal", "उप-कुल")}: <span className="font-medium text-th-text">₹{billSubtotal.toFixed(0)}</span></p>
                      <p className="text-lg font-bold text-th-text">{uiT("Total", "कुल")}: ₹{billTotal.toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleCreateBill} aria-label={uiT("Create bill", "बिल बनाएं")} className="btn-primary flex items-center gap-2 px-6 py-3">
                      <Plus size={18} aria-hidden="true" /> {uiT("Create Bill", "बिल बनाएं")} — ₹{billTotal.toFixed(0)}
                    </button>
                    <button onClick={() => setShowCreateBill(false)} aria-label={uiT("Cancel bill creation", "बिल निर्माण रद्द करें")} className="btn-secondary px-6 py-3">{uiT("Cancel", "रद्द करें")}</button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3 bg-th-elevated rounded-lg">
                  <FileText size={32} className="mx-auto text-th-muted" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-medium text-th-secondary">{uiT("No bill found for this order", "इस ऑर्डर के लिए कोई बिल नहीं मिला")}</p>
                    <p className="text-xs text-th-muted mt-0.5">{uiT("Create a bill from the order items to proceed.", "आगे बढ़ने के लिए ऑर्डर आइटम से बिल बनाएं।")}</p>
                  </div>
                  <button onClick={() => setShowCreateBill(true)} aria-label={uiT("Create bill from order", "ऑर्डर से बिल बनाएं")} className="btn-primary btn-sm flex items-center gap-1 mx-auto">
                    <Plus size={14} aria-hidden="true" /> {uiT("Create Bill", "बिल बनाएं")}
                  </button>
                </div>
              )}

              {/* Messages */}
              {message && (
                <div className={`rounded-lg p-3 text-sm ${
                  message.includes("✓") ? "bg-[#1ed760]/10 text-[#1ed760]" :
                  "bg-[#e74c3c]/10 text-[#e74c3c]"
                }`}>
                  {message}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-3 border-t border-th-border">
                <button onClick={() => setShowConfirmDeliver(true)} disabled={delivering || !bill || collectAmount <= 0}
                  aria-label={uiT("Deliver order", "ऑर्डर डिलीवर करें")}
                  className="bg-[#1ed760] hover:bg-[#1db954] text-black font-bold uppercase tracking-wider text-xs rounded-lg flex items-center gap-2 px-8 py-3.5 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all shadow-[0_8px_24px_rgb(30,215,96,0.3)]">
                  {delivering ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}
                  {(selectedOrder as any)?.status === "Delivered"
                    ? `${uiT("Collect Payment", "भुगतान एकत्र करें")} ₹${collectAmount}`
                    : (bill?.pendingAmount ?? 0) > 0
                      ? `${uiT("Deliver & Collect", "डिलीवर करें और एकत्र करें")} ₹${collectAmount}`
                      : uiT("Mark Delivered", "डिलीवर चिन्हित करें")}
                </button>
                <button onClick={() => navigate(`/customers/${selectedCustomer._id}`)}
                  aria-label={uiT("View customer profile", "ग्राहक प्रोफ़ाइल देखें")}
                  className="bg-th-elevated hover:bg-th-hover text-th-text font-bold uppercase tracking-wider text-xs rounded-lg flex items-center gap-2 px-6 py-3.5 transition-all">
                  <User size={20} aria-hidden="true" /> {uiT("View Profile", "प्रोफ़ाइल देखें")}
                </button>
              </div>
              {!bill && <p className="text-xs text-amber-500 text-center">{uiT("Create a bill first to mark as delivered", "डिलीवर चिन्हित करने के लिए पहले बिल बनाएं")}</p>}

              {/* Confirm modal */}
              {showConfirmDeliver && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowConfirmDeliver(false)}>
                  <div className="bg-th-surface rounded-lg p-6 max-w-sm w-full mx-4 shadow-lg animate-scale-in" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 bg-[#1ed760]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package size={24} className="text-[#1ed760]" aria-hidden="true" />
                    </div>
                    {(selectedOrder as any)?.status === "Delivered" ? (
                      <>
                        <h3 className="text-lg font-bold text-th-text text-center mb-2">{uiT("Collect Payment", "भुगतान एकत्र करें")}</h3>
                        <p className="text-sm text-th-secondary text-center mb-5">
                          {uiT("Collect", "एकत्र करें")} ₹{collectAmount} {uiT("via", "द्वारा")} {collectMode}?
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-bold text-th-text text-center mb-2">{uiT("Confirm Delivery", "डिलीवरी की पुष्टि करें")}</h3>
                        <p className="text-sm text-th-secondary text-center mb-5">
                          {collectAmount > 0
                            ? `Mark as delivered and collect ₹${collectAmount} via ${collectMode}?`
                            : uiT("Mark this order as Delivered?", "इस ऑर्डर को डिलीवर चिन्हित करें?")}
                        </p>
                      </>
                    )}
                    <div className="space-y-2">
                      <button onClick={handleDeliver} disabled={delivering}
                        aria-label={uiT("Confirm", "पुष्टि करें")}
                        className="w-full bg-[#1ed760] hover:bg-[#1db954] text-black font-bold uppercase tracking-wider text-xs rounded-lg flex items-center justify-center gap-2 py-3.5 disabled:opacity-50 active:scale-95 transition-all shadow-[0_8px_24px_rgb(30,215,96,0.3)]">
                        {delivering ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <Check size={20} aria-hidden="true" />}
                        {(selectedOrder as any)?.status === "Delivered"
                          ? (delivering ? uiT("Collecting...", "एकत्र हो रहा है...") : uiT("Confirm Collection", "एकत्रीकरण की पुष्टि करें"))
                          : (delivering ? uiT("Delivering...", "डिलीवर हो रहा है...") : uiT("Confirm Delivery", "डिलीवरी की पुष्टि करें"))}
                      </button>
                      <button onClick={() => setShowConfirmDeliver(false)} disabled={delivering}
                        aria-label={uiT("Cancel", "रद्द करें")}
                        className="w-full bg-th-elevated hover:bg-th-hover text-th-text font-bold uppercase tracking-wider text-xs rounded-lg py-3.5 transition-all">{uiT("Cancel", "रद्द करें")}</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading && <PageSkeleton page="pickup" />}
    </div>
  );
}

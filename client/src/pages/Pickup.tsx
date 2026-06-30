import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Toast from "../components/Toast";
import PageSkeleton from "../components/PageSkeleton";
import { Search, Phone, Check, ChevronRight, Plus, Loader2, Package, Clock, X, User, FileText, CreditCard, Receipt, Glasses, Eye, FlaskConical } from "lucide-react";

export default function Pickup() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [readyOrders, setReadyOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [bill, setBill] = useState<any>(null);
  const [bills, setBills] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectMode, setCollectMode] = useState("Cash");
  const [delivering, setDelivering] = useState(false);
  const [waStatus, setWaStatus] = useState<string>("checking");
  const [message, setMessage] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [showCreateBill, setShowCreateBill] = useState(false);
  const [billItems, setBillItems] = useState<{ description: string; qty: number; price: number }[]>([{ description: "", qty: 1, price: 0 }]);
  const [billDiscount, setBillDiscount] = useState(0);
  const [showConfirmDeliver, setShowConfirmDeliver] = useState(false);

  const billSubtotal = billItems.reduce((s, i) => s + i.qty * i.price, 0);
  const billTotal = Math.max(0, billSubtotal - billDiscount);

  useEffect(() => {
    api.get("/api/settings").then((d) => { if (d.success) setSettings(d.data); });
    api.get("/api/whatsapp/status").then((d) => { if (d.success) setWaStatus(d.data.status); });
    fetchReadyOrders();
  }, []);

  async function fetchReadyOrders() {
    const res = await api.get("/api/orders");
    if (res.success) {
      setReadyOrders((res.data || []).filter((o: any) => o.status === "Ready"));
    }
  }

  async function searchCustomer() {
    const num = phone.replace(/\D/g, "");
    if (num.length < 3) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/customers?phone=${encodeURIComponent(num)}`);
      if (res.success && res.data.length > 0) { setCustomers(res.data); setMessage(""); }
      else { setCustomers([]); setMessage("No customer found with this number"); }
    } finally { setIsLoading(false); setSelectedCustomer(null); setOrders([]); setSelectedOrder(null); setBill(null); }
  }

  async function pickReadyOrder(o: any) {
    const mobile = typeof o.customerId === "object" ? o.customerId?.mobile : "";
    if (!mobile) return;
    setPhone(mobile);
    setIsLoading(true);
    try {
      const res = await api.get(`/api/customers?phone=${encodeURIComponent(mobile)}`);
      if (res.success && res.data.length > 0) {
        setCustomers(res.data);
        const c = res.data[0];
        setSelectedCustomer(c);
        const [ordersRes, billsRes] = await Promise.all([
          api.get(`/api/orders?customerId=${c._id}`), api.get("/api/bills"),
        ]);
        if (ordersRes.success) setOrders((ordersRes.data || []).filter((o2: any) => o2.status === "Ready"));
        let custBills: any[] = [];
        if (billsRes.success) {
          custBills = (billsRes.data || []).filter((b: any) => b.customerId === c._id);
          setBills(custBills);
        }
        setSelectedOrder(o);
        await syncBillForOrder(o, custBills);
      }
    } finally { setIsLoading(false); }
  }

  async function syncBillForOrder(o: any, custBills?: any[]): Promise<any> {
    const targetId = o.visitId || o._id;
    let b = (custBills || bills).find((b: any) => b.visitId === targetId) || null;
    if (!b && o.billInfo?._id) {
      try {
        const res = await api.get(`/api/bills/${o.billInfo._id}`);
        if (res.success) {
          b = res.data;
          setBills((prev) => {
            const exists = prev.some((x) => x._id === b._id);
            return exists ? prev : [...prev, b];
          });
        }
      } catch {}
    }
    setBill(b);
    if (!b) {
      const items: { description: string; qty: number; price: number }[] = [];
      if (o.frame) items.push({ description: o.frameBrand ? `${o.frame} (${o.frameBrand})` : o.frame, qty: 1, price: o.framePrice || 0 });
      if (o.lens) items.push({ description: o.lensBrand ? `${o.lens} (${o.lensBrand})` : o.lens, qty: 1, price: o.lensPrice || 0 });
      if (o.coating) items.push({ description: o.coating, qty: 1, price: o.coatingPrice || 0 });
      if (o.accessories?.length) {
        o.accessories.forEach((a: string) => items.push({ description: a, qty: 1, price: 0 }));
      }
      if (items.length === 0) items.push({ description: "", qty: 1, price: 0 });
      setBillItems(items);
      setBillDiscount(0);
    } else {
      setCollectAmount(b.pendingAmount > 0 ? b.pendingAmount : 0);
    }
    return b;
  }

  async function selectCustomer(c: any) {
    setSelectedCustomer(c); setShowCreateBill(false); setIsLoading(true);
    try {
      const [ordersRes, billsRes] = await Promise.all([
        api.get(`/api/orders?customerId=${c._id}`), api.get("/api/bills"),
      ]);
      if (ordersRes.success) {
        const pending = (ordersRes.data || []).filter((o: any) => o.status === "Ready");
        setOrders(pending);
        if (pending.length === 0) setMessage("No orders ready for pickup");
      }
      if (billsRes.success) {
        const custBills = (billsRes.data || []).filter((b: any) => b.customerId === c._id)
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setBills(custBills);
      }
    } finally { setIsLoading(false); }
  }

  async function selectOrder(o: any) {
    setSelectedOrder(o); setMessage(""); setShowCreateBill(false);
    const b = await syncBillForOrder(o);
    if (b) {
      setCollectAmount(b.pendingAmount > 0 ? b.pendingAmount : 0);
      setBill(b);
    } else {
      setBill(null);
      const items: { description: string; qty: number; price: number }[] = [];
      if (o.frame) items.push({ description: o.frameBrand ? `${o.frame} (${o.frameBrand})` : o.frame, qty: 1, price: o.framePrice || 0 });
      if (o.lens) items.push({ description: o.lensBrand ? `${o.lens} (${o.lensBrand})` : o.lens, qty: 1, price: o.lensPrice || 0 });
      if (o.coating) items.push({ description: o.coating, qty: 1, price: o.coatingPrice || 0 });
      if (o.accessories?.length) {
        o.accessories.forEach((a: string) => items.push({ description: a, qty: 1, price: 0 }));
      }
      if (items.length === 0) items.push({ description: "", qty: 1, price: 0 });
      setBillItems(items); setBillDiscount(0);
    }
  }

  function addBillItem() { setBillItems([...billItems, { description: "", qty: 1, price: 0 }]); }
  function updateBillItem(idx: number, field: string, value: any) {
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
    if (items.length === 0) { setMessage("Add at least one item with description and price"); return; }
    const res = await api.post("/api/bills", {
      customerId: selectedCustomer._id, visitId: selectedOrder.visitId,
      items: items.map((i) => ({ description: i.description, quantity: i.qty, unitPrice: i.price })),
      discount: billDiscount, tax: 0, advancePaid: 0,
    });
    if (res.success) {
      setBill(res.data); setCollectAmount(res.data.pendingAmount || 0); setShowCreateBill(false);
      setMessage("✓ Bill created successfully");
      const billsRes = await api.get("/api/bills");
      if (billsRes.success) setBills((billsRes.data || []).filter((b: any) => b.customerId === selectedCustomer._id));
      setToast({ message: "Bill created", type: "success" });
    } else { setMessage(res.message || "Failed to create bill"); }
  }

  async function handleDeliver() {
    if (!selectedOrder) return;
    setDelivering(true); setMessage("");
    const payload: any = { status: "Delivered" };
    if (collectAmount > 0) { payload.collectPayment = collectAmount; payload.paymentMode = collectMode; }
    const res = await api.patch(`/api/orders/${selectedOrder._id}/status`, payload);
    if (res.success) {
      setMessage("✓ Order delivered successfully!");
      setToast({ message: "Order delivered — notification sent", type: "success" });
      fetchReadyOrders();
      selectCustomer(selectedCustomer); setSelectedOrder(null); setBill(null);
    } else { setMessage(res.message || "Failed to deliver order"); setToast({ message: res.message || "Failed to deliver", type: "error" }); }
    setDelivering(false); setShowConfirmDeliver(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white">
              <Package size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pickup</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Collect ready orders and manage deliveries.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {waStatus === "connected" ? (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                WhatsApp Connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-dark-700 text-gray-500 rounded-full text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                WhatsApp {waStatus === "checking" ? "..." : "Disconnected"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Ready orders grid */}
      {readyOrders.length > 0 && !selectedCustomer && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-emerald-500" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {readyOrders.length} order(s) ready for pickup
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {readyOrders.map((o: any) => {
              const cName = typeof o.customerId === "object" ? o.customerId?.name : "";
              const cMobile = typeof o.customerId === "object" ? o.customerId?.mobile : "";
              const totalPrice = (o.framePrice || 0) + (o.lensPrice || 0) + (o.coatingPrice || 0);
              return (
                <div key={o._id} onClick={() => pickReadyOrder(o)}
                  className="card cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-750 transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">
                      {(cName?.charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{cName || "—"}</p>
                      {cMobile && <p className="text-xs text-gray-400">{cMobile}</p>}
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Ready</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {o.frameBrand ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 px-2 py-0.5 rounded-md text-indigo-700 dark:text-indigo-300 font-medium truncate max-w-full">
                        <Glasses size={11} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" /> {o.frameBrand}{o.frameModel ? ` ${o.frameModel}` : ""}
                      </span>
                    ) : o.frame ? (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/30 px-2 py-0.5 rounded-md text-indigo-700 dark:text-indigo-300 font-medium truncate max-w-full">
                        <Glasses size={11} className="text-indigo-500 dark:text-indigo-400 flex-shrink-0" /> {o.frame}
                      </span>
                    ) : null}
                    {o.lensBrand && (
                      <span className="inline-flex items-center gap-1 text-[11px] bg-sky-50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/30 px-2 py-0.5 rounded-md text-sky-700 dark:text-sky-300 font-medium truncate max-w-full">
                        <Eye size={11} className="text-sky-500 dark:text-sky-400 flex-shrink-0" /> {o.lensBrand}{o.lens ? ` · ${o.lens}` : ""}
                      </span>
                    )}
                    {(o.accessories || []).map((a: string, i: number) => {
                      const lower = a.toLowerCase();
                      const accIcon = lower.includes("clean") || lower.includes("solution") ? <FlaskConical size={11} className="text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                        : lower.includes("contact") || lower.includes("lens") ? <Circle size={11} className="text-amber-500 dark:text-amber-400 flex-shrink-0" />
                        : <Package size={11} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />;
                      return (
                        <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-gray-50 dark:bg-dark-700 border border-gray-100 dark:border-dark-600 px-2 py-0.5 rounded-md text-gray-600 dark:text-gray-300 font-medium truncate max-w-full">
                          {accIcon} {a}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-dark-700">
                    {o.deliveryDate ? (
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={10} /> {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                      {o.billInfo?.totalAmount > 0 && <span className="text-sm font-bold text-gray-900 dark:text-white">₹{o.billInfo.totalAmount.toLocaleString()}</span>}
                      <ChevronRight size={16} className="text-gray-300" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-200 dark:border-dark-700 shadow-sm p-5">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="tel" placeholder="Search by mobile number..."
              value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") searchCustomer(); }}
              className="input-field pl-10 text-base" />
          </div>
          <button onClick={searchCustomer} disabled={isLoading} className="btn-primary px-8 py-3">
            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
          </button>
        </div>
      </div>

      {/* Customer list */}
      {customers.length > 0 && !selectedCustomer && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{customers.length} customer(s) found</p>
          {customers.map((c: any) => (
            <div key={c._id} onClick={() => selectCustomer(c)}
              className="card cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-750 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">
                    {c.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.mobile}</p>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-300" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected customer flow */}
      {selectedCustomer && (
        <div className="card">
          {/* Customer header */}
          <div className="p-4 border-b border-gray-200 dark:border-dark-600">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-50 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm">
                  {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">{selectedCustomer.name}</p>
                  <p className="text-sm text-gray-500">{selectedCustomer.mobile}</p>
                </div>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomers([]); setOrders([]); setSelectedOrder(null); setBill(null); }}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Change</button>
            </div>
          </div>

          {/* Order list */}
          {orders.length > 0 && !selectedOrder && (
            <div className="p-5 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Package size={14} /> Orders Ready ({orders.length})
              </p>
              {orders.map((o: any) => (
                <div key={o._id} onClick={() => selectOrder(o)}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 cursor-pointer transition-all">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {[o.frame, o.lens, o.coating].filter(Boolean).join(" + ") || "Order items"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {o.deliveryDate && `Expected: ${new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {bills.some((b) => b.visitId === (o.visitId || o._id)) ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-full">
                        <Check size={10} /> Billed
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2.5 py-1 rounded-full">
                        No Bill
                      </span>
                    )}
                    <ChevronRight size={16} className="text-gray-300" />
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
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Package size={15} className="text-primary-500" /> Order Details
                </h3>
                <button onClick={() => { setSelectedOrder(null); setBill(null); }}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700">Change</button>
              </div>

              {/* Order items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {selectedOrder.frame && (
                  <div className="bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl px-4 py-3 border border-indigo-100 dark:border-indigo-800/20">
                    <p className="text-[10px] text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Glasses size={11} /> Frame</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedOrder.frameBrand ? `${selectedOrder.frameBrand} ${selectedOrder.frameModel || ""}`.trim() : selectedOrder.frame}</p>
                    {selectedOrder.framePrice > 0 && <p className="text-xs text-gray-500 mt-0.5">₹{selectedOrder.framePrice}</p>}
                  </div>
                )}
                {selectedOrder.lensBrand && (
                  <div className="bg-sky-50/50 dark:bg-sky-900/10 rounded-xl px-4 py-3 border border-sky-100 dark:border-sky-800/20">
                    <p className="text-[10px] text-sky-500 dark:text-sky-400 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Eye size={11} /> Lens</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{selectedOrder.lensBrand}{selectedOrder.lens ? ` · ${selectedOrder.lens}` : ""}</p>
                    {selectedOrder.lensPrice > 0 && <p className="text-xs text-gray-500 mt-0.5">₹{selectedOrder.lensPrice}</p>}
                  </div>
                )}
                {selectedOrder.deliveryDate && (
                  <div className="bg-gray-50 dark:bg-dark-750 rounded-xl px-4 py-3 border border-gray-100 dark:border-dark-700">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Delivery Date</p>
                    <p className="text-sm font-medium">{new Date(selectedOrder.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                )}
              </div>

              {/* Bill section */}
              {bill ? (
                <div className="bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-900/20 dark:to-dark-800 rounded-xl border border-emerald-200 dark:border-emerald-800 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Receipt size={15} className="text-emerald-500" /> Bill Summary
                    </h3>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 rounded-full">{bill.billNumber}</span>
                  </div>
                  <div className="space-y-1 text-sm">
                    {(bill.items || []).map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-gray-600 dark:text-gray-400">
                        <span className="text-xs">{it.description} ×{it.quantity || 1}</span>
                        <span>₹{((it.quantity || 1) * (it.unitPrice || 0)).toFixed(0)}</span>
                      </div>
                    ))}
                  </div>
                  <hr className="border-emerald-200 dark:border-emerald-800" />
                  {bill.subtotal > 0 && (
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>Subtotal</span><span>₹{bill.subtotal?.toFixed(0)}</span>
                    </div>
                  )}
                  {bill.discount > 0 && (
                    <div className="flex justify-between text-sm text-red-500">
                      <span>Discount</span><span>-₹{bill.discount?.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-white">
                    <span>Total</span><span>₹{bill.totalAmount?.toFixed(0) || "0"}</span>
                  </div>
                  {bill.advancePaid > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600 font-medium">
                      <span>Advance Paid</span><span>₹{bill.advancePaid?.toFixed(0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold text-amber-600">
                    <span>Pending</span><span>₹{bill.pendingAmount?.toFixed(0) || "0"}</span>
                  </div>

                  {bill.pendingAmount > 0 && (
                    <>
                      <hr className="border-emerald-200 dark:border-emerald-800" />
                      <div className="pt-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Collect Payment</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Amount</label>
                            <input type="number" step="0.01" className="input-field text-lg font-bold" value={collectAmount}
                              onChange={(e) => setCollectAmount(Number(e.target.value))} max={bill.pendingAmount} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Mode</label>
                            <div className="grid grid-cols-3 gap-1">
                              {["Cash", "UPI", "Card"].map((m) => (
                                <button key={m} onClick={() => setCollectMode(m)}
                                  className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                                    collectMode === m ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-dark-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-700"
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
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <FileText size={15} className="text-amber-500" /> Create Bill
                  </h3>
                  <p className="text-xs text-amber-600 dark:text-amber-400">Items auto-filled from order. Adjust as needed.</p>
                  <div className="space-y-2">
                    {billItems.map((item, idx) => (
                      <div key={idx} className="flex gap-2 items-start bg-white dark:bg-dark-800 p-3 rounded-xl border border-amber-100 dark:border-amber-900/40">
                        <div className="flex-1">
                          <input className="input-field text-sm" placeholder="Item description" value={item.description}
                            onChange={(e) => updateBillItem(idx, "description", e.target.value)} />
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
                        <button onClick={() => removeBillItem(idx)}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-400"><X size={16} /></button>
                      </div>
                    ))}
                    <button onClick={addBillItem}
                      className="flex items-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
                      <Plus size={14} /> Add Item
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Discount (₹)</label>
                      <input type="number" min="0" className="input-field text-sm" value={billDiscount}
                        onChange={(e) => setBillDiscount(Number(e.target.value))} />
                    </div>
                    <div className="flex-1 text-right">
                      <p className="text-xs text-gray-500">Subtotal: <span className="font-medium text-gray-700 dark:text-gray-300">₹{billSubtotal.toFixed(0)}</span></p>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">Total: ₹{billTotal.toFixed(0)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={handleCreateBill} className="btn-primary flex items-center gap-2 px-6 py-3">
                      <Plus size={18} /> Create Bill — ₹{billTotal.toFixed(0)}
                    </button>
                    <button onClick={() => setShowCreateBill(false)} className="btn-secondary px-6 py-3">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 space-y-3 bg-gray-50 dark:bg-dark-750 rounded-xl border border-dashed border-gray-200 dark:border-dark-700">
                  <FileText size={32} className="mx-auto text-gray-300 dark:text-gray-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-500">No bill found for this order</p>
                    <p className="text-xs text-gray-400 mt-0.5">Create a bill from the order items to proceed.</p>
                  </div>
                  <button onClick={() => setShowCreateBill(true)} className="btn-primary btn-sm flex items-center gap-1 mx-auto">
                    <Plus size={14} /> Create Bill
                  </button>
                </div>
              )}

              {/* Messages */}
              {message && (
                <div className={`rounded-xl p-3 text-sm ${
                  message.includes("✓") ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                  "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                }`}>
                  {message}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-200 dark:border-dark-700">
                <button onClick={() => setShowConfirmDeliver(true)} disabled={delivering || !bill}
                  className="btn-success flex items-center gap-2 px-8 py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed">
                  {delivering ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                  {bill?.pendingAmount > 0 ? `Deliver & Collect ₹${collectAmount}` : "Mark Delivered"}
                </button>
                <button onClick={() => navigate(`/customers/${selectedCustomer._id}`)}
                  className="btn-secondary flex items-center gap-2 px-6 py-3.5 text-base">
                  <User size={20} /> View Profile
                </button>
              </div>
              {!bill && <p className="text-xs text-amber-500 text-center">Create a bill first to mark as delivered</p>}

              {/* Confirm Delivery modal */}
              {showConfirmDeliver && (
                <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setShowConfirmDeliver(false)}>
                  <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Package size={24} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">Confirm Delivery</h3>
                    <p className="text-sm text-gray-500 text-center mb-5">
                      {collectAmount > 0
                        ? `Mark as delivered and collect ₹${collectAmount} via ${collectMode}?`
                        : "Mark this order as Delivered?"}
                    </p>
                    <div className="space-y-2">
                      <button onClick={handleDeliver} disabled={delivering}
                        className="w-full btn-success flex items-center justify-center gap-2 py-3.5 text-base disabled:opacity-50">
                        {delivering ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                        {delivering ? "Delivering..." : "Confirm Delivery"}
                      </button>
                      <button onClick={() => setShowConfirmDeliver(false)} disabled={delivering}
                        className="w-full btn-secondary py-3.5 text-base">Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading && <PageSkeleton page="pickup" />}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

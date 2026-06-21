import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Toast from "../components/Toast";
import { Search, Phone, Check, ChevronRight, Plus, Loader2, Package, Clock, X } from "lucide-react";

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
  const [billForm, setBillForm] = useState({ description: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 });

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
        if (billsRes.success) setBills((billsRes.data || []).filter((b: any) => b.customerId === c._id));
        setSelectedOrder(o);
        const b = (billsRes.data || []).find((b: any) => b.customerId === c._id) || null;
        setBill(b);
        if (b) setCollectAmount(b.pendingAmount > 0 ? b.pendingAmount : 0);
      }
    } finally { setIsLoading(false); }
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
        setBills((billsRes.data || []).filter((b: any) => b.customerId === c._id)
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      }
    } finally { setIsLoading(false); }
  }

  function findBillForOrder(o: any): any {
    const custId = o.customerId?._id || o.customerId;
    return bills.find((b: any) => b.customerId === custId) || null;
  }

  async function selectOrder(o: any) {
    setSelectedOrder(o); setMessage(""); setShowCreateBill(false);
    const b = findBillForOrder(o);
    setBill(b);
    if (b) { setCollectAmount(b.pendingAmount > 0 ? b.pendingAmount : 0); }
    else {
      const itemTotal = (o.framePrice || 0) + (o.lensPrice || 0) + (o.coatingPrice || 0);
      setBillForm({
        description: `Frame: ${o.frame || ""}, Lens: ${o.lens || ""}${o.coating ? `, Coating: ${o.coating}` : ""}`,
        quantity: o.quantity || 1, unitPrice: itemTotal > 0 ? itemTotal / (o.quantity || 1) : 0, discount: 0, tax: 0,
      });
    }
  }

  async function handleCreateBill() {
    if (!selectedCustomer || !selectedOrder) return;
    const items = [{ description: billForm.description || "Optical items", quantity: billForm.quantity, unitPrice: billForm.unitPrice }];
    const res = await api.post("/api/bills", {
      customerId: selectedCustomer._id, visitId: selectedOrder.visitId, items,
      discount: billForm.discount, tax: billForm.tax, advancePaid: 0,
    });
    if (res.success) {
      setBill(res.data); setCollectAmount(res.data.pendingAmount || 0); setShowCreateBill(false);
      setMessage("✓ Bill created");
      const billsRes = await api.get("/api/bills");
      if (billsRes.success) setBills((billsRes.data || []).filter((b: any) => b.customerId === selectedCustomer._id));
    } else { setMessage(res.message || "Failed to create bill"); }
  }

  const [showConfirmDeliver, setShowConfirmDeliver] = useState(false);

  async function handleDeliver() {
    if (!selectedOrder) return;
    setDelivering(true); setMessage("");
    const payload: any = { status: "Delivered" };
    if (collectAmount > 0) { payload.collectPayment = collectAmount; payload.paymentMode = collectMode; }
    const res = await api.patch(`/api/orders/${selectedOrder._id}/status`, payload);
    if (res.success) {
      setMessage("✓ Order delivered successfully!");
      setToast({ message: "Order delivered — notification sent", type: "success" });
      selectCustomer(selectedCustomer); setSelectedOrder(null); setBill(null);
    } else { setMessage(res.message || "Failed to deliver order"); setToast({ message: res.message || "Failed to deliver", type: "error" }); }
    setDelivering(false); setShowConfirmDeliver(false);
  }

  return (
    <div className="max-w-3xl mx-auto page-container">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pickup</h1>
          <p className="page-subtitle">Collect ready orders, finalize billing, and mark as delivered.</p>
        </div>
        {waStatus === "connected" && (
          <span className="badge-green flex items-center gap-1.5 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            WhatsApp Connected
          </span>
        )}
      </div>

      {/* Ready orders cards */}
      {readyOrders.length > 0 && !selectedCustomer && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {readyOrders.length} order(s) ready for pickup
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
            {readyOrders.map((o: any) => {
              const cName = typeof o.customerId === "object" ? o.customerId?.name : "";
              const cMobile = typeof o.customerId === "object" ? o.customerId?.mobile : "";
              return (
                <div key={o._id} onClick={() => pickReadyOrder(o)}
                  className="bg-white dark:bg-dark-800 rounded-2xl border border-gray-100 dark:border-dark-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-sm flex-shrink-0">
                      {(cName?.charAt(0) || "?").toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{cName || "—"}</p>
                      {cMobile && <p className="text-[11px] text-gray-400 truncate">{cMobile}</p>}
                    </div>
                    <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Ready</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {o.frame && <span className="text-[10px] bg-gray-50 dark:bg-dark-700 border border-gray-100 dark:border-dark-600 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400">Frm: {o.frame}</span>}
                    {o.lens && <span className="text-[10px] bg-gray-50 dark:bg-dark-700 border border-gray-100 dark:border-dark-600 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400">Lens: {o.lens}</span>}
                    {o.coating && <span className="text-[10px] bg-gray-50 dark:bg-dark-700 border border-gray-100 dark:border-dark-600 px-2 py-0.5 rounded text-gray-500 dark:text-gray-400">Coat: {o.coating}</span>}
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    {o.deliveryDate ? (
                      <span className="flex items-center gap-1 text-gray-400"><Clock size={10} /> {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    ) : <span />}
                    {o.billInfo?.totalAmount > 0 && (
                      <span className="font-semibold text-gray-900 dark:text-white">₹{o.billInfo.totalAmount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search by phone */}
      <div className="card">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="tel" placeholder="Search by mobile number..."
              value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") searchCustomer(); }}
              className="input-field pl-10 text-base" />
          </div>
          <button onClick={searchCustomer} disabled={isLoading} className="btn-primary px-6">
            <Search size={18} />
          </button>
        </div>
      </div>

      {customers.length > 0 && !selectedCustomer && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500">{customers.length} customer(s) found</p>
          {customers.map((c: any) => (
            <div key={c._id} onClick={() => selectCustomer(c)}
              className="card cursor-pointer hover:border-primary-200 dark:hover:border-primary-800 hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-all p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                    {c.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                    <p className="text-sm text-gray-500">{c.mobile}</p>
                  </div>
                </div>
                <span className="text-primary-600 dark:text-primary-400 text-sm font-medium">Select →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedCustomer && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/40 dark:to-primary-800/20 rounded-full flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-lg">
                {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">{selectedCustomer.name}</p>
                <p className="text-sm text-gray-500">{selectedCustomer.mobile}</p>
              </div>
            </div>
            <button onClick={() => { setSelectedCustomer(null); setCustomers([]); setOrders([]); setSelectedOrder(null); setBill(null); }}
              className="btn-ghost btn-sm">Change</button>
          </div>

          {orders.length > 0 && !selectedOrder && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500 mb-3">{orders.length} order(s) ready for pickup</p>
              {orders.map((o: any) => (
                <div key={o._id} onClick={() => selectOrder(o)}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-dark-700 hover:border-primary-300 dark:hover:border-primary-700 cursor-pointer transition-all">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {o.frame && `Frame: ${o.frame}`}{o.frame && o.lens ? " | " : ""}{o.lens && `Lens: ${o.lens}`}
                      {o.framePrice || o.lensPrice ? ` (₹${(o.framePrice||0)+(o.lensPrice||0)+(o.coatingPrice||0)})` : ""}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Status: <span className="font-medium text-blue-500">{o.status}</span>
                      {o.deliveryDate && ` | Expected: ${new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {findBillForOrder(o) ? <span className="badge-green text-xs">Has Bill</span> : <span className="badge-yellow text-xs">No Bill</span>}
                    <ChevronRight size={18} className="text-gray-400" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="section-title">Order Details</h3>
                <button onClick={() => { setSelectedOrder(null); setBill(null); }}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700">Change</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm bg-gray-50 dark:bg-dark-750 rounded-xl p-4">
                {selectedOrder.frame && <div><span className="text-gray-500">Frame:</span> <span className="font-medium">{selectedOrder.frame}</span></div>}
                {selectedOrder.lens && <div><span className="text-gray-500">Lens:</span> <span className="font-medium">{selectedOrder.lens}</span></div>}
                {selectedOrder.coating && <div><span className="text-gray-500">Coating:</span> <span className="font-medium">{selectedOrder.coating}</span></div>}
                {selectedOrder.quantity && <div><span className="text-gray-500">Qty:</span> <span className="font-medium">{selectedOrder.quantity}</span></div>}
              </div>

              {bill ? (
                <div className="border-t border-gray-200 dark:border-dark-700 pt-4">
                  <h3 className="section-title mb-3">Bill Summary</h3>
                  <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4 space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-500">Bill #</span><span className="font-medium">{bill.billNumber}</span></div>
                    {(bill.items || []).map((it: any, i: number) => (
                      <div key={i} className="flex justify-between text-gray-500 text-xs">
                        <span>{it.description}</span><span>₹{(it.quantity||1)*(it.unitPrice||0)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-dark-700"><span>Total</span><span className="font-bold">₹{bill.totalAmount?.toFixed(0) || "0"}</span></div>
                    <div className="flex justify-between text-emerald-600"><span>Advance Paid</span><span className="font-medium">₹{bill.advancePaid?.toFixed(0) || "0"}</span></div>
                    <div className="flex justify-between text-amber-500 font-medium pt-2 border-t border-gray-200 dark:border-dark-700"><span>Pending</span><span>₹{bill.pendingAmount?.toFixed(0) || "0"}</span></div>
                  </div>

                  {bill.pendingAmount > 0 && (
                    <div className="border-t border-gray-200 dark:border-dark-700 pt-4 mt-4">
                      <h3 className="section-title mb-3">Collect Payment</h3>
                      <div className="grid grid-cols-2 gap-3 mb-3">
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
                  )}
                </div>
              ) : (
                <div className="border-t border-gray-200 dark:border-dark-700 pt-4">
                  {showCreateBill ? (
                    <div className="space-y-3">
                      <h3 className="section-title">Create Bill</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                          <input className="input-field" value={billForm.description} onChange={(e) => setBillForm({...billForm, description: e.target.value})} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                          <input type="number" className="input-field" value={billForm.quantity} onChange={(e) => setBillForm({...billForm, quantity: Number(e.target.value)})} min="1" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Unit Price</label>
                          <input type="number" className="input-field" value={billForm.unitPrice} onChange={(e) => setBillForm({...billForm, unitPrice: Number(e.target.value)})} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Discount</label>
                          <input type="number" className="input-field" value={billForm.discount} onChange={(e) => setBillForm({...billForm, discount: Number(e.target.value)})} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">Tax</label>
                          <input type="number" className="input-field" value={billForm.tax} onChange={(e) => setBillForm({...billForm, tax: Number(e.target.value)})} />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleCreateBill} className="btn-primary btn-sm flex items-center gap-1">
                          <Plus size={14} /> Create Bill
                        </button>
                        <button onClick={() => setShowCreateBill(false)} className="btn-ghost btn-sm">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-amber-500 mb-2">No bill found for this order</p>
                      <button onClick={() => setShowCreateBill(true)} className="btn-primary btn-sm flex items-center gap-1 mx-auto">
                        <Plus size={14} /> Create Bill
                      </button>
                    </div>
                  )}
                </div>
              )}

              {message && (
                <div className={`rounded-xl p-3 text-sm ${
                  message.includes("✓") ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" :
                  "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                }`}>
                  {message}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-3 border-t border-gray-200 dark:border-dark-700">
                <button onClick={() => setShowConfirmDeliver(true)} disabled={delivering || !bill}
                  className="btn-success flex items-center gap-2 px-6">
                  {delivering ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Mark Delivered{collectAmount > 0 ? ` & Collect ₹${collectAmount}` : ""}
                </button>
                <button onClick={() => navigate(`/customers/${selectedCustomer._id}`)}
                  className="btn-secondary flex items-center gap-2">View Profile</button>
              </div>
              {!bill && <p className="text-xs text-amber-500 text-center">Create a bill first to mark as delivered</p>}

              {showConfirmDeliver && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowConfirmDeliver(false)}>
                  <div className="bg-white dark:bg-dark-800 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Confirm Delivery</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      {collectAmount > 0 ? `Mark as delivered and collect ₹${collectAmount} via ${collectMode}?` : "Mark this order as Delivered?"}
                    </p>
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => setShowConfirmDeliver(false)} className="btn-secondary">Cancel</button>
                      <button onClick={handleDeliver} className="btn-success flex items-center gap-1.5">
                        <Check size={16} /> Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-[3px] border-primary-500 border-t-transparent rounded-full" />
        </div>
      )}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

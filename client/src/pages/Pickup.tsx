import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Search, Phone, Check, DollarSign, ChevronRight, MessageCircle, X } from "lucide-react";

export default function Pickup() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [bill, setBill] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectMode, setCollectMode] = useState("Cash");
  const [delivering, setDelivering] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("/api/settings").then((d) => { if (d.success) setSettings(d.data); });
  }, []);

  async function searchCustomer() {
    const num = phone.replace(/\D/g, "");
    if (num.length < 3) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/customers?phone=${encodeURIComponent(num)}`);
      if (res.success && res.data.length > 0) {
        setCustomers(res.data);
      } else {
        setCustomers([]);
        setMessage("No customer found with this number");
      }
    } finally {
      setIsLoading(false);
      setSelectedCustomer(null);
      setOrders([]);
      setSelectedOrder(null);
      setBill(null);
    }
  }

  async function selectCustomer(c: any) {
    setSelectedCustomer(c);
    setIsLoading(true);
    try {
      const [ordersRes] = await Promise.all([
        api.get(`/api/orders?customerId=${c._id}`),
      ]);
      if (ordersRes.success) {
        const pending = (ordersRes.data || []).filter(
          (o: any) => !["Delivered", "Cancelled"].includes(o.status)
        );
        setOrders(pending);
        if (pending.length === 0) {
          setMessage("No pending orders for this customer");
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function selectOrder(o: any) {
    setSelectedOrder(o);
    setMessage("");

    // Find latest bill for this customer
    const billsRes = await api.get("/api/bills");
    if (billsRes.success) {
      const customerBills = (billsRes.data || [])
        .filter((b: any) => b.customerId === o.customerId?._id || b.customerId === o.customerId)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const latest = customerBills[0] || null;
      setBill(latest);
      const pending = latest?.pendingAmount || 0;
      setCollectAmount(pending > 0 ? pending : 0);
    }
  }

  async function handleDeliver() {
    if (!selectedOrder) return;
    setDelivering(true);
    setMessage("");

    const payload: any = { status: "Delivered" };
    if (collectAmount > 0) {
      payload.collectPayment = collectAmount;
      payload.paymentMode = collectMode;
    }

    const res = await api.patch(`/api/orders/${selectedOrder._id}/status`, payload);
    if (res.success) {
      setMessage("✓ Order delivered successfully!");
      // Refresh
      selectCustomer(selectedCustomer);
      setSelectedOrder(null);
      setBill(null);
    } else {
      setMessage(res.message || "Failed to deliver order");
    }
    setDelivering(false);
  }

  function sendPickupWhatsApp(phoneNum: string) {
    const num = phoneNum.replace(/\D/g, "");
    if (!num) return;
    const adminNum = settings?.adminWhatsApp?.replace(/\D/g, "") || "91";
    const shop = settings?.shopName || "KMJ Optical";
    const msg = `*${shop}* 🕶%0a%0aHi ${selectedCustomer?.name || ""},%0aYour order has been delivered! 🎉%0a%0aThank you for choosing ${shop}.%0aSee you again! 🙏`;
    window.open(`https://wa.me/${adminNum}?text=${msg}`, "_blank");
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="page-title">Order Pickup</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Search customer, collect payment, and mark order as delivered.</p>
      </div>

      {/* Search */}
      <div className="card">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="tel" placeholder="Enter customer mobile number..."
              value={phone} onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") searchCustomer(); }}
              className="input-field pl-10 text-lg" />
          </div>
          <button onClick={searchCustomer} disabled={isLoading} className="btn-primary px-6">
            <Search size={18} />
          </button>
        </div>
      </div>

      {/* Customer results */}
      {customers.length > 0 && !selectedCustomer && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{customers.length} customer(s) found</p>
          {customers.map((c: any) => (
            <div key={c._id} onClick={() => selectCustomer(c)}
              className="card cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-all">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg">
                    {c.name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{c.mobile}</p>
                  </div>
                </div>
                <span className="text-indigo-600 text-sm font-medium">Select →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Selected Customer + Orders */}
      {selectedCustomer && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-lg">
                {selectedCustomer.name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{selectedCustomer.name}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedCustomer.mobile}</p>
              </div>
            </div>
            <button onClick={() => { setSelectedCustomer(null); setCustomers([]); setOrders([]); setSelectedOrder(null); setBill(null); }}
              className="btn-secondary text-sm px-3 py-1.5">Change</button>
          </div>

          {/* Pending Orders */}
          {orders.length > 0 && !selectedOrder && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{orders.length} pending order(s)</p>
              {orders.map((o: any) => (
                <div key={o._id} onClick={() => selectOrder(o)}
                  className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-indigo-300 cursor-pointer transition-all">
                  <div>
                    <p className="font-medium text-gray-900">
                      {o.frame && `Frame: ${o.frame}`}{o.frame && o.lens ? " | " : ""}{o.lens && `Lens: ${o.lens}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      Status: <span className="font-medium">{o.status}</span>
                      {o.deliveryDate && ` | Expected: ${new Date(o.deliveryDate).toLocaleDateString()}`}
                    </p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400" />
                </div>
              ))}
            </div>
          )}

          {/* Selected Order - Collect & Deliver */}
          {selectedOrder && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">Order Details</h3>
                <button onClick={() => { setSelectedOrder(null); setBill(null); }}
                  className="text-sm text-indigo-600 hover:text-indigo-800">Change</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedOrder.frame && <div><span className="text-gray-500 dark:text-gray-400">Frame:</span> <span className="font-medium">{selectedOrder.frame}</span></div>}
                {selectedOrder.lens && <div><span className="text-gray-500 dark:text-gray-400">Lens:</span> <span className="font-medium">{selectedOrder.lens}</span></div>}
                {selectedOrder.coating && <div><span className="text-gray-500 dark:text-gray-400">Coating:</span> <span className="font-medium">{selectedOrder.coating}</span></div>}
                {selectedOrder.quantity && <div><span className="text-gray-500 dark:text-gray-400">Qty:</span> <span className="font-medium">{selectedOrder.quantity}</span></div>}
                <div className="col-span-2">
                  <span className="text-gray-500 dark:text-gray-400">Status:</span>{" "}
                  <span className={`badge ${
                    selectedOrder.status === "Ready" ? "badge-blue" :
                    selectedOrder.status === "In Lab" ? "badge-yellow" : "badge-gray"
                  }`}>{selectedOrder.status}</span>
                </div>
              </div>

              {bill && (
                <>
                  <div className="border-t border-gray-200 pt-4">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Bill Summary</h3>
                    <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                      <div className="flex justify-between"><span>Bill #{bill.billNumber}</span></div>
                      <div className="flex justify-between"><span>Total</span><span className="font-bold">₹{bill.totalAmount?.toFixed(0) || "0"}</span></div>
                      <div className="flex justify-between text-emerald-600"><span>Advance Paid</span><span className="font-medium">₹{bill.advancePaid?.toFixed(0) || "0"}</span></div>
                      <div className="flex justify-between text-amber-600 font-medium border-t border-gray-200 pt-2"><span>Pending</span><span>₹{bill.pendingAmount?.toFixed(0) || "0"}</span></div>
                    </div>
                  </div>

                  {bill.pendingAmount > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Collect Payment</h3>
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Amount to Collect</label>
                          <input type="number" step="0.01" className="input-field text-lg font-bold" value={collectAmount}
                            onChange={(e) => setCollectAmount(Number(e.target.value))} max={bill.pendingAmount} />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mode</label>
                          <div className="grid grid-cols-2 gap-1">
                            {["Cash", "UPI", "Card"].map((m) => (
                              <button key={m} onClick={() => setCollectMode(m)}
                                className={`py-2 rounded-lg text-xs font-medium border transition-all ${
                                  collectMode === m ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-200"
                                }`}>{m}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {message && (
                <div className={`rounded-xl p-3 text-sm ${message.includes("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                  {message}
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2 border-t border-gray-200">
                <button onClick={handleDeliver} disabled={delivering}
                  className="btn-success flex items-center gap-2 px-6">
                  {delivering ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  : <Check size={16} />} Mark Delivered{collectAmount > 0 ? ` & Collect ₹${collectAmount}` : ""}
                </button>
                {selectedCustomer?.mobile && (
                  <button onClick={() => sendPickupWhatsApp(selectedCustomer.mobile)}
                    className="btn-secondary flex items-center gap-2">
                    <MessageCircle size={16} /> Notify Customer
                  </button>
                )}
                <button onClick={() => navigate(`/customers/${selectedCustomer._id}`)}
                  className="btn-secondary flex items-center gap-2">
                  View Profile
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
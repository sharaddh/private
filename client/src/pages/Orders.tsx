import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";
import Modal from "../components/Modal";
import { Plus, Edit2, Trash2, ChevronRight, DollarSign, Check } from "lucide-react";

const STATUS_FLOW = ["Draft", "Ordered", "In Lab", "Ready", "Delivered"] as const;
const STATUS_NEXT: Record<string, string> = {
  Draft: "Ordered",
  Ordered: "In Lab",
  "In Lab": "Ready",
  Ready: "Delivered",
};

const STATUS_COLORS: Record<string, string> = {
  Draft: "badge-gray",
  Ordered: "badge-purple",
  "In Lab": "badge-yellow",
  Ready: "badge-blue",
  Delivered: "badge-green",
  Cancelled: "badge-red",
};

export default function Orders() {
  const [list, setList] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    customerId: "", frame: "", lens: "", coating: "", accessories: "",
    quantity: 1, deliveryDate: "", status: "Draft",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);

  // Due collection modal
  const [collectModal, setCollectModal] = useState<{ order: any; pendingAmount: number } | null>(null);
  const [collectAmount, setCollectAmount] = useState(0);
  const [collectMode, setCollectMode] = useState("Cash");

  useEffect(() => { fetchOrders(); }, []);

  function fetchOrders() {
    api.get("/api/orders").then((d) => { if (d.success) setList(d.data || []); });
  }

  function openCreate() {
    setEditing(null);
    setForm({ customerId: "", frame: "", lens: "", coating: "", accessories: "", quantity: 1, deliveryDate: "", status: "Draft" });
    setShowForm(true);
  }

  function openEdit(o: any) {
    setEditing(o);
    setForm({
      customerId: o.customerId?._id || o.customerId || "",
      frame: o.frame || "",
      lens: o.lens || "",
      coating: o.coating || "",
      accessories: o.accessories?.join(", ") || "",
      quantity: o.quantity || 1,
      deliveryDate: o.deliveryDate ? new Date(o.deliveryDate).toISOString().split("T")[0] : "",
      status: o.status || "Draft",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        ...form,
        accessories: form.accessories.split(",").map((s) => s.trim()).filter(Boolean),
        deliveryDate: form.deliveryDate || undefined,
      };
      const res = editing
        ? await api.put(`/api/orders/${editing._id}`, payload)
        : await api.post("/api/orders", payload);
      if (res.success) { fetchOrders(); setShowForm(false); }
    } finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this order?")) return;
    const res = await api.del(`/api/orders/${id}`);
    if (res.success) setList((prev) => prev.filter((o) => o._id !== id));
  }

  function getNextStatus(current: string): string | null {
    return STATUS_NEXT[current] || null;
  }

  function canCancel(status: string): boolean {
    return !["Delivered", "Cancelled"].includes(status);
  }

  async function advanceStatus(order: any) {
    const next = getNextStatus(order.status);
    if (!next) return;

    const bill = order.billInfo;
    const pending = bill?.pendingAmount || 0;

    // If advancing to Delivered and there's pending amount, show collection modal
    if (next === "Delivered" && pending > 0) {
      setCollectModal({ order, pendingAmount: pending });
      setCollectAmount(pending);
      setCollectMode("Cash");
      return;
    }

    // Confirm before advancing
    if (!confirm(`Mark order as "${next}"?`)) return;
    await doStatusUpdate(order._id, next);
  }

  async function cancelOrder(order: any) {
    if (!confirm(`Cancel order for ${customerName(order)}?`)) return;
    await doStatusUpdate(order._id, "Cancelled");
  }

  async function doStatusUpdate(id: string, status: string, payment?: { amount: number; mode: string }) {
    setStatusLoading(id);
    try {
      const payload: any = { status };
      if (payment) {
        payload.collectPayment = payment.amount;
        payload.paymentMode = payment.mode;
      }
      const res = await api.patch(`/api/orders/${id}/status`, payload);
      if (res.success) {
        fetchOrders();
      } else {
        alert(res.message || "Status update failed");
      }
    } finally { setStatusLoading(null); }
  }

  async function handleCollectAndDeliver() {
    if (!collectModal || collectAmount <= 0) return;
    await doStatusUpdate(collectModal.order._id, "Delivered", {
      amount: collectAmount,
      mode: collectMode,
    });
    setCollectModal(null);
  }

  function customerName(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.name) return o.customerId.name;
    if (typeof o.customerId === "string") return o.customerId.slice(-6);
    return "—";
  }

  function customerMobile(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.mobile) return o.customerId.mobile;
    return "";
  }

  const stats = {
    total: list.length,
    pending: list.filter((o) => !["Delivered", "Cancelled"].includes(o.status)).length,
    ready: list.filter((o) => o.status === "Ready").length,
    delivered: list.filter((o) => o.status === "Delivered").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">Track order status from lab processing to delivery.</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> <span className="hidden sm:inline">New Order</span>
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center"><p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Total</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pending}</p><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">In Progress</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.ready}</p><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Ready</p></div>
        <div className="card text-center"><p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.delivered}</p><p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500">Delivered</p></div>
      </div>

      <Table
        columns={[
          {
            key: "customerId", label: "Customer",
            render: (v: any, row: any) => (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{customerName(row)}</p>
                {customerMobile(row) && <p className="text-xs text-gray-400 dark:text-gray-500">{customerMobile(row)}</p>}
              </div>
            ),
          },
          { key: "frame", label: "Frame" },
          { key: "lens", label: "Lens" },
          { key: "coating", label: "Coating" },
          { key: "quantity", label: "Qty" },
          {
            key: "deliveryDate", label: "Delivery",
            render: (v: string) => v ? new Date(v).toLocaleDateString() : "—",
          },
          {
            key: "billInfo", label: "Pending",
            render: (v: any) => v?.pendingAmount > 0
              ? <span className="text-amber-600 dark:text-amber-400 font-medium">₹{v.pendingAmount}</span>
              : v?.totalAmount ? <span className="text-emerald-600 dark:text-emerald-400 text-sm">Cleared</span> : "—",
          },
          {
            key: "status", label: "Status",
            render: (v: string, row: any) => {
              const next = getNextStatus(v);
              return (
                <div className="flex items-center gap-2">
                  <span className={`badge ${STATUS_COLORS[v] || "badge-gray"}`}>{v || "Draft"}</span>
                  {next && (
                    <button
                      onClick={() => advanceStatus(row)}
                      disabled={statusLoading === row._id}
                      className="p-1 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded text-indigo-500 dark:text-indigo-400 disabled:opacity-30"
                      title={`Mark as ${next}`}
                    >
                      {statusLoading === row._id
                        ? <div className="animate-spin w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        : <ChevronRight size={14} />}
                    </button>
                  )}
                  {canCancel(v) && (
                    <button onClick={() => cancelOrder(row)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-red-400" title="Cancel order">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            },
          },
        ]}
        data={list}
        searchPlaceholder="Search orders..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400"><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600"><Trash2 size={15} /></button>
          </div>
        )}
      />

      {showForm && (
        <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Order" : "Create New Order"} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Customer ID *</label>
                <input className="input-field" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Frame</label>
                <input className="input-field" placeholder="Frame model" value={form.frame} onChange={(e) => setForm({ ...form, frame: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Lens</label>
                <input className="input-field" placeholder="Lens type" value={form.lens} onChange={(e) => setForm({ ...form, lens: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Coating</label>
                <input className="input-field" placeholder="Coating type" value={form.coating} onChange={(e) => setForm({ ...form, coating: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quantity</label>
                <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} min="1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Delivery Date</label>
                <input type="date" className="input-field" value={form.deliveryDate} onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {["Draft", "Ordered", "In Lab", "Ready", "Delivered", "Cancelled"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Accessories</label>
                <input className="input-field" placeholder="comma, separated" value={form.accessories} onChange={(e) => setForm({ ...form, accessories: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Create Order"}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Due collection modal on delivery */}
      <Modal open={!!collectModal} onClose={() => setCollectModal(null)} title="Collect Due on Delivery" size="md">
        {collectModal && (
          <div className="space-y-5">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
              <p className="text-sm text-amber-700 dark:text-amber-300 mb-1">Pending Amount</p>
              <p className="text-3xl font-bold text-amber-700 dark:text-amber-300">₹{collectModal.pendingAmount}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Collect Amount</label>
              <input type="number" step="0.01" className="input-field text-lg font-bold" value={collectAmount}
                onChange={(e) => setCollectAmount(Number(e.target.value))} max={collectModal.pendingAmount} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Payment Mode</label>
              <div className="grid grid-cols-2 gap-2">
                {["Cash", "UPI", "Card", "Bank Transfer"].map((mode) => (
                  <button key={mode} onClick={() => setCollectMode(mode)}
                    className={`py-2.5 px-4 rounded-xl text-sm font-medium border transition-all ${
                      collectMode === mode ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 dark:text-gray-400 border-gray-200 dark:border-dark-700 hover:border-gray-300"
                    }`}>{mode}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
              <button onClick={() => setCollectModal(null)} className="btn-secondary">Skip</button>
              <button onClick={handleCollectAndDeliver} disabled={collectAmount <= 0}
                className="btn-success flex items-center gap-2">
                <DollarSign size={16} /> Collect ₹{collectAmount} & Deliver
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
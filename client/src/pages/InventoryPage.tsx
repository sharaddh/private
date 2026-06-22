import React, { useEffect, useState } from "react";
import api from "../api";
import { useCachedData } from "../hooks/useCachedData";
import Table from "../components/Table";
import Modal from "../components/Modal";
import PageSkeleton from "../components/PageSkeleton";
import { Plus, Edit2, Trash2, Package } from "lucide-react";

export default function InventoryPage() {
  const [showForm, setShowForm] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    sku: "", category: "Frame", brand: "", model: "", color: "", size: "",
    quantity: 0, purchasePrice: 0, sellingPrice: 0,
  });
  const [adjust, setAdjust] = useState({ id: "", qty: 0, note: "" });
  const [isLoading, setIsLoading] = useState(false);
  const { data: rawList, loading, refetch } = useCachedData<any[]>("/api/inventory", () => api.get("/api/inventory"));
  const [list, setList] = useState<any[]>(() => rawList || []);

  useEffect(() => {
    if (rawList) setList(rawList);
  }, [rawList]);

  function fetchInventory() {
    refetch(true);
  }

  function openCreate() {
    setEditing(null);
    setForm({ sku: "", category: "Frame", brand: "", model: "", color: "", size: "", quantity: 0, purchasePrice: 0, sellingPrice: 0 });
    setShowForm(true);
  }

  function openEdit(item: any) {
    setEditing(item);
    setForm({
      sku: item.sku || "", category: item.category || "Frame", brand: item.brand || "",
      model: item.model || "", color: item.color || "", size: item.size || "",
      quantity: item.quantity || 0, purchasePrice: item.purchasePrice || 0, sellingPrice: item.sellingPrice || 0,
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = editing
        ? await api.put(`/api/inventory/${editing._id}`, form)
        : await api.post("/api/inventory", form);
      if (res.success) { fetchInventory(); setShowForm(false); }
    } finally { setIsLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await api.del(`/api/inventory/${id}`);
    if (res.success) setList((prev) => prev.filter((i) => i._id !== id));
  }

  async function handleAdjustStock(e: React.FormEvent) {
    e.preventDefault();
    if (!adjust.id) return;
    setIsLoading(true);
    try {
      const res = await api.put(`/api/inventory/${adjust.id}/stock`, { quantity: adjust.qty });
      if (res.success) { fetchInventory(); setShowAdjust(false); setAdjust({ id: "", qty: 0, note: "" }); }
    } finally { setIsLoading(false); }
  }

  if (loading) return <PageSkeleton page="inventory" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage frames, lenses, and accessories stock.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdjust(true)} className="btn-secondary flex items-center gap-2">
            <Package size={18} /> Adjust Stock
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> <span className="hidden sm:inline">Add Item</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{list.filter((i) => i.category === "Frame" || !i.category).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Frames</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{list.filter((i) => i.category === "Lens").length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Lenses</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{list.filter((i) => i.category === "Accessories").length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Accessories</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{list.filter((i) => (i.quantity || 0) <= 5).length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Low Stock</p>
        </div>
      </div>

      <Table
        columns={[
          { key: "sku", label: "SKU" },
          { key: "category", label: "Category", render: (v) => (
            <span className={`badge ${
              v === "Lens" ? "badge-blue" :
              v === "Accessories" ? "badge-purple" :
              "badge-gray"
            }`}>{v || "Frame"}</span>
          )},
          { key: "brand", label: "Brand" },
          { key: "model", label: "Model" },
          { key: "color", label: "Color" },
          { key: "quantity", label: "Stock", render: (v) => (
            <span className={`font-medium ${v > 10 ? "text-emerald-600 dark:text-emerald-400" : v > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {v || 0}
            </span>
          )},
          { key: "sellingPrice", label: "Price", render: (v) => `₹${(v || 0).toFixed(2)}` },
        ]}
        data={list}
        searchPlaceholder="Search by SKU, brand, model..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg text-primary-600 dark:text-primary-400"><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-600 dark:text-red-400"><Trash2 size={15} /></button>
          </div>
        )}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Item" : "Add Inventory Item"} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">SKU *</label>
              <input className="input-field" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="Frame">Frame</option>
                <option value="Lens">Lens</option>
                <option value="Accessories">Accessories</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Brand</label>
              <input className="input-field" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Model</label>
              <input className="input-field" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Color</label>
              <input className="input-field" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Size</label>
              <input className="input-field" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quantity</label>
              <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Purchase Price</label>
              <input type="number" step="0.01" className="input-field" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Selling Price</label>
              <input type="number" step="0.01" className="input-field" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Add Item"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title="Adjust Stock">
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Select Item</label>
            <select className="input-field" value={adjust.id} onChange={(e) => setAdjust({ ...adjust, id: e.target.value })}>
              <option value="">Choose item</option>
              {list.map((it) => (
                <option key={it._id} value={it._id}>{it.sku} - {it.brand} ({it.quantity || 0} in stock)</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quantity Change (+/-)</label>
            <input type="number" className="input-field" value={adjust.qty} onChange={(e) => setAdjust({ ...adjust, qty: Number(e.target.value) })} placeholder="+5 or -3" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button type="button" onClick={() => setShowAdjust(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-success">{isLoading ? "Saving..." : "Apply Adjustment"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

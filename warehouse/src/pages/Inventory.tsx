import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { Search, Package, Plus, Edit3, Trash2, X } from "lucide-react";

interface InventoryItem {
  _id: string;
  sku: string;
  category: string;
  inventoryType: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  gender: string;
  supplier: string;
  quantity: number;
  location: string;
  purchasePrice: number;
  sellingPrice: number;
  description: string;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  sku: "", category: "Lens", inventoryType: "lens",
  brand: "", model: "", color: "", size: "", gender: "",
  supplier: "", quantity: 0, location: "warehouse" as "warehouse" | "shop",
  purchasePrice: 0, sellingPrice: 0, description: "",
};

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filtered, setFiltered] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("Lens");
  const [locationFilter, setLocationFilter] = useState("warehouse");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [withdrawItem, setWithdrawItem] = useState<InventoryItem | null>(null);
  const [withdrawQty, setWithdrawQty] = useState(0);
  const [withdrawing, setWithdrawing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [searchParams] = useSearchParams();

  useEffect(() => {
    const loc = searchParams.get("location");
    if (loc) setLocationFilter(loc);
  }, [searchParams]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await api.get<InventoryItem[]>("/api/inventory");
    if (res.success && Array.isArray(res.data)) {
      setItems(res.data);
      setFiltered(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) =>
        i.sku?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) ||
        i.model?.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== "all") result = result.filter((i) => i.category === categoryFilter);
    if (locationFilter !== "all") result = result.filter((i) => i.location === locationFilter);
    setFiltered(result);
  }, [search, categoryFilter, locationFilter, items]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  }

  function openEdit(item: InventoryItem) {
    setEditing(item);
    setForm({
      sku: item.sku || "",
      category: item.category || "Lens",
      inventoryType: item.inventoryType || "lens",
      brand: item.brand || "",
      model: item.model || "",
      color: item.color || "",
      size: item.size || "",
      gender: item.gender || "",
      supplier: item.supplier || "",
      quantity: item.quantity || 0,
      location: (item.location as "shop" | "warehouse") || "warehouse",
      purchasePrice: item.purchasePrice || 0,
      sellingPrice: item.sellingPrice || 0,
      description: item.description || "",
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sku.trim()) { setFormError("SKU is required"); return; }
    setSaving(true); setFormError("");
    try {
      if (editing) {
        const res = await api.put("/api/inventory/" + editing._id, form);
        if (res.success) { setShowForm(false); fetchItems(); }
        else { setFormError(res.message || "Failed to update"); }
      } else {
        const res = await api.post("/api/inventory", form);
        if (res.success) { setShowForm(false); fetchItems(); }
        else { setFormError(res.message || "Failed to create"); }
      }
    } catch { setFormError("An error occurred"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this item permanently?")) return;
    setDeleting(id);
    const res = await api.del("/api/inventory/" + id);
    if (res.success) fetchItems();
    setDeleting(null);
  }

  function openWithdraw(item: InventoryItem) {
    setWithdrawItem(item);
    setWithdrawQty(0);
  }

  async function handleWithdraw() {
    if (!withdrawItem || withdrawQty <= 0) return;
    setWithdrawing(true);
    const res = await api.put("/api/inventory/" + withdrawItem._id + "/stock", { quantity: -withdrawQty });
    if (res.success) { setWithdrawItem(null); fetchItems(); }
    setWithdrawing(false);
  }

  const categories = ["Lens"];
  const locations = ["warehouse", "shop"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Lens Warehouse</h1>
          <p className="text-sm text-gray-500 mt-1">Manage warehouse lens stock — {filtered.length} items</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Lens
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by SKU, brand, model..." value={search}
            onChange={(e) => setSearch(e.target.value)} className="input-field pl-9" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="input-field w-auto">
          <option value="all">All Locations</option>
          {locations.map((l) => <option key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Package size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 text-sm">No lens items found in warehouse</p>
          <button onClick={openAdd} className="btn-primary mt-4">Add First Lens</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">SKU</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Brand / Model</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Category</th>
                  <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Location</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Qty</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Price</th>
                  <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {item.brand && <span className="font-medium">{item.brand}</span>}
                      {item.brand && item.model && " "}
                      {item.model}
                      {!item.brand && !item.model && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{item.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={"text-xs font-medium px-2.5 py-1 rounded-full " + (item.location === "warehouse" ? "bg-purple-50 text-purple-700" : "bg-cyan-50 text-cyan-700")}>
                        {item.location}
                      </span>
                    </td>
                    <td className={"px-4 py-3 text-sm text-right font-bold " + ((item.quantity || 0) <= 5 ? "text-red-600" : "text-gray-900")}>
                      {item.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">₹{item.sellingPrice || 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(item)}
                          className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"
                          title="Edit">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => openWithdraw(item)}
                          className="p-1.5 hover:bg-amber-50 rounded-lg text-gray-400 hover:text-amber-600 transition-colors"
                          title="Withdraw">
                          <Package size={15} />
                        </button>
                        <button onClick={() => handleDelete(item._id)} disabled={deleting === item._id}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors disabled:opacity-40"
                          title="Delete">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editing ? "Edit Lens" : "Add Lens"}</h3>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">{formError}</div>}
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">SKU *</label>
                <input className="input-field" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} placeholder="e.g. LENS-001" required /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Brand</label>
                  <input className="input-field" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Model</label>
                  <input className="input-field" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                  <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    <option value="Lens">Lens</option>
                  </select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Type</label>
                  <select className="input-field" value={form.inventoryType} onChange={(e) => setForm({ ...form, inventoryType: e.target.value })}>
                    <option value="lens">Lens</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Color</label>
                  <input className="input-field" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Size</label>
                  <input className="input-field" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Gender</label>
                  <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                    <option value="">Any</option><option value="Male">Male</option><option value="Female">Female</option><option value="Unisex">Unisex</option>
                  </select></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier</label>
                <input className="input-field" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity</label>
                  <input className="input-field" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} min="0" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                  <select className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value as "shop" | "warehouse" })}>
                    <option value="warehouse">Warehouse</option><option value="shop">Shop</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Purchase Price</label>
                  <input className="input-field" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} min="0" /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Selling Price</label>
                  <input className="input-field" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} min="0" /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? "Saving..." : editing ? "Update Lens" : "Create Lens"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {withdrawItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setWithdrawItem(null)}>
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm" />
          <div onClick={(e) => e.stopPropagation()} className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Withdraw Stock</h3>
              <button onClick={() => setWithdrawItem(null)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
                <X size={18} />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              <strong>{withdrawItem.brand} {withdrawItem.model}</strong> — {withdrawItem.sku}<br />
              Current stock: <strong className="text-gray-900">{withdrawItem.quantity}</strong>
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Quantity to withdraw</label>
                <input className="input-field" type="number" value={withdrawQty}
                  onChange={(e) => setWithdrawQty(Math.min(Math.max(0, Number(e.target.value)), withdrawItem.quantity))}
                  min="1" max={withdrawItem.quantity} autoFocus />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setWithdrawItem(null)} className="btn-secondary flex-1">Cancel</button>
                <button onClick={handleWithdraw} disabled={withdrawing || withdrawQty <= 0 || withdrawQty > (withdrawItem.quantity || 0)}
                  className="btn-danger flex-1 flex items-center justify-center gap-2">
                  {withdrawing ? "Processing..." : "Withdraw"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

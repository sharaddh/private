import React, { useEffect, useState } from "react";
import api from "../api";
import { useCachedData } from "../hooks/useCachedData";
import Table from "../components/Table";
import Modal from "../components/Modal";
import PageSkeleton from "../components/PageSkeleton";
import QRCode from "qrcode";
import { Plus, Edit2, Trash2, Package, Printer, QrCode, Search } from "lucide-react";

export default function InventoryPage() {
  const [showForm, setShowForm] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    sku: "", category: "Frame", inventoryType: "spectacles", brand: "", model: "", color: "", size: "",
    gender: "", supplier: "", quantity: 0, purchasePrice: 0, sellingPrice: 0, description: "",
  });
  const [adjust, setAdjust] = useState({ id: "", qty: 0, note: "" });
  const [isLoading, setIsLoading] = useState(false);
  const { data: rawList, loading, refetch } = useCachedData<any[]>("/api/inventory", () => api.get("/api/inventory"));
  const [list, setList] = useState<any[]>(() => rawList || []);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [scanModal, setScanModal] = useState(false);
  const [scanInput, setScanInput] = useState("");
  const [scannedItem, setScannedItem] = useState<any>(null);
  const [scanError, setScanError] = useState("");
  const [scanLoading, setScanLoading] = useState(false);

  useEffect(() => {
    if (rawList) setList(rawList);
  }, [rawList]);

  function fetchInventory() {
    refetch(true);
  }

  function openCreate() {
    setEditing(null);
    setForm({ sku: "", category: "Frame", inventoryType: "spectacles", brand: "", model: "", color: "", size: "", gender: "", supplier: "", quantity: 0, purchasePrice: 0, sellingPrice: 0, description: "" });
    setShowForm(true);
  }

  function openEdit(item: any) {
    setEditing(item);
    setForm({
      sku: item.sku || "", category: item.category || "Frame", inventoryType: item.inventoryType || "spectacles",
      brand: item.brand || "", model: item.model || "", color: item.color || "", size: item.size || "",
      gender: item.gender || "", supplier: item.supplier || "",
      quantity: item.quantity || 0, purchasePrice: item.purchasePrice || 0, sellingPrice: item.sellingPrice || 0,
      description: item.description || "",
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

  async function handlePrintLabel(item: any) {
    const qrUrl = await QRCode.toDataURL(item.sku, { width: 300, margin: 1 });
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const category = item.category || "Frame";
    const gender = item.gender ? ` / ${item.gender}` : "";
    const type = item.inventoryType ? `${item.inventoryType}${gender}` : category;
    printWindow.document.write(`
      <html><head><title>Print Label - ${item.sku}</title>
      <style>
        @page { size: 100mm 50mm; margin: 0; }
        body { margin: 0; padding: 4mm; width: 100mm; height: 50mm; box-sizing: border-box;
               font-family: Arial, sans-serif; display: flex; align-items: center; }
        .label { display: flex; align-items: center; gap: 4mm; width: 100%; }
        .qr img { width: 40mm; height: 40mm; }
        .info { flex: 1; font-size: 8pt; line-height: 1.3; }
        .info .sku { font-size: 10pt; font-weight: bold; }
        .info .brand { font-size: 9pt; }
        .info .detail { color: #555; }
      </style></head><body>
      <div class="label">
        <div class="qr"><img src="${qrUrl}" /></div>
        <div class="info">
          <div class="sku">${item.sku}</div>
          <div class="brand">${item.brand || ""} ${item.model || ""}</div>
          <div class="detail">${type}${item.color ? " / " + item.color : ""}</div>
          <div class="detail">${item.supplier ? item.supplier : ""} ${item.purchasePrice ? "₹" + item.purchasePrice : ""}</div>
          <div class="detail">₹${item.sellingPrice || 0}</div>
        </div>
      </div>
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  }

  async function handleScanLookup() {
    if (!scanInput.trim()) return;
    setScanError("");
    setScannedItem(null);
    setScanLoading(true);
    try {
      const res = await api.get(`/api/inventory/qr/${encodeURIComponent(scanInput.trim())}`);
      if (res.success) {
        setScannedItem(res.data);
      } else {
        setScanError(res.message || "Item not found");
      }
    } catch {
      setScanError("Network error. Please try again.");
    } finally {
      setScanLoading(false);
    }
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
          <button onClick={() => { setScanModal(true); setScanInput(""); setScannedItem(null); setScanError(""); setScanLoading(false); }} className="btn-secondary flex items-center gap-2">
            <QrCode size={18} /> Scan QR
          </button>
          <button onClick={() => setShowAdjust(true)} className="btn-secondary flex items-center gap-2">
            <Package size={18} /> Adjust Stock
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> <span className="hidden sm:inline">Add Item</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{list.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Items</p>
        </div>
      </div>

      function categoryLabel(cat: string) {
        if (cat === "Lens") return "badge-blue";
        if (cat === "Accessories") return "badge-purple";
        return "badge-gray";
      }

      const filteredList = categoryFilter === "All" ? list : list.filter((i) => (i.category || "Frame") === categoryFilter);
      const categories = ["All", "Frame", "Lens", "Accessories"];

      <div className="flex gap-1.5 mb-3 flex-wrap">
        {categories.map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              categoryFilter === c
                ? "bg-primary-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-dark-600"
            }`}>
            {c}
          </button>
        ))}
      </div>

      <Table
        columns={[
          { key: "sku", label: "SKU" },
          { key: "category", label: "Category", render: (v, row: any) => (
            <span className="flex flex-col gap-0.5">
              <span className={`badge ${categoryLabel(v)}`}>{v || "Frame"}</span>
              {row.inventoryType && <span className="text-[10px] text-gray-400 capitalize">{row.inventoryType}</span>}
            </span>
          )},
          { key: "brand", label: "Brand" },
          { key: "model", label: "Model" },
          { key: "color", label: "Color" },
          { key: "gender", label: "Gender", render: (v) => v ? <span className="text-xs">{v}</span> : null },
          { key: "quantity", label: "Stock", render: (v) => (
            <span className={`font-medium ${v > 10 ? "text-emerald-600 dark:text-emerald-400" : v > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {v || 0}
            </span>
          )},
          { key: "sellingPrice", label: "Price", render: (v) => `₹${(v || 0).toFixed(2)}` },
        ]}
        data={filteredList}
        searchPlaceholder="Search by SKU, brand, model, supplier..."
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => handlePrintLabel(row)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg text-gray-500 dark:text-gray-400" title="Print Label">
              <Printer size={15} />
            </button>
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
                <option value="Frame">Frame / Spectacles / Sunglasses</option>
                <option value="Lens">Lens</option>
                <option value="Accessories">Accessories</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
              <select className="input-field" value={form.inventoryType} onChange={(e) => setForm({ ...form, inventoryType: e.target.value })}>
                {(form.category === "Frame" ? [
                  { value: "spectacles", label: "Spectacles" },
                  { value: "sunglasses", label: "Sunglasses" },
                ] : form.category === "Lens" ? [
                  { value: "lens", label: "Lens" },
                ] : [
                  { value: "accessory", label: "Accessory" },
                  { value: "hearing-aid", label: "Hearing Aid" },
                  { value: "cleaner", label: "Cleaner / Spray" },
                  { value: "case", label: "Case" },
                  { value: "other", label: "Other" },
                ]).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Gender</label>
              <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">All / Unisex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Supplier (Purchased From)</label>
              <input className="input-field" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Quantity</label>
              <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Purchase Price (₹)</label>
              <input type="number" step="0.01" className="input-field" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Selling Price (₹)</label>
              <input type="number" step="0.01" className="input-field" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
              <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Additional notes..." />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-dark-700">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? "Saving..." : editing ? "Update" : "Add Item"}</button>
          </div>
        </form>
      </Modal>

      <Modal open={scanModal} onClose={() => setScanModal(false)} title="Scan QR Code" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Enter or scan the QR code (SKU) to look up an item.</p>
          <div className="flex gap-2">
            <input className="input-field flex-1" placeholder="Scan or enter SKU..." value={scanInput}
              onChange={(e) => setScanInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleScanLookup(); }} autoFocus />
            <button onClick={handleScanLookup} disabled={scanLoading} className="btn-primary flex items-center gap-1.5">
              {scanLoading ? <span className="animate-spin">⟳</span> : <Search size={16} />} Search
            </button>
          </div>
          {scanError && <p className="text-sm text-red-500">{scanError}</p>}
          {scannedItem && (
            <div className="bg-gray-50 dark:bg-dark-750 rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900 dark:text-white">{scannedItem.brand} {scannedItem.model}</h4>
                <button onClick={() => handlePrintLabel(scannedItem)} className="btn-ghost btn-sm flex items-center gap-1">
                  <Printer size={14} /> Print
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-gray-500">SKU:</span><span className="font-mono font-medium">{scannedItem.sku}</span>
                <span className="text-gray-500">Category:</span><span className="capitalize">{scannedItem.category}</span>
                {scannedItem.inventoryType && <><span className="text-gray-500">Type:</span><span className="capitalize">{scannedItem.inventoryType}</span></>}
                {scannedItem.color && <><span className="text-gray-500">Color:</span><span>{scannedItem.color}</span></>}
                {scannedItem.gender && <><span className="text-gray-500">Gender:</span><span>{scannedItem.gender}</span></>}
                {scannedItem.supplier && <><span className="text-gray-500">Supplier:</span><span>{scannedItem.supplier}</span></>}
                <span className="text-gray-500">Stock:</span><span className="font-medium">{scannedItem.quantity || 0}</span>
                <span className="text-gray-500">Price:</span><span className="font-medium">₹{scannedItem.sellingPrice || 0}</span>
              </div>
            </div>
          )}
        </div>
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

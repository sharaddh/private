import React, { useEffect, useState } from "react";
import api from "../api";
import { useCachedData } from "../hooks/useCachedData";
import Table from "../components/Table";
import Modal from "../components/Modal";
import PageSkeleton from "../components/PageSkeleton";
import CameraScanner from "../components/CameraScanner";
import QRCode from "qrcode";
import { Plus, Edit2, Trash2, Package, Printer, QrCode, Search, Camera } from "lucide-react";
import { useTranslate } from "../context/TranslateContext";

export default function InventoryPage() {
  const { uiT } = useTranslate();
  const [showForm, setShowForm] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    sku: "", category: "Frame", inventoryType: "spectacles", brand: "", model: "", color: "", size: "",
    gender: "", supplier: "", quantity: 0, purchasePrice: 0, sellingPrice: 0, description: "", location: "shop",
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
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  useEffect(() => {
    if (rawList) setList(rawList);
  }, [rawList]);

  function fetchInventory() {
    refetch(true);
  }

  function openCreate() {
    setEditing(null);
    setForm({ sku: "", category: "Frame", inventoryType: "spectacles", brand: "", model: "", color: "", size: "", gender: "", supplier: "", quantity: 0, purchasePrice: 0, sellingPrice: 0, description: "", location: "shop" });
    setShowForm(true);
  }

  function openEdit(item: any) {
    setEditing(item);
    setForm({
      sku: item.sku || "", category: item.category || "Frame", inventoryType: item.inventoryType || "spectacles",
      brand: item.brand || "", model: item.model || "", color: item.color || "", size: item.size || "",
      gender: item.gender || "", supplier: item.supplier || "",
      quantity: item.quantity || 0, purchasePrice: item.purchasePrice || 0, sellingPrice: item.sellingPrice || 0,
      description: item.description || "", location: item.location || "shop",
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
          <div class="detail" style="font-size:6pt;color:#999">${new Date().toLocaleDateString("en-IN")}</div>
        </div>
      </div>
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  }

  async function handleScanLookup(code?: string) {
    const sku = (code || scanInput).trim();
    if (!sku) return;
    setScanError("");
    setScannedItem(null);
    setScanLoading(true);
    try {
      const res = await api.get(`/api/inventory/qr/${encodeURIComponent(sku)}`);
      if (res.success) {
        setScannedItem(res.data);
      } else {
        setScanError(res.message || uiT("Item not found", "आइटम नहीं मिला"));
      }
    } catch {
      setScanError(uiT("Network error. Please try again.", "नेटवर्क त्रुटि। कृपया पुनः प्रयास करें।"));
    } finally {
      setScanLoading(false);
    }
  }

  if (loading) return <PageSkeleton page="inventory" />;

  const categoryLabel = (cat: string) => {
    if (cat === "Lens") return "badge-blue";
    if (cat === "Accessories") return "badge-purple";
    return "badge-gray";
  };

  const filteredList = categoryFilter === "All" ? list : list.filter((i) => (i.category || "Frame") === categoryFilter);
  const filteredCount = filteredList.length;
  const totalCount = list.length;
  const categories = ["All", "Frame", "Lens", "Accessories"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{uiT("Inventory", "इन्वेंट्री")}</h1>
          <p className="text-sm text-muted-500 mt-1">{uiT("Manage frames, lenses, and accessories stock.", "फ्रेम, लेंस और सहायक उपकरण का स्टॉक प्रबंधित करें।")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setScanModal(true); setScanInput(""); setScannedItem(null); setScanError(""); setScanLoading(false); }} className="btn-secondary flex items-center gap-2">
            <QrCode size={18} /> {uiT("Scan QR Code", "QR कोड स्कैन करें")}
          </button>
          <button onClick={() => setShowAdjust(true)} className="btn-secondary flex items-center gap-2">
            <Package size={18} /> {uiT("Adjust Stock", "स्टॉक समायोजित करें")}
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} /> <span className="hidden sm:inline">{uiT("Add Item", "आइटम जोड़ें")}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-muted-900 dark:text-white">{list.filter((i) => i.category === "Frame" || !i.category).length}</p>
          <p className="text-sm text-muted-500">{uiT("Frames", "फ्रेम")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-muted-900 dark:text-white">{list.filter((i) => i.category === "Lens").length}</p>
          <p className="text-sm text-muted-500">{uiT("Lenses", "लेंस")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-muted-900 dark:text-white">{list.filter((i) => i.category === "Accessories").length}</p>
          <p className="text-sm text-muted-500">{uiT("Accessories", "सहायक उपकरण")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-red-600">{list.filter((i) => (i.quantity || 0) <= 5).length}</p>
          <p className="text-sm text-muted-500">{uiT("Low Stock", "कम स्टॉक")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-muted-900 dark:text-white">{list.length}</p>
          <p className="text-sm text-muted-500">{uiT("Total Items", "कुल आइटम")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-400">{filteredCount} {uiT("of", "में से")} {totalCount}</span>
        {categories.map((c) => (
          <button key={c} onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
              categoryFilter === c
                ? "bg-primary-600 text-white shadow-soft"
                : "bg-white dark:bg-slate-800 text-muted-600 dark:text-muted-400 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-300 dark:border-slate-600"
            }`}>
            {uiT(c, c === "All" ? "सभी" : c === "Frame" ? "फ्रेम" : c === "Lens" ? "लेंस" : "सहायक उपकरण")}
          </button>
        ))}
      </div>

      {filteredList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-400">
          <Package size={48} className="mb-3 opacity-30" />
          <p className="text-sm">{uiT("No items found", "कोई आइटम नहीं मिला")}</p>
        </div>
      )}

      <Table
        columns={[
          { key: "sku", label: uiT("SKU", "SKU") },
          { key: "category", label: uiT("Category", "श्रेणी"), render: (v, row: any) => (
            <span className="flex flex-col gap-0.5">
              <span className={`badge ${categoryLabel(v)}`}>{v || "Frame"}</span>
              {row.inventoryType && <span className="text-[10px] text-muted-400 capitalize">{row.inventoryType}</span>}
            </span>
          )},
          { key: "brand", label: uiT("Brand", "ब्रांड") },
          { key: "model", label: uiT("Model", "मॉडल") },
          { key: "color", label: uiT("Color", "रंग") },
          { key: "gender", label: uiT("Gender", "लिंग"), render: (v) => v ? <span className="text-xs">{v}</span> : null },
          { key: "location", label: uiT("Location", "स्थान"), render: (v) => (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${v === "warehouse" ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300" : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300"}`}>
              {v === "warehouse" ? uiT("Warehouse", "गोदाम") : uiT("Shop", "दुकान")}
            </span>
          )},
          { key: "quantity", label: uiT("Stock", "स्टॉक"), render: (v) => (
            <span className={`font-medium ${v > 10 ? "text-emerald-600 dark:text-emerald-400" : v > 0 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
              {v || 0}
            </span>
          )},
          { key: "sellingPrice", label: uiT("Price", "मूल्य"), render: (v) => `₹${(v || 0).toFixed(2)}` },
        ]}
        data={filteredList}
        searchPlaceholder={uiT("Search", "खोजें") + "..."}
        actions={(row) => (
          <div className="flex items-center gap-1">
            <button onClick={() => handlePrintLabel(row)} className="p-1.5 hover:bg-surface-100/60 dark:hover:bg-slate-700/60 rounded-lg text-muted-400" title={uiT("Print Label", "लेबल प्रिंट करें")}>
              <Printer size={15} />
            </button>
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 rounded-lg text-primary-600"><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-red-50/60 dark:hover:bg-red-900/20 rounded-lg text-red-600"><Trash2 size={15} /></button>
          </div>
        )}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? uiT("Edit", "संपादित करें") + " " + uiT("Add Item", "आइटम जोड़ें") : uiT("Add Item", "आइटम जोड़ें")} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("SKU", "SKU")} *</label>
              <input className="input-field" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} required placeholder="e.g. FRM-001" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Category", "श्रेणी")}</label>
              <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="Frame">{uiT("Frame / Spectacles / Sunglasses", "फ्रेम / चश्मा / सनग्लास")}</option>
                <option value="Lens">{uiT("Lens", "लेंस")}</option>
                <option value="Accessories">{uiT("Accessories", "सहायक उपकरण")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Type", "प्रकार")}</label>
              <select className="input-field" value={form.inventoryType} onChange={(e) => setForm({ ...form, inventoryType: e.target.value })}>
                {(form.category === "Frame" ? [
                  { value: "spectacles", label: uiT("Spectacles", "चश्मा") },
                  { value: "sunglasses", label: uiT("Sunglasses", "सनग्लास") },
                ] : form.category === "Lens" ? [
                  { value: "lens", label: uiT("Lens", "लेंस") },
                ] : [
                  { value: "accessory", label: uiT("Accessory", "सहायक") },
                  { value: "hearing-aid", label: uiT("Hearing Aid", "श्रवण यंत्र") },
                  { value: "cleaner", label: uiT("Cleaner / Spray", "क्लीनर / स्प्रे") },
                  { value: "case", label: uiT("Case", "केस") },
                  { value: "other", label: uiT("Other", "अन्य") },
                ]).map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Brand", "ब्रांड")}</label>
              <input className="input-field" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Model", "मॉडल")}</label>
              <input className="input-field" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Color", "रंग")}</label>
              <input className="input-field" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Size", "आकार")}</label>
              <input className="input-field" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Gender", "लिंग")}</label>
              <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">{uiT("All / Unisex", "सभी / यूनिसेक्स")}</option>
                <option value="Male">{uiT("Male", "पुरुष")}</option>
                <option value="Female">{uiT("Female", "महिला")}</option>
                <option value="Unisex">{uiT("Unisex", "यूनिसेक्स")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Supplier", "आपूर्तिकर्ता")}</label>
              <input className="input-field" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder={uiT("Supplier name", "आपूर्तिकर्ता का नाम")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Location", "स्थान")}</label>
              <select className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value as "shop" | "warehouse" })}>
                <option value="shop">{uiT("Shop", "दुकान")}</option>
                <option value="warehouse">{uiT("Warehouse", "गोदाम")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Quantity", "मात्रा")}</label>
              <input type="number" className="input-field" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Purchase Price (₹)", "खरीद मूल्य (₹)")}</label>
              <input type="number" step="0.01" className="input-field" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Selling Price (₹)", "बिक्री मूल्य (₹)")}</label>
              <input type="number" step="0.01" className="input-field" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Description", "विवरण")}</label>
              <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={uiT("Additional notes...", "अतिरिक्त नोट्स...")} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200/50 dark:border-slate-600/30">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">{uiT("Cancel", "रद्द करें")}</button>
            <button type="submit" disabled={isLoading} className="btn-primary">{isLoading ? uiT("Saving...", "सहेज रहे हैं...") : editing ? uiT("Save", "सहेजें") : uiT("Add Item", "आइटम जोड़ें")}</button>
          </div>
        </form>
      </Modal>

      <Modal open={scanModal} onClose={() => setScanModal(false)} title={uiT("Scan QR Code", "QR कोड स्कैन करें")} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted-500">{uiT("Point your scanner at the QR code or type the SKU below.", "अपना स्कैनर QR कोड पर रखें या नीचे SKU टाइप करें।")}</p>
          <div className="flex gap-2">
            <input className="input-field flex-1 text-lg tracking-wider font-mono" placeholder={uiT("Scan or type SKU...", "स्कैन करें या SKU टाइप करें...")} value={scanInput}
              onChange={(e) => setScanInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScanLookup(); } }} autoFocus />
            <button onClick={() => { setScanModal(false); setShowCameraScanner(true); }} className="btn-secondary flex items-center gap-1.5" title={uiT("Use camera", "कैमरा उपयोग करें")}>
              <Camera size={16} />
            </button>
            <button onClick={() => handleScanLookup()} disabled={scanLoading} className="btn-primary flex items-center gap-1.5 px-4">
              {scanLoading ? <span className="animate-spin">⟳</span> : <Search size={16} />} {uiT("Find", "खोजें")}
            </button>
            {scannedItem && <button onClick={() => { setScanInput(""); setScannedItem(null); setScanError(""); }} className="btn-secondary flex items-center gap-1">{uiT("Clear", "साफ़ करें")}</button>}
          </div>
          <p className="text-xs text-muted-400 text-center">{uiT("Scanner devices auto-submit on scan. You can also type the SKU and press Enter.", "स्कैनर डिवाइस स्कैन पर स्वतः सबमिट करते हैं। आप SKU टाइप करके Enter भी दबा सकते हैं।")}</p>
          {scanError && <p className="text-sm text-red-500 flex items-center gap-1"><span>⚠</span> {scanError}</p>}
          {scannedItem && (
            <div className="bg-white dark:bg-slate-800 rounded-lg p-4 space-y-2 border border-gray-200 dark:border-slate-600">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-muted-900 dark:text-white">{scannedItem.brand} {scannedItem.model}</h4>
                <div className="flex gap-1">
                  <button onClick={() => window.open(`/inventory/scan/${scannedItem.sku}`, "_blank")} className="btn-ghost btn-sm flex items-center gap-1 text-primary-600">
                    <Search size={14} /> {uiT("View", "देखें")}
                  </button>
                  <button onClick={() => handlePrintLabel(scannedItem)} className="btn-ghost btn-sm flex items-center gap-1">
                    <Printer size={14} /> {uiT("Print", "प्रिंट")}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <span className="text-muted-500">SKU:</span><span className="font-mono font-medium">{scannedItem.sku}</span>
                <span className="text-muted-500">{uiT("Category", "श्रेणी")}:</span><span className="capitalize">{scannedItem.category}</span>
                {scannedItem.inventoryType && <><span className="text-muted-500">{uiT("Type", "प्रकार")}:</span><span className="capitalize">{scannedItem.inventoryType}</span></>}
                {scannedItem.color && <><span className="text-muted-500">{uiT("Color", "रंग")}:</span><span>{scannedItem.color}</span></>}
                {scannedItem.gender && <><span className="text-muted-500">{uiT("Gender", "लिंग")}:</span><span>{scannedItem.gender}</span></>}
                {scannedItem.supplier && <><span className="text-muted-500">{uiT("Supplier", "आपूर्तिकर्ता")}:</span><span>{scannedItem.supplier}</span></>}
                <span className="text-muted-500">{uiT("Stock", "स्टॉक")}:</span><span className="font-medium">{scannedItem.quantity || 0}</span>
                <span className="text-muted-500">{uiT("Price", "मूल्य")}:</span><span className="font-medium">₹{scannedItem.sellingPrice || 0}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title={uiT("Adjust Stock", "स्टॉक समायोजित करें")}>
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Select Item", "आइटम चुनें")}</label>
            <select className="input-field" value={adjust.id} onChange={(e) => setAdjust({ ...adjust, id: e.target.value })}>
              <option value="">{uiT("Choose item", "आइटम चुनें")}</option>
              {list.map((it) => (
                <option key={it._id} value={it._id}>{it.sku} - {it.brand} ({it.quantity || 0} {uiT("in stock", "स्टॉक में")})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-700 dark:text-muted-300 mb-1.5">{uiT("Quantity Change (+/-)", "मात्रा परिवर्तन (+/-)")}</label>
            <input type="number" className="input-field" value={adjust.qty} onChange={(e) => setAdjust({ ...adjust, qty: Number(e.target.value) })} placeholder="+5 or -3" />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-surface-200/50 dark:border-slate-600/30">
            <button type="button" onClick={() => setShowAdjust(false)} className="btn-secondary">{uiT("Cancel", "रद्द करें")}</button>
            <button type="submit" disabled={isLoading} className="btn-success">{isLoading ? uiT("Saving...", "सहेज रहे हैं...") : uiT("Apply Adjustment", "समायोजन लागू करें")}</button>
          </div>
        </form>
      </Modal>

      {showCameraScanner && (
        <CameraScanner
          onScan={(code) => {
            setShowCameraScanner(false);
            setScanInput(code);
            handleScanLookup(code);
          }}
          onClose={() => setShowCameraScanner(false)}
        />
      )}
    </div>
  );
}

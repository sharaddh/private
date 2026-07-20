import React, { useEffect, useState } from "react";
import { inventoryService } from "../services";
import { useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem, useAdjustStock } from "../hooks";
import Table from "../components/Table";
import Modal from "../components/Modal";
import PageSkeleton from "../components/PageSkeleton";
import CameraScanner from "../components/CameraScanner";
import QRCode from "qrcode";
import { Plus, Edit2, Trash2, Package, Printer, QrCode, Search, Camera } from "lucide-react";
import { useTranslate } from "../context/TranslateContext";
import type { InventoryItem, InventoryFormData } from "../types";

export default function InventoryPage() {
  const { uiT } = useTranslate();
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showAdjust, setShowAdjust] = useState<boolean>(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryFormData>({
    sku: "", category: "Frame", inventoryType: "spectacles", brand: "", model: "", color: "", size: "",
    gender: "", supplier: "", quantity: 0, purchasePrice: 0, sellingPrice: 0, description: "", location: "shop",
    lensIndex: "", lensCoating: "", sphRight: "", cylRight: "", axisRight: "", sphLeft: "", cylLeft: "", axisLeft: "", addPower: "",
  });
  const [adjust, setAdjust] = useState<{ id: string; qty: number; note: string }>({ id: "", qty: 0, note: "" });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const { items: rawList, loading, refetch } = useInventory();
  const { create: createItem, loading: createLoading } = useCreateInventoryItem();
  const { update: updateItem, loading: updateLoading } = useUpdateInventoryItem();
  const { remove: deleteItem } = useDeleteInventoryItem();
  const { adjust: adjustStock, loading: adjustLoading } = useAdjustStock();

  const [list, setList] = useState<InventoryItem[]>(() => rawList || []);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [scanModal, setScanModal] = useState<boolean>(false);
  const [scanInput, setScanInput] = useState<string>("");
  const [scannedItem, setScannedItem] = useState<InventoryItem | null>(null);
  const [scanError, setScanError] = useState<string>("");
  const [scanLoading, setScanLoading] = useState<boolean>(false);
  const [showCameraScanner, setShowCameraScanner] = useState<boolean>(false);

  useEffect(() => {
    if (rawList) setList(rawList);
  }, [rawList]);

  function fetchInventory(): void {
    refetch();
  }

  function openCreate(): void {
    setEditing(null);
    setForm({ sku: "", category: "Frame", inventoryType: "spectacles", brand: "", model: "", color: "", size: "", gender: "", supplier: "", quantity: 0, purchasePrice: 0, sellingPrice: 0, description: "", location: "shop", lensIndex: "", lensCoating: "", sphRight: "", cylRight: "", axisRight: "", sphLeft: "", cylLeft: "", axisLeft: "", addPower: "" });
    setShowForm(true);
  }

  function openEdit(item: InventoryItem): void {
    setEditing(item);
    setForm({
      sku: item.sku || "", category: item.category || "Frame", inventoryType: item.inventoryType || "spectacles",
      brand: item.brand || "", model: item.model || "", color: item.color || "", size: item.size || "",
      gender: item.gender || "", supplier: item.supplier || "",
      quantity: item.quantity || 0, purchasePrice: item.purchasePrice || 0, sellingPrice: item.sellingPrice || 0,
      description: item.description || "", location: item.location || "shop",
      lensIndex: item.lensIndex || "", lensCoating: item.lensCoating || "",
      sphRight: item.sphRight || "", cylRight: item.cylRight || "", axisRight: item.axisRight || "",
      sphLeft: item.sphLeft || "", cylLeft: item.cylLeft || "", axisLeft: item.axisLeft || "",
      addPower: item.addPower || "",
    });
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = editing
        ? await updateItem(editing._id, form)
        : await createItem(form);
      if (res.success) { fetchInventory(); setShowForm(false); }
    } finally { setIsLoading(false); }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!confirm("Delete this item?")) return;
    const res = await deleteItem(id);
    if (res.success) setList((prev: InventoryItem[]) => prev.filter((i: InventoryItem) => i._id !== id));
  }

  async function handleAdjustStock(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!adjust.id) return;
    setIsLoading(true);
    try {
      const res = await adjustStock(adjust.id, adjust.qty, adjust.note);
      if (res.success) { fetchInventory(); setShowAdjust(false); setAdjust({ id: "", qty: 0, note: "" }); }
    } finally { setIsLoading(false); }
  }

  async function handlePrintLabel(item: InventoryItem): Promise<void> {
    const qrUrl: string = await QRCode.toDataURL(item.sku, { width: 300, margin: 1 });
    const printWindow: Window | null = window.open("", "_blank");
    if (!printWindow) return;
    const category: string = item.category || "Frame";
    const gender: string = item.gender ? ` / ${item.gender}` : "";
    const type: string = item.inventoryType ? `${item.inventoryType}${gender}` : category;
    printWindow.document.write(`
      <html><head><title>Print Label - ${item.sku}</title>
      <style>
        @page { size: 100mm 50mm; margin: 0; }
        body { margin: 0; padding: 4mm; width: 100mm; height: 50mm; box-sizing: border-box;
               font-family: Arial, sans-serif; display: flex; align-items: center; }
        .label { display: flex; align-items: center; gap: 4mm; width: 100%; }
        .qr img { width: 40mm; height: 40mm; }
        .info { flex: 1; font-size: 10pt; line-height: 1.3; }
        .info .sku { font-size: 12pt; font-weight: bold; }
        .info .brand { font-size: 11pt; }
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

  async function handleScanLookup(code?: string): Promise<void> {
    const sku: string = (code || scanInput).trim();
    if (!sku) return;
    setScanError("");
    setScannedItem(null);
    setScanLoading(true);
    try {
      const res = await inventoryService.scan(sku);
      if (res.success) {
        setScannedItem(res.data as InventoryItem);
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

  const categoryLabel = (cat: string): string => {
    if (cat === "Lens") return "badge-blue";
    if (cat === "Accessories") return "badge-purple";
    return "badge-gray";
  };

  const filteredList: InventoryItem[] = categoryFilter === "All" ? list : list.filter((i: InventoryItem) => (i.category || "Frame") === categoryFilter);
  const filteredCount: number = filteredList.length;
  const totalCount: number = list.length;
  const categories: string[] = ["All", "Frame", "Lens", "Accessories"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{uiT("Inventory", "इन्वेंट्री")}</h1>
          <p className="text-sm text-muted-500 mt-1">{uiT("Manage frames, lenses, and accessories stock.", "फ्रेम, लेंस और सहायक उपकरण का स्टॉक प्रबंधित करें।")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => { setScanModal(true); setScanInput(""); setScannedItem(null); setScanError(""); setScanLoading(false); }} className="btn-secondary flex items-center gap-2" aria-label={uiT("Scan QR Code", "QR कोड स्कैन करें")}>
            <QrCode size={18} /> {uiT("Scan QR Code", "QR कोड स्कैन करें")}
          </button>
          <button onClick={() => setShowAdjust(true)} className="btn-secondary flex items-center gap-2" aria-label={uiT("Adjust Stock", "स्टॉक समायोजित करें")}>
            <Package size={18} /> {uiT("Adjust Stock", "स्टॉक समायोजित करें")}
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2" aria-label={uiT("Add Item", "आइटम जोड़ें")}>
            <Plus size={18} /> <span className="hidden sm:inline">{uiT("Add Item", "आइटम जोड़ें")}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-th-text">{list.filter((i: InventoryItem) => i.category === "Frame" || !i.category).length}</p>
          <p className="text-sm text-th-secondary">{uiT("Frames", "फ्रेम")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-th-text">{list.filter((i: InventoryItem) => i.category === "Lens").length}</p>
          <p className="text-sm text-th-secondary">{uiT("Lenses", "लेंस")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-th-text">{list.filter((i: InventoryItem) => i.category === "Accessories").length}</p>
          <p className="text-sm text-th-secondary">{uiT("Accessories", "सहायक उपकरण")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-[#e74c3c]">{list.filter((i: InventoryItem) => (i.quantity || 0) <= 5).length}</p>
          <p className="text-sm text-th-secondary">{uiT("Low Stock", "कम स्टॉक")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-th-text">{list.length}</p>
          <p className="text-sm text-th-secondary">{uiT("Total Items", "कुल आइटम")}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-th-muted">{filteredCount} {uiT("of", "में से")} {totalCount}</span>
        {categories.map((c: string) => (
          <button key={c} onClick={() => setCategoryFilter(c)} aria-label={uiT(c, c === "All" ? "सभी" : c === "Frame" ? "फ्रेम" : c === "Lens" ? "लेंस" : "सहायक उपकरण")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg uppercase tracking-wider border transition-all ${
              categoryFilter === c
                ? "bg-[#1ed760] text-black border-[#1ed760]"
                : "bg-th-elevated text-th-secondary border-th-border hover:bg-th-hover"
            }`}>
            {uiT(c, c === "All" ? "सभी" : c === "Frame" ? "फ्रेम" : c === "Lens" ? "लेंस" : "सहायक उपकरण")}
          </button>
        ))}
      </div>

      {filteredList.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-th-muted">
          <Package size={48} className="mb-3 opacity-30" />
          <p className="text-sm">{uiT("No items found", "कोई आइटम नहीं मिला")}</p>
        </div>
      )}

      <Table
        columns={[
          { key: "sku", label: uiT("SKU", "SKU") },
          { key: "category", label: uiT("Category", "श्रेणी"), render: (v: string, row: InventoryItem) => (
            <span className="flex flex-col gap-0.5">
              <span className={`badge ${categoryLabel(v)}`}>{v || "Frame"}</span>
              {row.inventoryType && <span className="text-[14px] text-muted-400 capitalize">{row.inventoryType}</span>}
            </span>
          )},
          { key: "brand", label: uiT("Brand", "ब्रांड") },
          { key: "model", label: uiT("Model", "मॉडल") },
          { key: "color", label: uiT("Color", "रंग") },
          { key: "gender", label: uiT("Gender", "लिंग"), render: (v: string) => v ? <span className="text-xs">{v}</span> : null },
          { key: "location", label: uiT("Location", "स्थान"), render: (v: string) => (
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${v === "warehouse" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"}`}>
              {v === "warehouse" ? uiT("Warehouse", "गोदाम") : uiT("Shop", "दुकान")}
            </span>
          )},
          { key: "quantity", label: uiT("Stock", "स्टॉक"), render: (v: number) => (
            <span className={`font-medium ${v > 10 ? "text-[#1ed760]" : v > 0 ? "text-amber-400" : "text-[#e74c3c]"}`}>
              {v || 0}
            </span>
          )},
          { key: "sellingPrice", label: uiT("Price", "मूल्य"), render: (v: number) => `₹${(v || 0).toFixed(2)}` },
        ]}
        data={filteredList}
        searchPlaceholder={uiT("Search", "खोजें") + "..."}
        actions={(row: InventoryItem) => (
          <div className="flex items-center gap-1">
            <button onClick={() => handlePrintLabel(row)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" title={uiT("Print Label", "लेबल प्रिंट करें")} aria-label={uiT("Print Label", "लेबल प्रिंट करें")}>
              <Printer size={15} />
            </button>
            <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-[#1ed760]/10 rounded-lg text-[#1ed760]" aria-label={uiT("Edit Item", "आइटम संपादित करें")}><Edit2 size={15} /></button>
            <button onClick={() => handleDelete(row._id)} className="p-1.5 hover:bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]" aria-label={uiT("Delete Item", "आइटम हटाएं")}><Trash2 size={15} /></button>
          </div>
        )}
      />

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? uiT("Edit Item", "आइटम संपादित करें") : uiT("Add Item", "आइटम जोड़ें")} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("SKU", "SKU")} *</label>
              <input className="input-field" value={form.sku} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, sku: e.target.value.toUpperCase() })} required placeholder="e.g. FRM-001" aria-label={uiT("SKU", "SKU")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Category", "श्रेणी")}</label>
              <select className="input-field" value={form.category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, category: e.target.value, inventoryType: e.target.value === "Frame" ? "spectacles" : e.target.value === "Lens" ? "lens" : "accessory" })} aria-label={uiT("Category", "श्रेणी")}>
                <option value="Frame">{uiT("Frame / Glasses", "फ्रेम / चश्मा")}</option>
                <option value="Lens">{uiT("Lens", "लेंस")}</option>
                <option value="Accessories">{uiT("Accessories", "सहायक उपकरण")}</option>
              </select>
            </div>

            {form.category === "Frame" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Frame Type", "फ्रेम प्रकार")}</label>
                  <select className="input-field" value={form.inventoryType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, inventoryType: e.target.value })} aria-label={uiT("Frame Type", "फ्रेम प्रकार")}>
                    <option value="spectacles">{uiT("Spectacles", "चश्मा")}</option>
                    <option value="sunglasses">{uiT("Sunglasses", "सनग्लास")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Brand", "ब्रांड")}</label>
                  <input className="input-field" value={form.brand} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, brand: e.target.value })} aria-label={uiT("Brand", "ब्रांड")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Model", "मॉडल")}</label>
                  <input className="input-field" value={form.model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, model: e.target.value })} aria-label={uiT("Model", "मॉडल")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Color", "रंग")}</label>
                  <input className="input-field" value={form.color} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, color: e.target.value })} aria-label={uiT("Color", "रंग")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Size", "आकार")}</label>
                  <input className="input-field" value={form.size} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, size: e.target.value })} aria-label={uiT("Size", "आकार")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Gender", "लिंग")}</label>
                  <select className="input-field" value={form.gender} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, gender: e.target.value })} aria-label={uiT("Gender", "लिंग")}>
                    <option value="">{uiT("All / Unisex", "सभी / यूनिसेक्स")}</option>
                    <option value="Male">{uiT("Male", "पुरुष")}</option>
                    <option value="Female">{uiT("Female", "महिला")}</option>
                    <option value="Unisex">{uiT("Unisex", "यूनिसेक्स")}</option>
                  </select>
                </div>
              </>
            )}

            {form.category === "Lens" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Lens Type", "लेंस प्रकार")}</label>
                  <select className="input-field" value={form.inventoryType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, inventoryType: e.target.value })} aria-label={uiT("Lens Type", "लेंस प्रकार")}>
                    <option value="lens">{uiT("Single Vision", "सिंगल विज़न")}</option>
                    <option value="bifocal">{uiT("Bifocal", "बाइफोकल")}</option>
                    <option value="progressive">{uiT("Progressive", "प्रोग्रेसिव")}</option>
                    <option value="blue-cut">{uiT("Blue Cut", "ब्लू कट")}</option>
                    <option value="photochromic">{uiT("Photochromic", "फोटोक्रोमिक")}</option>
                    <option value="other">{uiT("Other", "अन्य")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Brand", "ब्रांड")}</label>
                  <input className="input-field" value={form.brand} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, brand: e.target.value })} aria-label={uiT("Brand", "ब्रांड")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Model", "मॉडल")}</label>
                  <input className="input-field" value={form.model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, model: e.target.value })} aria-label={uiT("Model", "मॉडल")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Lens Index", "लेंस इंडेक्स")}</label>
                  <select className="input-field" value={form.lensIndex} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, lensIndex: e.target.value })} aria-label={uiT("Lens Index", "लेंस इंडेक्स")}>
                    <option value="">{uiT("Select", "चुनें")}</option>
                    <option value="1.50">1.50</option>
                    <option value="1.56">1.56</option>
                    <option value="1.61">1.61</option>
                    <option value="1.67">1.67</option>
                    <option value="1.74">1.74</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Coating", "कोटिंग")}</label>
                  <select className="input-field" value={form.lensCoating} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, lensCoating: e.target.value })} aria-label={uiT("Coating", "कोटिंग")}>
                    <option value="">{uiT("None", "कोई नहीं")}</option>
                    <option value="anti-glare">{uiT("Anti-Glare", "एंटी-ग्लेयर")}</option>
                    <option value="scratch-resistant">{uiT("Scratch Resistant", "स्क्रैच रेसिस्टेंट")}</option>
                    <option value="blue-cut">{uiT("Blue Cut", "ब्लू कट")}</option>
                    <option value="uv-protection">{uiT("UV Protection", "यूवी सुरक्षा")}</option>
                    <option value="hydrophobic">{uiT("Hydrophobic", "हाइड्रोफोबिक")}</option>
                    <option value="multi-coat">{uiT("Multi-Coat", "मल्टी-कोट")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Size (mm)", "साइज़ (मिमी)")}</label>
                  <input className="input-field" value={form.size} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, size: e.target.value })} placeholder={uiT("e.g. 65, 72", "जैसे 65, 72")} aria-label={uiT("Size (mm)", "साइज़ (मिमी)")} />
                </div>
                <div className="md:col-span-2 border-t border-th-border pt-4 mt-2">
                  <p className="text-xs font-semibold text-th-muted uppercase tracking-wider mb-3">{uiT("Right Eye", "दायां आंख")}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">SPH</label>
                      <input className="input-field text-sm" value={form.sphRight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, sphRight: e.target.value })} placeholder="-2.00" aria-label="SPH Right" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">CYL</label>
                      <input className="input-field text-sm" value={form.cylRight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cylRight: e.target.value })} placeholder="-0.75" aria-label="CYL Right" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">AXIS</label>
                      <input className="input-field text-sm" value={form.axisRight} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, axisRight: e.target.value })} placeholder="180" aria-label="AXIS Right" />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold text-th-muted uppercase tracking-wider mb-3">{uiT("Left Eye", "बायां आंख")}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">SPH</label>
                      <input className="input-field text-sm" value={form.sphLeft} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, sphLeft: e.target.value })} placeholder="-1.50" aria-label="SPH Left" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">CYL</label>
                      <input className="input-field text-sm" value={form.cylLeft} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, cylLeft: e.target.value })} placeholder="-0.50" aria-label="CYL Left" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">AXIS</label>
                      <input className="input-field text-sm" value={form.axisLeft} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, axisLeft: e.target.value })} placeholder="175" aria-label="AXIS Left" />
                    </div>
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-th-secondary mb-1">ADD</label>
                  <input className="input-field text-sm w-40" value={form.addPower} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, addPower: e.target.value })} placeholder="+2.00" aria-label="ADD Power" />
                </div>
              </>
            )}

            {form.category === "Accessories" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Type", "प्रकार")}</label>
                  <select className="input-field" value={form.inventoryType} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, inventoryType: e.target.value })} aria-label={uiT("Type", "प्रकार")}>
                    <option value="accessory">{uiT("Accessory", "सहायक")}</option>
                    <option value="hearing-aid">{uiT("Hearing Aid", "श्रवण यंत्र")}</option>
                    <option value="cleaner">{uiT("Cleaner / Spray", "क्लीनर / स्प्रे")}</option>
                    <option value="case">{uiT("Case", "केस")}</option>
                    <option value="other">{uiT("Other", "अन्य")}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Brand", "ब्रांड")}</label>
                  <input className="input-field" value={form.brand} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, brand: e.target.value })} aria-label={uiT("Brand", "ब्रांड")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Model", "मॉडल")}</label>
                  <input className="input-field" value={form.model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, model: e.target.value })} aria-label={uiT("Model", "मॉडल")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Color", "रंग")}</label>
                  <input className="input-field" value={form.color} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, color: e.target.value })} aria-label={uiT("Color", "रंग")} />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Supplier", "आपूर्तिकर्ता")}</label>
              <input className="input-field" value={form.supplier} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, supplier: e.target.value })} placeholder={uiT("Supplier name", "आपूर्तिकर्ता का नाम")} aria-label={uiT("Supplier", "आपूर्तिकर्ता")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Location", "स्थान")}</label>
              <select className="input-field" value={form.location} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, location: e.target.value })} aria-label={uiT("Location", "स्थान")}>
                <option value="shop">{uiT("Shop", "दुकान")}</option>
                <option value="warehouse">{uiT("Warehouse", "गोदाम")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Quantity", "मात्रा")}</label>
              <input type="number" className="input-field" value={form.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, quantity: Number(e.target.value) })} aria-label={uiT("Quantity", "मात्रा")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Purchase Price (₹)", "खरीद मूल्य (₹)")}</label>
              <input type="number" step="0.01" className="input-field" value={form.purchasePrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, purchasePrice: Number(e.target.value) })} aria-label={uiT("Purchase Price", "खरीद मूल्य")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Selling Price (₹)", "बिक्री मूल्य (₹)")}</label>
              <input type="number" step="0.01" className="input-field" value={form.sellingPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, sellingPrice: Number(e.target.value) })} aria-label={uiT("Selling Price", "बिक्री मूल्य")} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Description", "विवरण")}</label>
              <textarea className="input-field" rows={2} value={form.description} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm({ ...form, description: e.target.value })} placeholder={uiT("Additional notes...", "अतिरिक्त नोट्स...")} aria-label={uiT("Description", "विवरण")} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-th-border">
            <button type="submit" disabled={isLoading} className="btn-primary" aria-label={isLoading ? uiT("Saving...", "सहेज रहे हैं...") : editing ? uiT("Save", "सहेजें") : uiT("Add Item", "आइटम जोड़ें")}>{isLoading ? uiT("Saving...", "सहेज रहे हैं...") : editing ? uiT("Save", "सहेजें") : uiT("Add Item", "आइटम जोड़ें")}</button>
          </div>
        </form>
      </Modal>

      <Modal open={scanModal} onClose={() => setScanModal(false)} title={uiT("Scan QR Code", "QR कोड स्कैन करें")} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-th-secondary">{uiT("Point your scanner at the QR code or type the SKU below.", "अपना स्कैनर QR कोड पर रखें या नीचे SKU टाइप करें।")}</p>
          <div className="flex gap-2">
            <input className="input-field flex-1 text-lg tracking-wider font-mono" placeholder={uiT("Scan or type SKU...", "स्कैन करें या SKU टाइप करें...")} value={scanInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setScanInput(e.target.value.toUpperCase())}
              onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); handleScanLookup(); } }} autoFocus aria-label={uiT("Scan or type SKU", "स्कैन करें या SKU टाइप करें")} />
            <button onClick={() => { setScanModal(false); setShowCameraScanner(true); }} className="btn-secondary flex items-center gap-1.5" title={uiT("Use camera", "कैमरा उपयोग करें")} aria-label={uiT("Use camera", "कैमरा उपयोग करें")}>
              <Camera size={16} />
            </button>
            <button onClick={() => handleScanLookup()} disabled={scanLoading} className="btn-primary flex items-center gap-1.5 px-4" aria-label={uiT("Find", "खोजें")}>
              {scanLoading ? <span className="animate-spin">⟳</span> : <Search size={16} />} {uiT("Find", "खोजें")}
            </button>
            {scannedItem && <button onClick={() => { setScanInput(""); setScannedItem(null); setScanError(""); }} className="btn-secondary flex items-center gap-1" aria-label={uiT("Clear", "साफ़ करें")}>{uiT("Clear", "साफ़ करें")}</button>}
          </div>
          <p className="text-xs text-th-muted text-center">{uiT("Scanner devices auto-submit on scan. You can also type the SKU and press Enter.", "स्कैनर डिवाइस स्कैन पर स्वतः सबमिट करते हैं। आप SKU टाइप करके Enter भी दबा सकते हैं।")}</p>
          {scanError && <p className="text-sm text-[#e74c3c] flex items-center gap-1"><span>⚠</span> {scanError}</p>}
          {scannedItem && (
            <div className="bg-th-surface rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-th-text">{scannedItem.brand} {scannedItem.model}</h4>
                <div className="flex gap-1">
                  <button onClick={() => window.open(`/inventory/scan/${scannedItem.sku}`, "_blank")} className="btn-ghost btn-sm flex items-center gap-1 text-[#1ed760]" aria-label={uiT("View", "देखें")}>
                    <Search size={14} /> {uiT("View", "देखें")}
                  </button>
                  <button onClick={() => handlePrintLabel(scannedItem)} className="btn-ghost btn-sm flex items-center gap-1" aria-label={uiT("Print", "प्रिंट")}>
                    <Printer size={14} /> {uiT("Print", "प्रिंट")}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <span className="text-th-muted">SKU:</span><span className="font-mono font-medium">{scannedItem.sku}</span>
                <span className="text-th-muted">{uiT("Category", "श्रेणी")}:</span><span className="capitalize">{scannedItem.category}</span>
                {scannedItem.inventoryType && <><span className="text-th-muted">{uiT("Type", "प्रकार")}:</span><span className="capitalize">{scannedItem.inventoryType}</span></>}
                {scannedItem.color && <><span className="text-th-muted">{uiT("Color", "रंग")}:</span><span>{scannedItem.color}</span></>}
                {scannedItem.gender && <><span className="text-th-muted">{uiT("Gender", "लिंग")}:</span><span>{scannedItem.gender}</span></>}
                {scannedItem.supplier && <><span className="text-th-muted">{uiT("Supplier", "आपूर्तिकर्ता")}:</span><span>{scannedItem.supplier}</span></>}
                <span className="text-th-muted">{uiT("Stock", "स्टॉक")}:</span><span className="font-medium">{scannedItem.quantity || 0}</span>
                <span className="text-th-muted">{uiT("Price", "मूल्य")}:</span><span className="font-medium">₹{scannedItem.sellingPrice || 0}</span>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showAdjust} onClose={() => setShowAdjust(false)} title={uiT("Adjust Stock", "स्टॉक समायोजित करें")}>
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Select Item", "आइटम चुनें")}</label>
            <select className="input-field" value={adjust.id} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setAdjust({ ...adjust, id: e.target.value })} aria-label={uiT("Select Item", "आइटम चुनें")}>
              <option value="">{uiT("Choose item", "आइटम चुनें")}</option>
              {list.map((it: InventoryItem) => (
                <option key={it._id} value={it._id}>{it.sku} - {it.brand} ({it.quantity || 0} {uiT("in stock", "स्टॉक में")})</option>
              ))}
            </select>
          </div>
          <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Quantity Change (+/-)", "मात्रा परिवर्तन (+/-)")}</label>
            <input type="number" className="input-field" value={adjust.qty} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjust({ ...adjust, qty: Number(e.target.value) })} placeholder="+5 or -3" aria-label={uiT("Quantity Change", "मात्रा परिवर्तन")} />
          </div>
          <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Note", "नोट")}</label>
            <input className="input-field" value={adjust.note} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAdjust({ ...adjust, note: e.target.value })} placeholder={uiT("Reason for adjustment...", "समायोजन का कारण...")} aria-label={uiT("Note", "नोट")} />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-th-border">
            <button type="submit" disabled={isLoading} className="btn-success" aria-label={isLoading ? uiT("Saving...", "सहेज रहे हैं...") : uiT("Apply Adjustment", "समायोजन लागू करें")}>{isLoading ? uiT("Saving...", "सहेज रहे हैं...") : uiT("Apply Adjustment", "समायोजन लागू करें")}</button>
          </div>
        </form>
      </Modal>

      {showCameraScanner && (
        <CameraScanner
          onScan={(code: string) => {
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

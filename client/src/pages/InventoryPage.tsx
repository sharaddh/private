import React, { useEffect, useState } from "react";
import { useInventory, useCreateInventoryItem, useUpdateInventoryItem, useDeleteInventoryItem, useAdjustStock } from "../hooks";
import Table from "../components/Table";
import Modal from "../components/Modal";
import PageSkeleton from "../components/PageSkeleton";
import QRCode from "qrcode";
import { Plus, Edit2, Trash2, Package, Printer } from "lucide-react";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";
import LensStockPanel from "../components/lens/LensStockPanel";
import type { InventoryItem, InventoryFormData } from "../types";

const INVENTORY_CATEGORIES = ["Specs", "Sunglasses", "Contact Lens", "Hearing Aid", "Solution", "Kit"] as const;
const INVENTORY_TYPE_BY_CATEGORY: Record<string, string> = {
  Specs: "spectacles",
  Sunglasses: "sunglasses",
  "Contact Lens": "lens",
  "Hearing Aid": "hearing-aid",
  Solution: "other",
  Kit: "other",
};

export default function InventoryPage() {
  const { uiT } = useTranslate();
  const toast = useToast();
  const [showForm, setShowForm] = useState<boolean>(false);
  const [showAdjust, setShowAdjust] = useState<boolean>(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryFormData>({
    sku: "", category: "Specs", inventoryType: "spectacles", brand: "", model: "", color: "", size: "",
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
  const [activeTab, setActiveTab] = useState<"items" | "lens">("items");

  useEffect(() => {
    if (rawList) setList(rawList);
  }, [rawList]);

  function fetchInventory(): void {
    refetch();
  }

  function openCreate(): void {
    setEditing(null);
    setForm({ sku: "", category: "Specs", inventoryType: "spectacles", brand: "", model: "", color: "", size: "", gender: "", supplier: "", quantity: 0, purchasePrice: 0, sellingPrice: 0, description: "", location: "shop", lensIndex: "", lensCoating: "", sphRight: "", cylRight: "", axisRight: "", sphLeft: "", cylLeft: "", axisLeft: "", addPower: "" });
    setShowForm(true);
  }

  function openEdit(item: InventoryItem): void {
    setEditing(item);
    setForm({
      sku: item.sku || "", category: item.category || "Specs", inventoryType: item.inventoryType || "spectacles",
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
      if (res.success) {
        toast.success(editing ? uiT("Item updated", "आइटम अपडेट हो गया") : uiT("Item added", "आइटम जोड़ा गया"));
        fetchInventory();
        setShowForm(false);
      } else {
        toast.error(res.message || uiT("Failed to save item", "आइटम सहेजा नहीं जा सका"));
      }
    } catch (err) {
      toast.error((err as Error).message || uiT("Failed to save item", "आइटम सहेजा नहीं जा सका"));
    } finally {
      setIsLoading(false);
    }
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
    const category: string = item.category || "Specs";
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

  if (loading && activeTab === "items") return <PageSkeleton page="inventory" />;

  const categoryLabel = (cat: string): string => {
    switch (cat) {
      case "Specs": return "badge-blue";
      case "Sunglasses": return "badge-purple";
      case "Contact Lens": return "badge-green";
      case "Hearing Aid": return "badge-yellow";
      case "Solution": return "badge-gray";
      case "Kit": return "badge-gray";
      default: return "badge-gray";
    }
  };

  const categoryHi = (c: string): string => {
    switch (c) {
      case "Specs": return "चश्मा";
      case "Sunglasses": return "सनग्लास";
      case "Contact Lens": return "कॉन्टैक्ट लेंस";
      case "Hearing Aid": return "श्रवण यंत्र";
      case "Solution": return "सॉल्यूशन";
      case "Kit": return "किट";
      default: return "सभी";
    }
  };

  const filteredList: InventoryItem[] = categoryFilter === "All" ? list : list.filter((i: InventoryItem) => (i.category || "Specs") === categoryFilter);
  const filteredCount: number = filteredList.length;
  const totalCount: number = list.length;
  const categories: string[] = ["All", ...INVENTORY_CATEGORIES];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{uiT("Inventory", "इन्वेंट्री")}</h1>
          <p className="text-sm text-muted-500 mt-1">{uiT("Manage specs, sunglasses, contact lenses, and more.", "चश्मा, सनग्लास, कॉन्टैक्ट लेंस और अन्य का स्टॉक प्रबंधित करें।")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {activeTab === "items" && (
            <>
              <button onClick={() => setShowAdjust(true)} className="btn-secondary flex items-center gap-2" aria-label={uiT("Adjust Stock", "स्टॉक समायोजित करें")}>
                <Package size={18} /> {uiT("Adjust Stock", "स्टॉक समायोजित करें")}
              </button>
              <button onClick={openCreate} className="btn-primary flex items-center gap-2" aria-label={uiT("Add Item", "आइटम जोड़ें")}>
                <Plus size={18} /> <span className="hidden sm:inline">{uiT("Add Item", "आइटम जोड़ें")}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 bg-th-elevated rounded-pill p-1 w-fit">
        {(["items", "lens"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            aria-label={uiT(t === "items" ? "Items" : "Lens Stock", t === "items" ? "आइटम" : "लेंस स्टॉक")}
            className={`px-5 py-2 rounded-pill text-small-bold transition-all active:scale-95 ${
              activeTab === t
                ? "bg-primary-500 text-surface-950 shadow-sm"
                : "text-th-secondary hover:text-th-text"
            }`}
          >
            {uiT(t === "items" ? "Items" : "Lens Stock", t === "items" ? "आइटम" : "लेंस स्टॉक")}
          </button>
        ))}
      </div>

      {activeTab === "items" ? (
        <>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-th-text">{list.filter((i: InventoryItem) => i.category === "Specs" || !i.category).length}</p>
          <p className="text-sm text-th-secondary">{uiT("Specs", "चश्मा")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-th-text">{list.filter((i: InventoryItem) => i.category === "Sunglasses").length}</p>
          <p className="text-sm text-th-secondary">{uiT("Sunglasses", "सनग्लास")}</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-th-text">{list.filter((i: InventoryItem) => i.category === "Contact Lens").length}</p>
          <p className="text-sm text-th-secondary">{uiT("Contact Lens", "कॉन्टैक्ट लेंस")}</p>
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
          <button key={c} onClick={() => setCategoryFilter(c)} aria-label={uiT(c, c === "All" ? "सभी" : categoryHi(c))}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg uppercase tracking-wider border transition-all ${
              categoryFilter === c
                ? "bg-[#1ed760] text-black border-[#1ed760]"
                : "bg-th-elevated text-th-secondary border-th-border hover:bg-th-hover"
            }`}>
            {uiT(c, c === "All" ? "सभी" : categoryHi(c))}
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
              <span className={`badge ${categoryLabel(v)}`}>{v || "Specs"}</span>
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
            <span className="flex items-center gap-2">
              <span className={`font-medium ${v > 10 ? "text-[#1ed760]" : v > 0 ? "text-amber-400" : "text-[#e74c3c]"}`}>
                {v || 0}
              </span>
              {v <= 0 && <span className="badge badge-red">{uiT("Out of stock", "स्टॉक समाप्त")}</span>}
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
        </>
      ) : (
        <LensStockPanel />
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? uiT("Edit Item", "आइटम संपादित करें") : uiT("Add Item", "आइटम जोड़ें")} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("SKU", "SKU")} *</label>
              <input className="input-field" value={form.sku} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, sku: e.target.value.toUpperCase() })} required placeholder="e.g. FRM-001" aria-label={uiT("SKU", "SKU")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Category", "श्रेणी")}</label>
              <select className="input-field" value={form.category} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setForm({ ...form, category: e.target.value, inventoryType: INVENTORY_TYPE_BY_CATEGORY[e.target.value] || "other" })} aria-label={uiT("Category", "श्रेणी")}>
                {INVENTORY_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{uiT(c, categoryHi(c))}</option>
                ))}
              </select>
            </div>

            {(form.category === "Specs" || form.category === "Sunglasses") && (
              <>
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

            {form.category === "Contact Lens" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Brand", "ब्रांड")}</label>
                  <input className="input-field" value={form.brand} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, brand: e.target.value })} aria-label={uiT("Brand", "ब्रांड")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Model", "मॉडल")}</label>
                  <input className="input-field" value={form.model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, model: e.target.value })} aria-label={uiT("Model", "मॉडल")} />
                </div>
              </>
            )}

            {(form.category === "Hearing Aid" || form.category === "Solution" || form.category === "Kit") && (
              <>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Brand", "ब्रांड")}</label>
                  <input className="input-field" value={form.brand} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, brand: e.target.value })} aria-label={uiT("Brand", "ब्रांड")} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Model", "मॉडल")}</label>
                  <input className="input-field" value={form.model} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, model: e.target.value })} aria-label={uiT("Model", "मॉडल")} />
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
    </div>
  );
}

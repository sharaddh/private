import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useInventory,
  useCreateInventoryItem,
  useUpdateInventoryItem,
  useDeleteInventoryItem,
  useAdjustStock,
  useDebounce,
} from "../hooks";
import { inventoryService, type InventoryListParams } from "../services";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import CameraScanner from "../components/CameraScanner";
import PageSkeleton from "../components/PageSkeleton";
import QRCode from "qrcode";
import {
  Plus, Minus, Edit2, Trash2, Package, Printer, History, Search, ScanLine,
  Upload, Download, ChevronLeft, ChevronRight, RefreshCw, FileSpreadsheet, X,
} from "lucide-react";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";
import LensStockPanel from "../components/lens/LensStockPanel";
import { parseCsv, rowsToObjects, downloadCsv } from "../utils/csv";
import type {
  InventoryItem,
  InventoryFormData,
  InventoryStats,
  InventoryImportResult,
  StockHistoryEntry,
  LensStockScope,
} from "../types";

const INVENTORY_CATEGORIES = ["Specs", "Sunglasses", "Contact Lens", "Hearing Aid", "Solution", "Kit"] as const;
const INVENTORY_TYPE_BY_CATEGORY: Record<string, string> = {
  Specs: "spectacles",
  Sunglasses: "sunglasses",
  "Contact Lens": "lens",
  "Hearing Aid": "hearing-aid",
  Solution: "other",
  Kit: "other",
};
const PAGE_SIZE = 20;
const THRESHOLD_OPTIONS = [3, 5, 10, 20];

const EMPTY_FORM: InventoryFormData = {
  sku: "", category: "Specs", inventoryType: "spectacles", brand: "", model: "", color: "", size: "",
  gender: "", supplier: "", quantity: 0, purchasePrice: 0, sellingPrice: 0, description: "", location: "shop",
  lensIndex: "", lensCoating: "", sphRight: "", cylRight: "", axisRight: "", sphLeft: "", cylLeft: "", axisLeft: "", addPower: "",
};

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const TYPE_LABELS: Record<string, string> = {
  adjust: "Adjustment",
  import: "Import",
  order: "Order",
  restore: "Restore",
};

export default function InventoryPage() {
  const { uiT } = useTranslate();
  const toast = useToast();
  const navigate = useNavigate();

  const [showForm, setShowForm] = useState<boolean>(false);
  const [showAdjust, setShowAdjust] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [showImport, setShowImport] = useState<boolean>(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryFormData>(EMPTY_FORM);
  const [adjust, setAdjust] = useState<{ id: string; qty: number; note: string }>({ id: "", qty: 0, note: "" });
  const [deleteTarget, setDeleteTarget] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [adjustingIds, setAdjustingIds] = useState<Record<string, "up" | "down" | undefined>>({});

  // Filters
  const [searchInput, setSearchInput] = useState<string>("");
  const debouncedSearch = useDebounce(searchInput, 350);
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);
  const [threshold, setThreshold] = useState<number>(5);
  const [page, setPage] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"items" | "lens">("items");
  const [lensScope, setLensScope] = useState<LensStockScope>("shop");

  const listParams: InventoryListParams = useMemo(() => {
    const p: InventoryListParams = { page, limit: PAGE_SIZE };
    if (debouncedSearch.trim()) p.search = debouncedSearch.trim();
    if (categoryFilter !== "All") p.category = categoryFilter;
    if (locationFilter !== "all") p.location = locationFilter;
    if (lowStockOnly) {
      p.lowStock = true;
      p.threshold = threshold;
    }
    return p;
  }, [debouncedSearch, categoryFilter, locationFilter, lowStockOnly, threshold, page]);

  const { items: pageItems, total, page: currentPage, pages: totalPages, loading, refetch } = useInventory(listParams);
  const [list, setList] = useState<InventoryItem[]>(() => pageItems || []);

  useEffect(() => {
    if (pageItems) setList(pageItems);
  }, [pageItems]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setPage(totalPages);
  }, [totalPages, currentPage]);

  const [stats, setStats] = useState<InventoryStats | null>(null);
  const fetchStats = useCallback(async () => {
    const res = await inventoryService.getStats(threshold);
    if (res.success && res.data) setStats(res.data);
  }, [threshold]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const { create: createItem } = useCreateInventoryItem();
  const { update: updateItem } = useUpdateInventoryItem();
  const { remove: deleteItem } = useDeleteInventoryItem();
  const { adjust: adjustStock } = useAdjustStock();

  const refreshAll = useCallback(() => {
    refetch();
    fetchStats();
  }, [refetch, fetchStats]);

  // CSV import state
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [importFileName, setImportFileName] = useState<string>("");
  const [importNote, setImportNote] = useState<string>("");
  const [importing, setImporting] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<InventoryImportResult | null>(null);

  function openCreate(): void {
    setEditing(null);
    setForm(EMPTY_FORM);
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

  function openAdjust(item?: InventoryItem): void {
    setAdjust(item ? { id: item._id, qty: 0, note: "" } : { id: "", qty: 0, note: "" });
    setShowAdjust(true);
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
        refreshAll();
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

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    const res = await deleteItem(deleteTarget._id);
    if (res.success) {
      toast.success(uiT("Item deleted", "आइटम हटा दिया गया"));
      setDeleteTarget(null);
      refreshAll();
    } else {
      toast.error(res.message || uiT("Failed to delete item", "आइटम हटाया नहीं जा सका"));
    }
  }

  async function handleAdjustStock(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!adjust.id) return;
    if (adjust.qty === 0) {
      toast.error(uiT("Enter a non-zero quantity", "गैर-शून्य मात्रा दर्ज करें"));
      return;
    }
    setIsLoading(true);
    try {
      const res = await adjustStock(adjust.id, adjust.qty, adjust.note);
      if (res.success) {
        toast.success(uiT("Stock adjusted", "स्टॉक समायोजित किया गया"));
        refreshAll();
        setShowAdjust(false);
        setAdjust({ id: "", qty: 0, note: "" });
      } else {
        toast.error(res.message || uiT("Failed to adjust stock", "स्टॉक समायोजित नहीं हुआ"));
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleQuickAdjust(item: InventoryItem, delta: number): Promise<void> {
    const dir = delta > 0 ? "up" : "down";
    if (adjustingIds[item._id]) return;
    if (delta < 0 && (item.quantity || 0) <= 0) return;
    setAdjustingIds((prev) => ({ ...prev, [item._id]: dir }));
    const res = await adjustStock(
      item._id,
      delta,
      delta > 0 ? uiT("Quick add", "त्वरित जोड़") : uiT("Quick reduce", "त्वरित घटाएं")
    );
    setAdjustingIds((prev) => ({ ...prev, [item._id]: undefined }));
    if (res.success && res.data) {
      setList((prev) => prev.map((i) => (i._id === item._id ? res.data! : i)));
      fetchStats();
    } else {
      toast.error(res.message || uiT("Failed to adjust stock", "स्टॉक समायोजित नहीं हुआ"));
    }
  }

  async function handlePrintLabel(item: InventoryItem): Promise<void> {
    const qrUrl: string = await QRCode.toDataURL(item.sku, { width: 600, margin: 1 });
    const printWindow: Window | null = window.open("", "_blank");
    if (!printWindow) return;
    const category: string = item.category || "Specs";
    const gender: string = item.gender ? ` / ${item.gender}` : "";
    const type: string = item.inventoryType ? `${item.inventoryType}${gender}` : category;
    const name: string = `${item.brand || ""} ${item.model || ""}`.trim() || item.sku;
    printWindow.document.write(`
      <html><head><title>Print Label - ${item.sku}</title>
      <style>
        @page { size: 88mm 12mm; margin: 0; }
        body { margin: 0; font-family: Arial, sans-serif; }
        .label { width: 88mm; height: 12mm; box-sizing: border-box; display: flex; align-items: center; gap: 2mm; padding: 1mm 2mm; }
        .qr img { width: 10mm; height: 10mm; }
        .info { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 0.5mm; min-width: 0; overflow: hidden; }
        .info .row { display: flex; align-items: baseline; gap: 2mm; }
        .info .name { font-size: 8pt; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .info .price { font-size: 10pt; font-weight: bold; }
        .info .sku { font-size: 6pt; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      </style></head><body>
      <div class="label">
        <div class="qr"><img src="${qrUrl}" /></div>
        <div class="info">
          <div class="row"><span class="name">${name}</span><span class="price">₹${item.sellingPrice || 0}</span></div>
          <div class="sku">${item.sku}${item.color ? " / " + item.color : ""}${type ? " / " + type : ""}</div>
        </div>
      </div>
      <script>window.print(); window.close();</script>
      </body></html>
    `);
    printWindow.document.close();
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    setImportResult(null);
    try {
      const text = await file.text();
      const objects = rowsToObjects(parseCsv(text));
      if (objects.length === 0) {
        toast.error(uiT("No rows found in the file", "फ़ाइल में कोई पंक्ति नहीं मिली"));
        setImportRows([]);
        return;
      }
      setImportRows(objects);
      toast.success(`${objects.length} ${uiT("rows ready to import", "पंक्तियां आयात के लिए तैयार")}`);
    } catch (err) {
      toast.error(uiT("Could not read the file", "फ़ाइल पढ़ी नहीं जा सकी"));
    } finally {
      e.target.value = "";
    }
  }

  async function runImport(): Promise<void> {
    if (importRows.length === 0) return;
    setImporting(true);
    const normalized = importRows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row)) {
        if (["quantity", "purchasePrice", "sellingPrice"].includes(k)) {
          const trimmed = String(v).trim();
          if (trimmed === "") {
            out[k] = undefined;
            continue;
          }
          const n = Number(trimmed);
          out[k] = isNaN(n) ? trimmed : n;
        } else if (k === "category") {
          const cat = String(v).trim().toLowerCase();
          const map: Record<string, string> = {
            specs: "Specs", sunglass: "Sunglasses", sunglasses: "Sunglasses",
            contactlens: "Contact Lens", contactlenses: "Contact Lens", contact: "Contact Lens",
            hearingaid: "Hearing Aid", hearing: "Hearing Aid", solution: "Solution", kit: "Kit",
          };
          out[k] = map[cat.replace(/[\s_-]+/g, "")] || String(v).trim();
        } else if (k === "gender") {
          const g = String(v).trim().toLowerCase();
          if (g === "m" || g === "male") out[k] = "Male";
          else if (g === "f" || g === "female") out[k] = "Female";
          else if (g === "u" || g === "unisex") out[k] = "Unisex";
          else out[k] = "";
        } else if (k === "location") {
          out[k] = String(v).trim().toLowerCase() === "warehouse" ? "warehouse" : "shop";
        } else {
          out[k] = String(v).trim();
        }
      }
      return out;
    });
    const res = await inventoryService.importItems(
      normalized,
      importNote.trim() || "CSV import"
    );
    setImporting(false);
    if (res.success && res.data) {
      setImportResult(res.data);
      refreshAll();
    } else {
      toast.error(res.message || uiT("Import failed", "आयात विफल रहा"));
    }
  }

  async function handleExport(): Promise<void> {
    toast.info(uiT("Preparing export...", "निर्यात तैयार हो रहा है..."));
    let all: InventoryItem[] = [];
    let p = 1;
    const limit = 10000;
    try {
      for (;;) {
        const res = await inventoryService.listFiltered({
          page: p, limit,
          search: debouncedSearch.trim() || undefined,
          category: categoryFilter !== "All" ? categoryFilter : undefined,
          location: locationFilter !== "all" ? locationFilter : undefined,
          lowStock: lowStockOnly ? true : undefined,
          threshold: lowStockOnly ? threshold : undefined,
        });
        if (!res.success || !res.data) {
          toast.error(res.message || uiT("Export failed", "निर्यात विफल रहा"));
          return;
        }
        all = all.concat(res.data.data);
        if (res.data.data.length < limit || p >= res.data.pages) break;
        p++;
      }
      if (all.length === 0) {
        toast.error(uiT("Nothing to export", "निर्यात करने के लिए कुछ नहीं है"));
        return;
      }
      const out = all.map((i) => ({
        sku: i.sku, category: i.category, inventoryType: i.inventoryType, brand: i.brand, model: i.model,
        color: i.color, size: i.size, gender: i.gender, supplier: i.supplier,
        quantity: i.quantity, purchasePrice: i.purchasePrice, sellingPrice: i.sellingPrice,
        location: i.location, description: i.description,
      }));
      downloadCsv(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, out);
      toast.success(`${all.length} ${uiT("items exported", "आइटम निर्यात हुए")}`);
    } catch (err) {
      toast.error(uiT("Export failed", "निर्यात विफल रहा"));
    }
  }

  function handleScan(code: string): void {
    setShowScanner(false);
    navigate(`/inventory/scan/${encodeURIComponent(code)}`);
  }

  if (loading && activeTab === "items" && list.length === 0 && page === 1) return <PageSkeleton page="inventory" />;

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

  const categories: string[] = ["All", ...INVENTORY_CATEGORIES];
  const filteredCount: number = total;
  const totalCount: number = stats?.totalItems ?? total;
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, total);

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    const start = Math.max(0, Math.min(currentPage - 1 - 2, totalPages - 5));
    const pgs = Array.from({ length: Math.min(totalPages, 5) }, (_, i) => start + i + 1);
    return (
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-th-secondary">
          {uiT("Showing", "दिखा रहे हैं")} {rangeStart}–{rangeEnd} {uiT("of", "में से")} {total}
        </p>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage <= 1}
            className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
            aria-label={uiT("Previous page", "पिछला पेज")}
          >
            <ChevronLeft size={16} />
          </button>
          {pgs.map((pg) => (
            <button
              key={pg}
              onClick={() => setPage(pg)}
              className={`w-8 h-8 rounded-[9999px] text-sm font-medium transition-colors ${
                pg === currentPage ? "bg-[#1ed760] text-black" : "hover:bg-th-elevated text-th-secondary"
              }`}
            >
              {pg}
            </button>
          ))}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
            aria-label={uiT("Next page", "अगला पेज")}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{uiT("Inventory", "इन्वेंट्री")}</h1>
          <p className="text-sm text-muted-500 mt-1">{uiT("Manage specs, sunglasses, contact lenses, and more.", "चश्मा, सनग्लास, कॉन्टैक्ट लेंस और अन्य का स्टॉक प्रबंधित करें।")}</p>
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

      {activeTab === "lens" && (
        <div className="flex gap-1 bg-th-elevated rounded-pill p-1 w-fit">
          {(["shop", "warehouse"] as LensStockScope[]).map((s) => (
            <button
              key={s}
              onClick={() => setLensScope(s)}
              className={`px-5 py-2 rounded-pill text-small-bold transition-all active:scale-95 ${
                lensScope === s
                  ? "bg-primary-500 text-surface-950 shadow-sm"
                  : "text-th-secondary hover:text-th-text"
              }`}
            >
              {uiT(s === "shop" ? "Shop" : "Warehouse", s === "shop" ? "दुकान" : "गोदाम")}
            </button>
          ))}
        </div>
      )}

      {activeTab === "items" && (
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setShowImport(true)} className="btn-secondary flex items-center gap-2" aria-label={uiT("Import CSV", "CSV आयात करें")}>
            <Upload size={18} /> <span className="hidden sm:inline">{uiT("Import", "आयात")}</span>
          </button>
          <button onClick={handleExport} className="btn-secondary flex items-center gap-2" aria-label={uiT("Export CSV", "CSV निर्यात करें")}>
            <Download size={18} /> <span className="hidden sm:inline">{uiT("Export", "निर्यात")}</span>
          </button>
          <button onClick={() => setShowScanner(true)} className="btn-secondary flex items-center gap-2" aria-label={uiT("Scan", "स्कैन करें")}>
            <ScanLine size={18} /> <span className="hidden sm:inline">{uiT("Scan", "स्कैन")}</span>
          </button>
          <button onClick={() => navigate("/inventory/withdraw")} className="btn-secondary flex items-center gap-2" aria-label={uiT("Withdraw Stock", "स्टॉक निकासी")}>
            <Package size={18} /> <span className="hidden sm:inline">{uiT("Withdraw", "निकासी")}</span>
          </button>
          <button onClick={() => navigate("/inventory/withdraw/history")} className="btn-secondary flex items-center gap-2" aria-label={uiT("Withdrawal History", "निकासी इतिहास")}>
            <History size={18} /> <span className="hidden sm:inline">{uiT("History", "इतिहास")}</span>
          </button>
          <button onClick={() => openAdjust()} className="btn-secondary flex items-center gap-2" aria-label={uiT("Adjust Stock", "स्टॉक समायोजित करें")}>
            <Package size={18} /> {uiT("Adjust Stock", "स्टॉक समायोजित करें")}
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2" aria-label={uiT("Add Item", "आइटम जोड़ें")}>
            <Plus size={18} /> <span className="hidden sm:inline">{uiT("Add Item", "आइटम जोड़ें")}</span>
          </button>
        </div>
      )}

      {activeTab === "items" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="card text-center">
              <p className="text-2xl font-bold text-th-text">{stats?.categoryCounts?.Specs ?? 0}</p>
              <p className="text-sm text-th-secondary">{uiT("Specs", "चश्मा")}</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-th-text">{stats?.categoryCounts?.Sunglasses ?? 0}</p>
              <p className="text-sm text-th-secondary">{uiT("Sunglasses", "सनग्लास")}</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-th-text">{stats?.categoryCounts?.["Contact Lens"] ?? 0}</p>
              <p className="text-sm text-th-secondary">{uiT("Contact Lens", "कॉन्टैक्ट लेंस")}</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-[#e74c3c]">{stats?.lowStock ?? 0}</p>
              <p className="text-sm text-th-secondary">
                {uiT("Low Stock", "कम स्टॉक")} (≤{stats?.lowStockThreshold ?? threshold})
              </p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-th-text">{totalCount}</p>
              <p className="text-sm text-th-secondary">{uiT("Total Items", "कुल आइटम")}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
                <input
                  type="text"
                  placeholder={uiT("Search by SKU, brand, model, color...", "SKU, ब्रांड, मॉडल, रंग से खोजें...")}
                  value={searchInput}
                  onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:border-[#1ed760] transition-all duration-200 bg-th-elevated text-th-text placeholder-th-muted text-[18px]"
                  style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }}
                  aria-label={uiT("Search", "खोजें")}
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  className="input-field w-auto"
                  value={locationFilter}
                  onChange={(e) => { setLocationFilter(e.target.value); setPage(1); }}
                  aria-label={uiT("Location", "स्थान")}
                >
                  <option value="all">{uiT("All Locations", "सभी स्थान")}</option>
                  <option value="shop">{uiT("Shop", "दुकान")}</option>
                  <option value="warehouse">{uiT("Warehouse", "गोदाम")}</option>
                </select>
                <button
                  onClick={() => { setLowStockOnly((v) => !v); setPage(1); }}
                  aria-pressed={lowStockOnly}
                  className={`px-3 py-2.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 ${
                    lowStockOnly
                      ? "bg-amber-500/15 text-amber-400 border-amber-500/40"
                      : "bg-th-elevated text-th-secondary border-th-border hover:bg-th-hover"
                  }`}
                >
                  {lowStockOnly && <X size={13} onClick={(e) => { e.stopPropagation(); setLowStockOnly(false); setPage(1); }} />}
                  {uiT("Low stock only", "केवल कम स्टॉक")}
                </button>
                {lowStockOnly && (
                  <select
                    className="input-field w-auto"
                    value={threshold}
                    onChange={(e) => { setThreshold(Number(e.target.value)); setPage(1); }}
                    aria-label={uiT("Low stock threshold", "कम स्टॉक सीमा")}
                  >
                    {THRESHOLD_OPTIONS.map((t) => (
                      <option key={t} value={t}>≤ {t}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-th-muted">{filteredCount} {uiT("of", "में से")} {totalCount}</span>
              {categories.map((c: string) => (
                <button
                  key={c}
                  onClick={() => { setCategoryFilter(c); setPage(1); }}
                  aria-label={uiT(c, c === "All" ? "सभी" : categoryHi(c))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg uppercase tracking-wider border transition-all ${
                    categoryFilter === c
                      ? "bg-[#1ed760] text-black border-[#1ed760]"
                      : "bg-th-elevated text-th-secondary border-th-border hover:bg-th-hover"
                  }`}
                >
                  {uiT(c, c === "All" ? "सभी" : categoryHi(c))}
                </button>
              ))}
            </div>

            {loading && (
              <div className="flex items-center gap-2 text-th-secondary text-sm">
                <RefreshCw size={15} className="animate-spin" /> {uiT("Loading...", "लोड हो रहा है...")}
              </div>
            )}

            {list.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center py-16 text-th-muted">
                <Package size={48} className="mb-3 opacity-30" />
                <p className="text-sm">{uiT("No items found", "कोई आइटम नहीं मिला")}</p>
              </div>
            )}

            {list.length > 0 && (
              <div className="overflow-x-auto bg-th-surface rounded-[8px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-th-hover bg-th-base">
                      <th className="px-4 py-3.5 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-3.5 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Category", "श्रेणी")}</th>
                      <th className="px-4 py-3.5 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Brand / Model", "ब्रांड / मॉडल")}</th>
                      <th className="px-4 py-3.5 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Color / Size", "रंग / आकार")}</th>
                      <th className="px-4 py-3.5 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Location", "स्थान")}</th>
                      <th className="px-4 py-3.5 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Stock", "स्टॉक")}</th>
                      <th className="px-4 py-3.5 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Price", "मूल्य")}</th>
                      <th className="px-4 py-3.5 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Actions", "कार्रवाई")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-th-border">
                    {list.map((row) => {
                      const qty = row.quantity || 0;
                      const adjusting = adjustingIds[row._id];
                      return (
                        <tr key={row._id} className="hover:bg-th-card transition-colors">
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-mono text-sm text-th-text">{row.sku}</span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="flex flex-col gap-0.5">
                              <span className={`badge ${categoryLabel(row.category || "Specs")}`}>{row.category || "Specs"}</span>
                              {row.inventoryType && <span className="text-[14px] text-muted-400 capitalize">{row.inventoryType}</span>}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-sm font-medium text-th-text">{row.brand || "—"}</span>
                            {row.model && <span className="text-xs text-th-secondary block">{row.model}</span>}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="text-sm text-th-text">{row.color || "—"}</span>
                            {row.size && <span className="text-xs text-th-secondary block">{row.size}</span>}
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-lg ${row.location === "warehouse" ? "bg-purple-500/10 text-purple-400" : "bg-blue-500/10 text-blue-400"}`}>
                              {row.location === "warehouse" ? uiT("Warehouse", "गोदाम") : uiT("Shop", "दुकान")}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => handleQuickAdjust(row, -1)}
                                disabled={qty <= 0 || !!adjusting}
                                className="p-1 rounded-md hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed text-[#e74c3c]"
                                title={uiT("Reduce stock", "स्टॉक घटाएं")}
                                aria-label={uiT("Reduce stock", "स्टॉक घटाएं")}
                              >
                                <Minus size={15} />
                              </button>
                              <span className={`font-medium min-w-[28px] text-center ${qty > (stats?.lowStockThreshold ?? 5) ? "text-[#1ed760]" : qty > 0 ? "text-amber-400" : "text-[#e74c3c]"}`}>
                                {adjusting ? (adjusting === "up" ? "…" : "…") : qty}
                              </span>
                              <button
                                onClick={() => handleQuickAdjust(row, 1)}
                                disabled={!!adjusting}
                                className="p-1 rounded-md hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed text-[#1ed760]"
                                title={uiT("Add stock", "स्टॉक जोड़ें")}
                                aria-label={uiT("Add stock", "स्टॉक जोड़ें")}
                              >
                                <Plus size={15} />
                              </button>
                              {qty <= 0 && <span className="badge badge-red">{uiT("Out", "खत्म")}</span>}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 whitespace-nowrap text-sm text-th-text">₹{(row.sellingPrice || 0).toFixed(2)}</td>
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1">
                              <button onClick={() => setHistoryItem(row)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" title={uiT("History", "इतिहास")} aria-label={uiT("History", "इतिहास")}>
                                <History size={15} />
                              </button>
                              <button onClick={() => openAdjust(row)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" title={uiT("Adjust Stock", "स्टॉक समायोजित करें")} aria-label={uiT("Adjust Stock", "स्टॉक समायोजित करें")}>
                                <Package size={15} />
                              </button>
                              <button onClick={() => handlePrintLabel(row)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" title={uiT("Print Label", "लेबल प्रिंट करें")} aria-label={uiT("Print Label", "लेबल प्रिंट करें")}>
                                <Printer size={15} />
                              </button>
                              <button onClick={() => openEdit(row)} className="p-1.5 hover:bg-[#1ed760]/10 rounded-lg text-[#1ed760]" aria-label={uiT("Edit Item", "आइटम संपादित करें")}>
                                <Edit2 size={15} />
                              </button>
                              <button onClick={() => setDeleteTarget(row)} className="p-1.5 hover:bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]" aria-label={uiT("Delete Item", "आइटम हटाएं")}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {renderPagination()}
          </div>
        </>
      ) : (
        <LensStockPanel scope={lensScope} onScopeChange={setLensScope} />
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
                  <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Size", "आकार")}</label>
                  <input className="input-field" value={form.size} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, size: e.target.value })} placeholder="e.g. 52-18-140" aria-label={uiT("Size", "आकार")} />
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
                <div className="md:col-span-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-th-muted mb-2">{uiT("Lens details (optional)", "लेंस विवरण (वैकल्पिक)")}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-3 rounded-lg border border-th-border p-3">
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">{uiT("Index", "इंडेक्स")}</label>
                      <input className="input-field" value={form.lensIndex} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, lensIndex: e.target.value })} placeholder="e.g. 1.6" aria-label={uiT("Index", "इंडेक्स")} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">{uiT("Coating", "कोटिंग")}</label>
                      <input className="input-field" value={form.lensCoating} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, lensCoating: e.target.value })} placeholder="e.g. Anti-glare" aria-label={uiT("Coating", "कोटिंग")} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-th-secondary mb-1">{uiT("Add Power", "ऐड पावर")}</label>
                      <input className="input-field" value={form.addPower} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, addPower: e.target.value })} placeholder="e.g. +2.00" aria-label={uiT("Add Power", "ऐड पावर")} />
                    </div>
                    {(["Right", "Left"] as const).map((side) => {
                      const isR = side === "Right";
                      const base = isR ? { sph: "sphRight", cyl: "cylRight", axis: "axisRight" } : { sph: "sphLeft", cyl: "cylLeft", axis: "axisLeft" };
                      const sideLabel = isR ? uiT("Right eye", "दाहिनी आंख") : uiT("Left eye", "बाईं आंख");
                      return (
                        <React.Fragment key={side}>
                          <div>
                            <label className="block text-xs font-medium text-th-secondary mb-1">{sideLabel} SPH</label>
                            <input className="input-field" value={form[base.sph as keyof InventoryFormData] as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [base.sph]: e.target.value })} placeholder="e.g. -2.50" aria-label={`${sideLabel} SPH`} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-th-secondary mb-1">{sideLabel} CYL</label>
                            <input className="input-field" value={form[base.cyl as keyof InventoryFormData] as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [base.cyl]: e.target.value })} placeholder="e.g. -0.75" aria-label={`${sideLabel} CYL`} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-th-secondary mb-1">{sideLabel} Axis</label>
                            <input className="input-field" value={form[base.axis as keyof InventoryFormData] as string} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [base.axis]: e.target.value })} placeholder="e.g. 180" aria-label={`${sideLabel} Axis`} />
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
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
              <input type="number" min={0} className="input-field" value={form.quantity} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, quantity: Math.max(0, Number(e.target.value)) })} aria-label={uiT("Quantity", "मात्रा")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Purchase Price (₹)", "खरीद मूल्य (₹)")}</label>
              <input type="number" step="0.01" min={0} className="input-field" value={form.purchasePrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, purchasePrice: Math.max(0, Number(e.target.value)) })} aria-label={uiT("Purchase Price", "खरीद मूल्य")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Selling Price (₹)", "बिक्री मूल्य (₹)")}</label>
              <input type="number" step="0.01" min={0} className="input-field" value={form.sellingPrice} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, sellingPrice: Math.max(0, Number(e.target.value)) })} aria-label={uiT("Selling Price", "बिक्री मूल्य")} />
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

      <Modal open={showImport} onClose={() => { setShowImport(false); setImportRows([]); setImportResult(null); setImportNote(""); setImportFileName(""); }} title={uiT("Import Stock (CSV)", "स्टॉक आयात करें (CSV)")} size="lg">
        <div className="space-y-4">
          <p className="text-sm text-th-secondary">
            {uiT("Upload a CSV with columns:", "कॉलम वाली CSV फ़ाइल अपलोड करें:")}{" "}
            <code className="text-xs bg-th-elevated px-1.5 py-0.5 rounded">sku, category, brand, model, color, size, gender, supplier, quantity, purchasePrice, sellingPrice, location, description</code>
          </p>
          <p className="text-xs text-th-muted">
            {uiT("Only SKU is required. Existing items get their stock increased; new SKUs are added automatically.", "केवल SKU आवश्यक है। मौजूदा आइटम का स्टॉक बढ़ जाता है; नए SKU अपने आप जुड़ जाते हैं।")}
          </p>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-th-border hover:border-primary-500/50 rounded-xl p-6 cursor-pointer transition-colors">
            <FileSpreadsheet size={28} className="text-th-secondary" />
            <span className="text-sm font-medium text-th-text">
              {importFileName || uiT("Choose CSV file", "CSV फ़ाइल चुनें")}
            </span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFile} aria-label={uiT("Choose CSV file", "CSV फ़ाइल चुनें")} />
          </label>

          {importRows.length > 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-th-text font-medium">{importRows.length} {uiT("rows parsed", "पंक्तियां पार्स हुईं")}</span>
                <span className="text-th-muted text-xs">{uiT("Preview", "पूर्वावलोकन")}</span>
              </div>
              <div className="overflow-x-auto max-h-48 rounded-lg border border-th-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-th-elevated text-th-secondary">
                      {Object.keys(importRows[0]).map((k) => (
                        <th key={k} className="px-2 py-2 text-left font-semibold whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.slice(0, 5).map((r, idx) => (
                      <tr key={idx} className="border-t border-th-border">
                        {Object.values(r).map((v, i) => (
                          <td key={i} className="px-2 py-1.5 whitespace-nowrap">{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">{uiT("Note (optional)", "नोट (वैकल्पिक)")}</label>
                <input className="input-field" value={importNote} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setImportNote(e.target.value)} placeholder={uiT("e.g. January stock delivery", "जैसे: जनवरी स्टॉक डिलीवरी")} aria-label={uiT("Note", "नोट")} />
              </div>

              {importResult && (
                <div className="rounded-lg border border-th-border p-4 space-y-2">
                  <p className="text-sm font-semibold text-th-text">{uiT("Import result", "आयात परिणाम")}</p>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <span className="text-[#1ed760] font-medium">+{importResult.created} {uiT("created", "नए")}</span>
                    <span className="text-amber-400 font-medium">↻ {importResult.updated} {uiT("updated", "अपडेट")}</span>
                    <span className="text-[#e74c3c] font-medium">✕ {importResult.skipped} {uiT("skipped", "छोड़े गए")}</span>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded-lg bg-th-elevated p-2">
                      {importResult.errors.map((e, idx) => (
                        <p key={idx} className="text-xs text-[#e74c3c] py-0.5">Row {e.row}: {e.message}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setImportRows([]); setImportResult(null); setImportNote(""); setImportFileName(""); }}
                  className="btn-secondary"
                >
                  {uiT("Clear", "साफ़ करें")}
                </button>
                <button type="button" onClick={runImport} disabled={importing} className="btn-primary">
                  {importing ? uiT("Importing...", "आयात हो रहा है...") : uiT("Import Stock", "स्टॉक आयात करें")}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!historyItem} onClose={() => setHistoryItem(null)} title={`${uiT("Stock History", "स्टॉक इतिहास")} — ${historyItem?.sku ?? ""}`}>
        <div className="space-y-2">
          {historyItem && (!historyItem.stockHistory || historyItem.stockHistory.length === 0) && (
            <p className="text-sm text-th-muted text-center py-8">{uiT("No stock history yet", "अभी कोई स्टॉक इतिहास नहीं")}</p>
          )}
          {historyItem?.stockHistory?.map((h: StockHistoryEntry, idx: number) => (
            <div key={idx} className="flex items-start justify-between gap-3 rounded-lg border border-th-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-th-text">
                  {h.qty > 0 ? "+" : ""}{h.qty}
                  <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-pill ${h.qty > 0 ? "bg-[#1ed760]/10 text-[#1ed760]" : "bg-[#e74c3c]/10 text-[#e74c3c]"}`}>
                    {TYPE_LABELS[h.type] || h.type}
                  </span>
                </p>
                {h.note && <p className="text-xs text-th-secondary mt-0.5 truncate">{h.note}</p>}
                {h.by && <p className="text-xs text-th-muted mt-0.5">{uiT("by", "द्वारा")} {h.by}</p>}
              </div>
              <span className="text-xs text-th-muted shrink-0">{formatDate(h.at)}</span>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={showScanner} onClose={() => setShowScanner(false)} title={uiT("Scan Barcode / QR", "बारकोड / QR स्कैन करें")} size="sm">
        <CameraScanner onClose={() => setShowScanner(false)} onScan={handleScan} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={uiT("Delete Item", "आइटम हटाएं")}
        message={uiT("Delete", "हटाएं") + ` ${deleteTarget?.sku ?? ""}? ` + uiT("This cannot be undone.", "यह वापस नहीं किया जा सकता।")}
        confirmLabel={uiT("Delete", "हटाएं")}
        cancelLabel={uiT("Cancel", "रद्द करें")}
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

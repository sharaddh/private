import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Search, RefreshCw, Eye, Pencil, Trash2, PackagePlus, SlidersHorizontal, Layers,
} from "lucide-react";
import {
  useV2Variants, useV2VariantDetail, useV2Brands, useV2Racks,
  useCreateVariant, useUpdateVariant, useDeleteVariant, useAddStock, useAdjustStockV2,
} from "../../hooks";
import Modal from "../Modal";
import ConfirmDialog from "../ConfirmDialog";
import { Pagination, EmptyState, formatDateTime, formatCurrency, stockBadgeClass, stockTextClass } from "./shared";
import {
  PRODUCT_CATEGORIES, MOVEMENT_TYPE_LABELS,
  type InventoryVariant, type Rack, type Gender,
} from "../../types/inventoryV2";
import { useToast } from "../../context/ToastContext";

const PAGE_SIZE = 20;
const STOCK_FILTERS = [
  { value: "all", label: "All stock" },
  { value: "in", label: "In stock" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
] as const;

const EMPTY_CREATE_FORM = {
  sku: "", brandId: "", brandName: "", category: "Specs", model: "", color: "", size: "",
  gender: "" as Gender, defaultSellingPrice: "", rackId: "", supplierName: "", material: "", frameShape: "",
};

const EMPTY_ADD_STOCK = {
  quantity: 1, purchasePrice: 0, sellingPrice: "", supplierName: "", rackId: "",
  purchaseDate: "", batchNumber: "", expiryDate: "", note: "",
};

const EMPTY_ADJUST = { quantity: 0, note: "" };

export default function VariantsTab() {
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("");
  const [rackFilter, setRackFilter] = useState<string>("");
  const [threshold, setThreshold] = useState(5);
  const [page, setPage] = useState(1);

  const { variants, total, pages, loading, refetch } = useV2Variants({
    page, limit: PAGE_SIZE,
    search: search.trim() || undefined,
    category: categoryFilter !== "All" ? categoryFilter : undefined,
    stock: stockFilter === "all" ? undefined : (stockFilter as "in" | "low" | "out"),
    threshold: stockFilter === "low" ? threshold : undefined,
    brandId: brandFilter || undefined,
    rackId: rackFilter || undefined,
  });
  const { brands } = useV2Brands(threshold);
  const { racks } = useV2Racks();

  const [detailId, setDetailId] = useState<string>("");
  const { detail, loading: detailLoading, refetch: refetchDetail } = useV2VariantDetail(detailId);

  const [createModal, setCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [createSaving, setCreateSaving] = useState(false);

  const [addStockFor, setAddStockFor] = useState<InventoryVariant | null>(null);
  const [addStockForm, setAddStockForm] = useState(EMPTY_ADD_STOCK);
  const [addSaving, setAddSaving] = useState(false);

  const [adjustTarget, setAdjustTarget] = useState<InventoryVariant | null>(null);
  const [adjustForm, setAdjustForm] = useState(EMPTY_ADJUST);
  const [adjustSaving, setAdjustSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<InventoryVariant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { create: createVariant } = useCreateVariant();
  const { update: updateVariant } = useUpdateVariant();
  const { remove: removeVariant } = useDeleteVariant();
  const { add: addStock } = useAddStock();
  const { adjust: adjustStock } = useAdjustStockV2();

  const refreshAll = useCallback(() => {
    refetch();
    if (detailId) refetchDetail();
  }, [refetch, refetchDetail, detailId]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, stockFilter, brandFilter, rackFilter]);

  function openCreate(): void {
    setCreateForm({ ...EMPTY_CREATE_FORM, category: categoryFilter !== "All" ? categoryFilter : "Specs" });
    setCreateModal(true);
  }

  function openAddStock(v: InventoryVariant): void {
    setAddStockFor(v);
    setAddStockForm({ ...EMPTY_ADD_STOCK, rackId: v.rackId || "" });
  }

  function openAdjust(v: InventoryVariant): void {
    setAdjustTarget(v);
    setAdjustForm(EMPTY_ADJUST);
  }

  async function handleCreateVariant(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!createForm.sku.trim()) { toast.error("SKU is required"); return; }
    if (!createForm.model.trim()) { toast.error("Model is required"); return; }
    setCreateSaving(true);
    try {
      const selectedBrand = brands.find((b) => b._id === createForm.brandId);
      const res = await createVariant({
        brandId: createForm.brandId || undefined,
        brandName: createForm.brandName.trim() || selectedBrand?.name || undefined,
        category: createForm.category || undefined,
        model: createForm.model.trim(),
        gender: createForm.gender || undefined,
        sku: createForm.sku.trim(),
        color: createForm.color.trim() || undefined,
        size: createForm.size.trim() || undefined,
        defaultSellingPrice: createForm.defaultSellingPrice !== "" ? Number(createForm.defaultSellingPrice) : undefined,
        rackId: createForm.rackId || undefined,
        supplierName: createForm.supplierName.trim() || undefined,
        material: createForm.material.trim() || undefined,
        frameShape: createForm.frameShape.trim() || undefined,
      });
      if (res.success) {
        toast.success("Variant created");
        setCreateModal(false);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to create variant");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to create variant");
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleAddStock(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!addStockFor) return;
    const qty = Number(addStockForm.quantity);
    if (!Number.isFinite(qty) || qty < 1) { toast.error("Quantity must be at least 1"); return; }
    setAddSaving(true);
    try {
      const res = await addStock({
        variantId: addStockFor._id,
        quantity: Math.floor(qty),
        purchasePrice: Number(addStockForm.purchasePrice) || 0,
        sellingPrice: addStockForm.sellingPrice !== "" ? Number(addStockForm.sellingPrice) : undefined,
        supplierName: addStockForm.supplierName.trim() || undefined,
        rackId: addStockForm.rackId || undefined,
        purchaseDate: addStockForm.purchaseDate || undefined,
        batchNumber: addStockForm.batchNumber.trim() || undefined,
        expiryDate: addStockForm.expiryDate || undefined,
        note: addStockForm.note.trim() || undefined,
      });
      if (res.success) {
        toast.success("Stock added");
        setAddStockFor(null);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to add stock");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to add stock");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleAdjust(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!adjustTarget) return;
    const qty = Number(adjustForm.quantity);
    if (!Number.isFinite(qty) || qty === 0) { toast.error("Adjustment must be a non-zero number"); return; }
    setAdjustSaving(true);
    try {
      const res = await adjustStock(adjustTarget._id, { quantity: Math.floor(qty), note: adjustForm.note.trim() || "Manual adjustment" });
      if (res.success) {
        toast.success("Stock adjusted");
        setAdjustTarget(null);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to adjust stock");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to adjust stock");
    } finally {
      setAdjustSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await removeVariant(deleteTarget._id);
      if (res.success) {
        toast.success("Variant removed");
        setDeleteTarget(null);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to remove variant");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to remove variant");
    } finally {
      setDeleting(false);
    }
  }

  const rackLabel = useMemo(() => {
    const map = new Map<string, string>();
    racks.forEach((r) => map.set(r._id, r.code));
    return map;
  }, [racks]);

  const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover";
  const inputStyle = { border: "1px solid rgb(124,124,124)" } as const;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-th-secondary">{total} variants</p>
        <div className="flex items-center gap-2">
          <button onClick={refreshAll} className="btn-secondary flex items-center gap-2" aria-label="Refresh">
            <RefreshCw size={15} /> Refresh
          </button>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2" aria-label="Add variant">
            <Plus size={16} /> Variant
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
          <input
            type="text"
            placeholder="Search by SKU, brand, model, color, rack..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-th-elevated text-th-text placeholder-th-muted text-sm"
            style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }}
            aria-label="Search variants"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input-field w-auto" value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} aria-label="Filter by brand">
            <option value="">All brands</option>
            {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <select className="input-field w-auto" value={rackFilter} onChange={(e) => setRackFilter(e.target.value)} aria-label="Filter by rack">
            <option value="">All racks</option>
            {racks.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
          </select>
          <select className="input-field w-auto" value={stockFilter} onChange={(e) => setStockFilter(e.target.value)} aria-label="Filter by stock">
            {STOCK_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {stockFilter === "low" && (
            <select className="input-field w-auto" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Low stock threshold">
              {[3, 5, 10, 20].map((t) => <option key={t} value={t}>≤ {t}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-th-border">
        {["All", ...PRODUCT_CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg uppercase tracking-wider border transition-all whitespace-nowrap ${
              categoryFilter === c
                ? "bg-[#1ed760] text-black border-[#1ed760]"
                : "bg-th-elevated text-th-secondary border-th-border hover:bg-th-hover"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading && !variants.length && (
        <div className="flex items-center gap-2 text-th-secondary text-sm">
          <RefreshCw size={15} className="animate-spin" /> Loading variants...
        </div>
      )}

      {variants.length === 0 && !loading ? (
        <EmptyState icon={Layers} text="No variants found" />
      ) : (
        <div className="overflow-x-auto bg-th-surface rounded-[8px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-hover bg-th-base">
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Brand / Model</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Color / Size</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Rack</th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Stock</th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Price</th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-border">
              {variants.map((v) => (
                <tr key={v._id} className="hover:bg-th-card transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-sm text-th-text">{v.sku}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm font-medium text-th-text">{v.brandName || "—"}</span>
                    {v.model && <span className="text-xs text-th-secondary block">{v.model}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-sm text-th-text">{v.color || "—"}</span>
                    {v.size && <span className="text-xs text-th-secondary block">{v.size}</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-th-secondary">{v.rackLabel || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className={`font-semibold ${stockTextClass(v.stockQuantity, threshold)}`}>{v.stockQuantity}</span>
                    <span className={`ml-1 ${stockBadgeClass(v.stockQuantity, threshold)}`}>
                      {v.stockQuantity <= 0 ? "Out" : v.stockQuantity <= threshold ? "Low" : "Ok"}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-th-text">{formatCurrency(v.defaultSellingPrice)}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <button type="button" onClick={() => setDetailId(v._id)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="View details">
                        <Eye size={15} />
                      </button>
                      <button type="button" onClick={() => openAddStock(v)} className="p-1.5 hover:bg-[#1ed760]/10 rounded-lg text-[#1ed760]" aria-label="Add stock">
                        <PackagePlus size={15} />
                      </button>
                      <button type="button" onClick={() => openAdjust(v)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Adjust stock">
                        <SlidersHorizontal size={15} />
                      </button>
                      <button type="button" onClick={() => { setCreateForm({ ...EMPTY_CREATE_FORM, brandId: v.brandId || "", brandName: v.brandName || "", category: v.category, model: v.model, color: v.color, size: v.size, gender: (v.gender as Gender) || "" }); setCreateModal(true); }} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Create similar variant">
                        <Plus size={15} />
                      </button>
                      <button type="button" onClick={() => setDeleteTarget(v)} className="p-1.5 hover:bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]" aria-label="Remove variant">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      {/* Detail modal */}
      <Modal open={!!detailId} onClose={() => setDetailId("")} title="Variant Details" size="xl">
        {detailLoading && !detail ? (
          <div className="flex items-center gap-2 text-th-secondary text-sm">
            <RefreshCw size={15} className="animate-spin" /> Loading...
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="card p-3"><p className="text-[11px] text-th-secondary uppercase">SKU</p><p className="font-mono text-sm font-semibold text-th-text">{detail.variant.sku}</p></div>
              <div className="card p-3"><p className="text-[11px] text-th-secondary uppercase">Brand / Model</p><p className="text-sm font-medium text-th-text">{detail.variant.brandName || "—"} {detail.variant.model}</p></div>
              <div className="card p-3"><p className="text-[11px] text-th-secondary uppercase">Stock</p><p className={`text-sm font-bold ${stockTextClass(detail.variant.stockQuantity, threshold)}`}>{detail.variant.stockQuantity}</p></div>
              <div className="card p-3"><p className="text-[11px] text-th-secondary uppercase">Price</p><p className="text-sm font-bold text-th-text">{formatCurrency(detail.variant.defaultSellingPrice)}</p></div>
              <div className="card p-3"><p className="text-[11px] text-th-secondary uppercase">Category</p><p className="text-sm text-th-text">{detail.variant.category || "—"}</p></div>
              <div className="card p-3"><p className="text-[11px] text-th-secondary uppercase">Color / Size</p><p className="text-sm text-th-text">{detail.variant.color || "—"}{detail.variant.size ? ` / ${detail.variant.size}` : ""}</p></div>
              <div className="card p-3"><p className="text-[11px] text-th-secondary uppercase">Rack</p><p className="text-sm text-th-text">{detail.variant.rackLabel || "—"}</p></div>
              <div className="card p-3"><p className="text-[11px] text-th-secondary uppercase">Supplier</p><p className="text-sm text-th-text">{detail.variant.supplierName || "—"}</p></div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-th-text mb-2">Lots</h4>
              {detail.lots.length === 0 ? (
                <p className="text-sm text-th-muted">No lots</p>
              ) : (
                <div className="overflow-x-auto bg-th-base rounded-[8px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-th-hover bg-th-base">
                        <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Lot</th>
                        <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Qty</th>
                        <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Purchase</th>
                        <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Selling</th>
                        <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Source</th>
                        <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-th-border">
                      {detail.lots.map((l) => (
                        <tr key={l._id}>
                          <td className="px-3 py-2 text-sm font-mono text-th-text">{l.lotNumber}</td>
                          <td className="px-3 py-2 text-sm font-semibold text-th-text">{l.quantity}</td>
                          <td className="px-3 py-2 text-right text-sm text-th-secondary">{formatCurrency(l.purchasePrice)}</td>
                          <td className="px-3 py-2 text-right text-sm text-th-secondary">{formatCurrency(l.sellingPrice)}</td>
                          <td className="px-3 py-2 text-sm text-th-secondary">{l.source}</td>
                          <td className="px-3 py-2 text-sm text-th-secondary">{formatDateTime(l.expiryDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div>
              <h4 className="text-sm font-semibold text-th-text mb-2">Recent Movements</h4>
              {detail.recentMovements.length === 0 ? (
                <p className="text-sm text-th-muted">No movements</p>
              ) : (
                <div className="overflow-x-auto bg-th-base rounded-[8px]">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-th-hover bg-th-base">
                        <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Type</th>
                        <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Qty</th>
                        <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Stock</th>
                        <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">By</th>
                        <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Note</th>
                        <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">When</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-th-border">
                      {detail.recentMovements.map((m) => (
                        <tr key={m._id}>
                          <td className="px-3 py-2 text-sm text-th-text">{MOVEMENT_TYPE_LABELS[m.type] || m.type}</td>
                          <td className={`px-3 py-2 text-right text-sm font-semibold ${m.quantity < 0 ? "text-[#e74c3c]" : "text-[#1ed760]"}`}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</td>
                          <td className="px-3 py-2 text-right text-sm text-th-secondary">{m.beforeQuantity} → {m.afterQuantity}</td>
                          <td className="px-3 py-2 text-sm text-th-text">{m.by || "—"}</td>
                          <td className="px-3 py-2 text-sm text-th-secondary max-w-[220px] truncate">{m.note || "—"}</td>
                          <td className="px-3 py-2 text-sm text-th-secondary">{formatDateTime(m.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Create variant modal */}
      <Modal open={createModal} onClose={() => setCreateModal(false)} title="Add Variant" size="lg">
        <form onSubmit={handleCreateVariant} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">SKU *</label>
              <input className={inputCls} style={inputStyle} value={createForm.sku} onChange={(e) => setCreateForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))} placeholder="e.g. FRM-001-BLK" autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Model *</label>
              <input className={inputCls} style={inputStyle} value={createForm.model} onChange={(e) => setCreateForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g. GOLD-102" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Brand</label>
              <select className={inputCls} style={inputStyle} value={createForm.brandId} onChange={(e) => setCreateForm((f) => ({ ...f, brandId: e.target.value }))}>
                <option value="">— Select —</option>
                {brands.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Brand name (free text)</label>
              <input className={inputCls} style={inputStyle} value={createForm.brandName} onChange={(e) => setCreateForm((f) => ({ ...f, brandName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Category</label>
              <select className={inputCls} style={inputStyle} value={createForm.category} onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}>
                {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Gender</label>
              <select className={inputCls} style={inputStyle} value={createForm.gender} onChange={(e) => setCreateForm((f) => ({ ...f, gender: e.target.value as Gender }))}>
                <option value="">All / Unisex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Color</label>
              <input className={inputCls} style={inputStyle} value={createForm.color} onChange={(e) => setCreateForm((f) => ({ ...f, color: e.target.value }))} placeholder="e.g. Black" />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Size</label>
              <input className={inputCls} style={inputStyle} value={createForm.size} onChange={(e) => setCreateForm((f) => ({ ...f, size: e.target.value }))} placeholder="e.g. 52-18-140" />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Default selling price</label>
              <input className={inputCls} style={inputStyle} type="number" min={0} value={createForm.defaultSellingPrice} onChange={(e) => setCreateForm((f) => ({ ...f, defaultSellingPrice: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Rack</label>
              <select className={inputCls} style={inputStyle} value={createForm.rackId} onChange={(e) => setCreateForm((f) => ({ ...f, rackId: e.target.value }))}>
                <option value="">— Select —</option>
                {racks.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Supplier</label>
              <input className={inputCls} style={inputStyle} value={createForm.supplierName} onChange={(e) => setCreateForm((f) => ({ ...f, supplierName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Material</label>
              <input className={inputCls} style={inputStyle} value={createForm.material} onChange={(e) => setCreateForm((f) => ({ ...f, material: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Frame shape</label>
              <input className={inputCls} style={inputStyle} value={createForm.frameShape} onChange={(e) => setCreateForm((f) => ({ ...f, frameShape: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setCreateModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
            <button type="submit" disabled={createSaving} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
              {createSaving ? "Saving..." : "Create Variant"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add stock modal */}
      <Modal open={!!addStockFor} onClose={() => setAddStockFor(null)} title={`Add Stock — ${addStockFor?.sku || ""}`} size="lg">
        <form onSubmit={handleAddStock} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Quantity *</label>
              <input className={inputCls} style={inputStyle} type="number" min={1} value={addStockForm.quantity} onChange={(e) => setAddStockForm((f) => ({ ...f, quantity: Number(e.target.value) }))} autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Purchase price</label>
              <input className={inputCls} style={inputStyle} type="number" min={0} value={addStockForm.purchasePrice} onChange={(e) => setAddStockForm((f) => ({ ...f, purchasePrice: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Selling price (optional)</label>
              <input className={inputCls} style={inputStyle} type="number" min={0} value={addStockForm.sellingPrice} onChange={(e) => setAddStockForm((f) => ({ ...f, sellingPrice: e.target.value }))} placeholder="Keeps current price" />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Supplier</label>
              <input className={inputCls} style={inputStyle} value={addStockForm.supplierName} onChange={(e) => setAddStockForm((f) => ({ ...f, supplierName: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Rack</label>
              <select className={inputCls} style={inputStyle} value={addStockForm.rackId} onChange={(e) => setAddStockForm((f) => ({ ...f, rackId: e.target.value }))}>
                <option value="">Keep current rack</option>
                {racks.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Batch number</label>
              <input className={inputCls} style={inputStyle} value={addStockForm.batchNumber} onChange={(e) => setAddStockForm((f) => ({ ...f, batchNumber: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Purchase date</label>
              <input className={inputCls} style={inputStyle} type="date" value={addStockForm.purchaseDate} onChange={(e) => setAddStockForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Expiry date</label>
              <input className={inputCls} style={inputStyle} type="date" value={addStockForm.expiryDate} onChange={(e) => setAddStockForm((f) => ({ ...f, expiryDate: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Note</label>
              <input className={inputCls} style={inputStyle} value={addStockForm.note} onChange={(e) => setAddStockForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAddStockFor(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
            <button type="submit" disabled={addSaving} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
              {addSaving ? "Adding..." : "Add Stock"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Adjust modal */}
      <Modal open={!!adjustTarget} onClose={() => setAdjustTarget(null)} title={`Adjust Stock — ${adjustTarget?.sku || ""}`} size="sm">
        <form onSubmit={handleAdjust} className="space-y-4">
          <p className="text-sm text-th-secondary">
            Current stock: <span className="font-bold text-th-text">{adjustTarget?.stockQuantity ?? 0}</span>. Use a negative number to reduce.
          </p>
          <div>
            <label className="block text-sm font-medium text-th-secondary mb-1.5">Adjustment (non-zero) *</label>
            <input className={inputCls} style={inputStyle} type="number" value={adjustForm.quantity} onChange={(e) => setAdjustForm((f) => ({ ...f, quantity: Number(e.target.value) }))} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-th-secondary mb-1.5">Reason</label>
            <input className={inputCls} style={inputStyle} value={adjustForm.note} onChange={(e) => setAdjustForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Damaged frame" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setAdjustTarget(null)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
            <button type="submit" disabled={adjustSaving} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
              {adjustSaving ? "Adjusting..." : "Apply"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove variant?"
        message={`Archive "${deleteTarget?.sku}"? It will no longer appear in variant listings.`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

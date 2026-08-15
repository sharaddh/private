import { useEffect, useState } from "react";
import {
  Search, RefreshCw, PackagePlus, Hand, SlidersHorizontal, Pencil, Trash2, X, Layers, Boxes, Copy, Wand2,
} from "lucide-react";
import Modal from "../Modal";
import ConfirmDialog from "../ConfirmDialog";
import { useToast } from "../../context/ToastContext";
import {
  useV2Brands, useV2Racks, useV2SearchVariants, useV2VariantDetail,
  useAddStock, useAdjustStockV2, useWithdrawStock, useCreateVariantWithStock,
  useUpdateVariant, useDeleteVariant,
} from "../../hooks";
import {
  PRODUCT_CATEGORIES, WITHDRAWAL_REASONS,
  type Gender, type InventoryVariant, type WithdrawalReason,
} from "../../types/inventoryV2";
import { inventoryV2Service } from "../../services";
import {
  Field, AdvancedSection, formatDateTime, formatCurrency,
  stockBadgeClass, stockTextClass, itemLabel, movementLabel, movementTone,
  inputCls, inputStyle,
} from "./shared";

export type StockActionType = "add" | "withdraw" | "adjust" | "new" | "edit";
export interface StockActionState {
  type: StockActionType;
  variant?: InventoryVariant;
}

const EMPTY_ADD = {
  quantity: 1, purchasePrice: 0, sellingPrice: "", supplierName: "", rackId: "",
  batchNumber: "", purchaseDate: "", expiryDate: "", note: "",
};

const EMPTY_NEW = {
  sku: "", brandId: "", brandName: "", category: "Specs", model: "", color: "", size: "",
  gender: "", quantity: 1, purchasePrice: 0, sellingPrice: "", rackId: "", supplierName: "",
  material: "", frameShape: "", frameType: "", templeSize: "", bridgeSize: "", lensWidth: "",
  batchNumber: "", purchaseDate: "", expiryDate: "", note: "",
};

const EMPTY_WITHDRAW = { quantity: "", reason: "Demo" as WithdrawalReason, note: "" };
const EMPTY_ADJUST = { quantity: "", note: "" };
const EMPTY_EDIT = {
  defaultSellingPrice: "", rackId: "", category: "Specs", color: "", size: "", gender: "", supplierName: "",
};

function VariantPicker({ placeholder, onPick }: { placeholder: string; onPick: (v: InventoryVariant) => void }) {
  const [query, setQuery] = useState("");
  const { results, loading } = useV2SearchVariants(query, query.trim().length > 0);
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={`${inputCls} pl-10`}
        style={inputStyle}
        autoFocus
      />
      {query.trim() && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-72 overflow-y-auto rounded-xl border border-th-border bg-th-surface shadow-xl">
          {loading && <p className="px-4 py-3 text-sm text-th-secondary"><RefreshCw size={13} className="inline animate-spin mr-1" /> Searching...</p>}
          {!loading && results.length === 0 && <p className="px-4 py-3 text-sm text-th-muted">No items found</p>}
          {results.map((v) => (
            <button
              key={v._id}
              type="button"
              onClick={() => onPick(v)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-th-hover transition-colors"
            >
              <span className="min-w-0">
                <span className="block font-mono text-sm text-th-text">{v.sku}</span>
                <span className="block text-xs text-th-secondary truncate">{itemLabel(v)}</span>
              </span>
              <span className={`text-xs font-semibold ${stockTextClass(v.stockQuantity)}`}>Stock: {v.stockQuantity}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PickedVariantHeader({ variant, onClear, currentStock }: { variant: InventoryVariant; onClear?: () => void; currentStock?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1ed760]/30 bg-[#1ed760]/5 px-4 py-3">
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-th-text">{variant.sku}</p>
        <p className="text-xs text-th-secondary truncate">{itemLabel(variant)}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs font-semibold ${stockTextClass(variant.stockQuantity)}`}>
          {currentStock ? `Current stock: ${variant.stockQuantity}` : `Stock: ${variant.stockQuantity}`}
        </span>
        {onClear && (
          <button type="button" onClick={onClear} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Clear selection">
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Add stock ───────────────────────────────────────────────────────────────

export function AddStockModal({ open, variant, onClose, onDone }: {
  open: boolean; variant?: InventoryVariant; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const { racks } = useV2Racks();
  const [picked, setPicked] = useState<InventoryVariant | null>(null);
  const [form, setForm] = useState(EMPTY_ADD);
  const [saving, setSaving] = useState(false);
  const { add } = useAddStock();

  useEffect(() => {
    if (open) {
      setPicked(variant ?? null);
      setForm(EMPTY_ADD);
    }
  }, [open, variant]);

  const target = variant ?? picked;

  async function submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!target) { toast.error("Search and select an item first"); return; }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty < 1) { toast.error("Quantity must be at least 1"); return; }
    setSaving(true);
    try {
      const res = await add({
        variantId: target._id,
        quantity: Math.floor(qty),
        purchasePrice: Number(form.purchasePrice) || 0,
        sellingPrice: form.sellingPrice !== "" ? Number(form.sellingPrice) : undefined,
        supplierName: form.supplierName.trim() || undefined,
        rackId: form.rackId || undefined,
        batchNumber: form.batchNumber.trim() || undefined,
        purchaseDate: form.purchaseDate || undefined,
        expiryDate: form.expiryDate || undefined,
        note: form.note.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Added ${qty} to ${target.sku}`);
        onDone();
      } else {
        toast.error(res.message || "Failed to add stock");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to add stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Stock" size="lg">
      <form onSubmit={submit} className="space-y-4">
        {!variant && (
          <div className="space-y-3">
            {picked
              ? <PickedVariantHeader variant={picked} onClear={() => setPicked(null)} />
              : <VariantPicker placeholder="Search item by SKU, brand, model..." onPick={setPicked} />}
          </div>
        )}
        {target && (
          <div className="space-y-4">
            {variant && <PickedVariantHeader variant={variant} currentStock />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Quantity" required>
                <input className={inputCls} style={inputStyle} type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </Field>
              <Field label="Purchase price">
                <input className={inputCls} style={inputStyle} type="number" min={0} value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: Number(e.target.value) }))} placeholder="0" />
              </Field>
              <Field label="Selling price (optional)">
                <input className={inputCls} style={inputStyle} type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} placeholder="Keeps current price" />
              </Field>
              <Field label="Supplier">
                <input className={inputCls} style={inputStyle} value={form.supplierName} onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))} />
              </Field>
              <Field label="Rack">
                <select className={inputCls} style={inputStyle} value={form.rackId} onChange={(e) => setForm((f) => ({ ...f, rackId: e.target.value }))}>
                  <option value="">Keep current rack</option>
                  {racks.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
                </select>
              </Field>
            </div>
            <AdvancedSection title="More details (batch, dates, note)">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 pt-4">
                <Field label="Batch number">
                  <input className={inputCls} style={inputStyle} value={form.batchNumber} onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))} />
                </Field>
                <Field label="Purchase date">
                  <input className={inputCls} style={inputStyle} type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
                </Field>
                <Field label="Expiry date">
                  <input className={inputCls} style={inputStyle} type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Note">
                    <input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
                  </Field>
                </div>
              </div>
            </AdvancedSection>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
                <PackagePlus size={15} /> {saving ? "Adding..." : "Add Stock"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ─── Withdraw ────────────────────────────────────────────────────────────────

export function WithdrawModal({ open, variant, onClose, onDone }: {
  open: boolean; variant?: InventoryVariant; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<InventoryVariant | null>(null);
  const [form, setForm] = useState(EMPTY_WITHDRAW);
  const [saving, setSaving] = useState(false);
  const { withdraw } = useWithdrawStock();

  useEffect(() => {
    if (open) {
      setPicked(variant ?? null);
      setForm({ ...EMPTY_WITHDRAW, quantity: variant ? String(variant.stockQuantity) : "" });
    }
  }, [open, variant]);

  const target = variant ?? picked;

  async function submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!target) { toast.error("Search and select an item first"); return; }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty < 1) { toast.error("Quantity must be at least 1"); return; }
    if (qty > target.stockQuantity) { toast.error(`Only ${target.stockQuantity} in stock`); return; }
    setSaving(true);
    try {
      const res = await withdraw({
        items: [{ variantId: target._id, quantity: Math.floor(qty) }],
        reason: form.reason,
        note: form.note.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Withdrew ${qty} × ${target.sku}`);
        onDone();
      } else {
        toast.error(res.message || "Withdrawal failed");
      }
    } catch (err) {
      toast.error((err as Error).message || "Withdrawal failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Withdraw Stock" size="md">
      <form onSubmit={submit} className="space-y-4">
        {!variant && (
          picked
            ? <PickedVariantHeader variant={picked} onClear={() => setPicked(null)} />
            : <VariantPicker placeholder="Search item to withdraw..." onPick={setPicked} />
        )}
        {target && (
          <div className="space-y-4">
            {variant && <PickedVariantHeader variant={variant} currentStock />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
              <Field label="Quantity" required>
                <input className={inputCls} style={inputStyle} type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              </Field>
              <Field label="Reason" required>
                <select className={inputCls} style={inputStyle} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value as WithdrawalReason }))}>
                  {WITHDRAWAL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <div className="md:col-span-2">
                <Field label="Note">
                  <input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional" />
                </Field>
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
                <Hand size={15} /> {saving ? "Withdrawing..." : "Withdraw"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ─── Adjust ──────────────────────────────────────────────────────────────────

export function AdjustModal({ open, variant, onClose, onDone }: {
  open: boolean; variant?: InventoryVariant; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [picked, setPicked] = useState<InventoryVariant | null>(null);
  const [form, setForm] = useState(EMPTY_ADJUST);
  const [saving, setSaving] = useState(false);
  const { adjust } = useAdjustStockV2();

  useEffect(() => {
    if (open) { setPicked(variant ?? null); setForm(EMPTY_ADJUST); }
  }, [open, variant]);

  const target = variant ?? picked;

  async function submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!target) { toast.error("Search and select an item first"); return; }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty === 0) { toast.error("Adjustment must be a non-zero number"); return; }
    setSaving(true);
    try {
      const res = await adjust(target._id, { quantity: Math.floor(qty), note: form.note.trim() || "Manual adjustment" });
      if (res.success) {
        toast.success("Stock adjusted");
        onDone();
      } else {
        toast.error(res.message || "Failed to adjust stock");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Adjust Stock" size="sm">
      <form onSubmit={submit} className="space-y-4">
        {!variant && (
          picked
            ? <PickedVariantHeader variant={picked} onClear={() => setPicked(null)} />
            : <VariantPicker placeholder="Search item to adjust..." onPick={setPicked} />
        )}
        {target && (
          <div className="space-y-4">
            {variant && <PickedVariantHeader variant={variant} currentStock />}
            <p className="text-sm text-th-secondary">
              Enter a <span className="font-semibold text-[#1ed760]">positive</span> number to add stock, or a <span className="font-semibold text-[#e74c3c]">negative</span> number to remove.
            </p>
            <Field label="Adjustment (non-zero)" required>
              <input className={inputCls} style={inputStyle} type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="e.g. 5 or -2" />
            </Field>
            <Field label="Reason">
              <input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="e.g. Damaged frame" />
            </Field>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
                <SlidersHorizontal size={15} /> {saving ? "Applying..." : "Apply"}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

// ─── New item ────────────────────────────────────────────────────────────────

export function NewItemModal({ open, variant, onClose, onDone }: {
  open: boolean;
  variant?: InventoryVariant;
  onClose: () => void;
  onDone: (existing?: InventoryVariant) => void;
}) {
  const toast = useToast();
  const { brands } = useV2Brands(5);
  const { racks } = useV2Racks();
  const [form, setForm] = useState(EMPTY_NEW);
  const [saving, setSaving] = useState(false);
  const { create } = useCreateVariantWithStock();

  const selectedBrandName = brands.find((b) => b._id === form.brandId)?.name ?? form.brandName;

  useEffect(() => {
    if (!open) return;
    setForm(variant
      ? {
          ...EMPTY_NEW,
          brandId: variant.brandId || "",
          brandName: variant.brandName || "",
          category: variant.category || "Specs",
          model: variant.model || "",
          color: variant.color || "",
          size: variant.size || "",
          gender: variant.gender || "",
          material: variant.material || "",
          frameShape: variant.frameShape || "",
          frameType: variant.frameType || "",
          templeSize: variant.templeSize || "",
          bridgeSize: variant.bridgeSize || "",
          lensWidth: variant.lensWidth || "",
          sellingPrice: variant.defaultSellingPrice ? String(variant.defaultSellingPrice) : "",
          rackId: variant.rackId || "",
          supplierName: variant.supplierName || "",
        }
      : EMPTY_NEW);
  }, [open, variant]);

  function suggestSku(): string {
    const parts = [
      selectedBrandName,
      form.model,
      form.color,
    ].filter((p) => p && p.trim());
    const base = parts.map((p) => p.replace(/[^A-Za-z0-9]+/g, "").toUpperCase()).join("-");
    return base.replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!form.sku.trim()) { toast.error("SKU is required"); return; }
    if (!form.model.trim()) { toast.error("Model is required"); return; }
    const qty = Number(form.quantity);
    if (!Number.isFinite(qty) || qty < 1) { toast.error("Quantity must be at least 1"); return; }
    setSaving(true);
    try {
      const res = await create({
        sku: form.sku.trim(),
        brandId: form.brandId || undefined,
        brand: selectedBrandName || undefined,
        category: form.category || undefined,
        model: form.model.trim(),
        gender: form.gender || undefined,
        color: form.color.trim() || undefined,
        size: form.size.trim() || undefined,
        quantity: Math.floor(qty),
        purchasePrice: Number(form.purchasePrice) || 0,
        sellingPrice: form.sellingPrice !== "" ? Number(form.sellingPrice) : undefined,
        rackId: form.rackId || undefined,
        supplierName: form.supplierName.trim() || undefined,
        material: form.material.trim() || undefined,
        frameShape: form.frameShape.trim() || undefined,
        frameType: form.frameType.trim() || undefined,
        templeSize: form.templeSize.trim() || undefined,
        bridgeSize: form.bridgeSize.trim() || undefined,
        lensWidth: form.lensWidth.trim() || undefined,
        batchNumber: form.batchNumber.trim() || undefined,
        purchaseDate: form.purchaseDate || undefined,
        expiryDate: form.expiryDate || undefined,
        note: form.note.trim() || undefined,
      });
      if (res.success) {
        toast.success(`${form.sku} created with ${qty} in stock`);
        onDone();
        return;
      }
      const msg = res.message || "Failed to create item";
      if (/exists|already/i.test(msg)) {
        try {
          const existingRes = await inventoryV2Service.getVariantBySku(form.sku.trim());
          if (existingRes.success && existingRes.data) {
            toast.success(`${form.sku} already exists — adding stock instead`);
            onDone(existingRes.data);
            return;
          }
        } catch { /* fall through to generic error */ }
      }
      toast.error(msg);
    } catch (err) {
      toast.error((err as Error).message || "Failed to create item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={variant ? `Duplicate — ${variant.sku}` : "Add New Item"} size="lg">
      {variant && (
        <p className="text-sm text-th-secondary -mt-2 mb-4">
          Pre-filled from <span className="font-mono text-th-text">{variant.sku}</span>. Change the SKU / colour / size to add a new variation.
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="SKU" required>
            <div className="flex gap-1.5">
              <input className={inputCls} style={inputStyle} value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))} placeholder="e.g. FRM-002-BLK" autoFocus />
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, sku: suggestSku() }))}
                className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-th-border px-3 text-xs font-semibold text-th-secondary hover:bg-th-hover"
                title="Generate SKU from brand + model + colour"
                aria-label="Generate SKU"
              >
                <Wand2 size={13} /> Auto
              </button>
            </div>
          </Field>
          <Field label="Model" required>
            <input className={inputCls} style={inputStyle} value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g. GOLD-202" />
          </Field>
          <Field label="Brand">
            <div className="flex gap-1.5">
              <input
                className={inputCls} style={inputStyle}
                list="inventory-brand-options"
                value={selectedBrandName}
                onChange={(e) => {
                  const name = e.target.value;
                  const match = brands.find((b) => b.name.toLowerCase() === name.toLowerCase());
                  setForm((f) => ({ ...f, brandName: name, brandId: match?._id ?? "" }));
                }}
                placeholder="Type or pick a brand"
              />
              <datalist id="inventory-brand-options">
                {brands.map((b) => <option key={b._id} value={b.name} />)}
              </datalist>
            </div>
          </Field>
          <Field label="Category">
            <select className={inputCls} style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Colour">
            <input className={inputCls} style={inputStyle} value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} placeholder="e.g. Black" />
          </Field>
          <Field label="Size">
            <input className={inputCls} style={inputStyle} value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} placeholder="e.g. 52-18-140" />
          </Field>
          <Field label="Quantity" required>
            <input className={inputCls} style={inputStyle} type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
          </Field>
          <Field label="Purchase price">
            <input className={inputCls} style={inputStyle} type="number" min={0} value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: Number(e.target.value) }))} placeholder="0" />
          </Field>
          <Field label="Selling price">
            <input className={inputCls} style={inputStyle} type="number" min={0} value={form.sellingPrice} onChange={(e) => setForm((f) => ({ ...f, sellingPrice: e.target.value }))} placeholder="0" />
          </Field>
          <Field label="Rack">
            <select className={inputCls} style={inputStyle} value={form.rackId} onChange={(e) => setForm((f) => ({ ...f, rackId: e.target.value }))}>
              <option value="">— Select —</option>
              {racks.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
            </select>
          </Field>
        </div>
        <AdvancedSection title="More details (gender, supplier, frame specs, batch...)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4 pt-4">
            <Field label="Gender">
              <select className={inputCls} style={inputStyle} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
                <option value="">All / Unisex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unisex">Unisex</option>
              </select>
            </Field>
            <Field label="Supplier">
              <input className={inputCls} style={inputStyle} value={form.supplierName} onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))} />
            </Field>
            <Field label="Material">
              <input className={inputCls} style={inputStyle} value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value }))} placeholder="e.g. Acetate" />
            </Field>
            <Field label="Frame shape">
              <input className={inputCls} style={inputStyle} value={form.frameShape} onChange={(e) => setForm((f) => ({ ...f, frameShape: e.target.value }))} placeholder="e.g. Square" />
            </Field>
            <Field label="Frame type">
              <input className={inputCls} style={inputStyle} value={form.frameType} onChange={(e) => setForm((f) => ({ ...f, frameType: e.target.value }))} placeholder="e.g. Full rim" />
            </Field>
            <Field label="Temple size">
              <input className={inputCls} style={inputStyle} value={form.templeSize} onChange={(e) => setForm((f) => ({ ...f, templeSize: e.target.value }))} placeholder="e.g. 140" />
            </Field>
            <Field label="Bridge size">
              <input className={inputCls} style={inputStyle} value={form.bridgeSize} onChange={(e) => setForm((f) => ({ ...f, bridgeSize: e.target.value }))} placeholder="e.g. 18" />
            </Field>
            <Field label="Lens width">
              <input className={inputCls} style={inputStyle} value={form.lensWidth} onChange={(e) => setForm((f) => ({ ...f, lensWidth: e.target.value }))} placeholder="e.g. 52" />
            </Field>
            <Field label="Batch number">
              <input className={inputCls} style={inputStyle} value={form.batchNumber} onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))} />
            </Field>
            <Field label="Purchase date">
              <input className={inputCls} style={inputStyle} type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
            </Field>
            <Field label="Expiry date">
              <input className={inputCls} style={inputStyle} type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Note">
                <input className={inputCls} style={inputStyle} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              </Field>
            </div>
          </div>
        </AdvancedSection>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
            <Boxes size={15} /> {saving ? "Creating..." : variant ? "Create Variation" : "Create Item"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit ────────────────────────────────────────────────────────────────────

export function EditVariantModal({ open, variant, onClose, onDone }: {
  open: boolean; variant?: InventoryVariant; onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const { racks } = useV2Racks();
  const [form, setForm] = useState(EMPTY_EDIT);
  const [saving, setSaving] = useState(false);
  const { update } = useUpdateVariant();

  useEffect(() => {
    if (open && variant) {
      setForm({
        defaultSellingPrice: variant.defaultSellingPrice ? String(variant.defaultSellingPrice) : "",
        rackId: variant.rackId || "",
        category: variant.category || "Specs",
        color: variant.color || "",
        size: variant.size || "",
        gender: variant.gender || "",
        supplierName: variant.supplierName || "",
      });
    }
  }, [open, variant]);

  async function submit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!variant) return;
    setSaving(true);
    try {
      const res = await update(variant._id, {
        defaultSellingPrice: form.defaultSellingPrice !== "" ? Number(form.defaultSellingPrice) : undefined,
        rackId: form.rackId || null,
        color: form.color.trim() || undefined,
        size: form.size.trim() || undefined,
        gender: (form.gender || undefined) as Gender | undefined,
        supplierName: form.supplierName.trim() || undefined,
      });
      if (res.success) {
        toast.success("Item updated");
        onDone();
      } else {
        toast.error(res.message || "Failed to update item");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to update item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit — ${variant?.sku || ""}`} size="md">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
          <Field label="Selling price">
            <input className={inputCls} style={inputStyle} type="number" min={0} value={form.defaultSellingPrice} onChange={(e) => setForm((f) => ({ ...f, defaultSellingPrice: e.target.value }))} />
          </Field>
          <Field label="Rack">
            <select className={inputCls} style={inputStyle} value={form.rackId} onChange={(e) => setForm((f) => ({ ...f, rackId: e.target.value }))}>
              <option value="">— None —</option>
              {racks.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
            </select>
          </Field>
          <Field label="Category">
            <select className={inputCls} style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
              {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Colour">
            <input className={inputCls} style={inputStyle} value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
          </Field>
          <Field label="Size">
            <input className={inputCls} style={inputStyle} value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} />
          </Field>
          <Field label="Gender">
            <select className={inputCls} style={inputStyle} value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}>
              <option value="">All / Unisex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Unisex">Unisex</option>
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Supplier">
              <input className={inputCls} style={inputStyle} value={form.supplierName} onChange={(e) => setForm((f) => ({ ...f, supplierName: e.target.value }))} />
            </Field>
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
          <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
            <Pencil size={15} /> {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Detail panel (slide-over) ───────────────────────────────────────────────

export function VariantDetailPanel({
  variant, onClose, onAction, onDone,
}: {
  variant: InventoryVariant;
  onClose: () => void;
  onAction: (action: StockActionState) => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { detail, loading, refetch } = useV2VariantDetail(variant._id);
  const { remove } = useDeleteVariant();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete(): Promise<void> {
    setDeleting(true);
    try {
      const res = await remove(variant._id);
      if (res.success) {
        toast.success("Item removed");
        setConfirmRemove(false);
        onClose();
        onDone();
      } else {
        toast.error(res.message || "Failed to remove item");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to remove item");
    } finally {
      setDeleting(false);
    }
  }

  const actions: Array<{ label: string; icon: typeof PackagePlus; tone: string; run: () => void }> = [
    { label: "Add stock", icon: PackagePlus, tone: "text-[#1ed760] hover:bg-[#1ed760]/10", run: () => onAction({ type: "add", variant }) },
    { label: "Withdraw", icon: Hand, tone: "text-th-secondary hover:bg-th-hover", run: () => onAction({ type: "withdraw", variant }) },
    { label: "Adjust", icon: SlidersHorizontal, tone: "text-th-secondary hover:bg-th-hover", run: () => onAction({ type: "adjust", variant }) },
    { label: "Duplicate", icon: Copy, tone: "text-th-secondary hover:bg-th-hover", run: () => onAction({ type: "new", variant }) },
    { label: "Edit", icon: Pencil, tone: "text-th-secondary hover:bg-th-hover", run: () => onAction({ type: "edit", variant }) },
    { label: "Remove", icon: Trash2, tone: "text-[#e74c3c] hover:bg-[#e74c3c]/10", run: () => setConfirmRemove(true) },
  ];

  return (
    <div className="fixed inset-0 z-[90] flex justify-end">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative h-full w-full max-w-xl bg-th-surface border-l border-th-border shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-th-hover">
          <div className="min-w-0">
            <p className="font-mono text-sm text-[#1ed760] font-semibold">{variant.sku}</p>
            <h3 className="text-lg font-semibold text-th-text truncate">{itemLabel(variant)}</h3>
            <p className="text-xs text-th-secondary">{variant.category}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="card p-3">
              <p className="text-[11px] text-th-secondary uppercase">Stock</p>
              <p className={`text-xl font-bold ${stockTextClass(variant.stockQuantity)}`}>{variant.stockQuantity}</p>
              <span className={stockBadgeClass(variant.stockQuantity)}>{variant.stockQuantity <= 0 ? "Out" : variant.stockQuantity <= 5 ? "Low" : "In stock"}</span>
            </div>
            <div className="card p-3">
              <p className="text-[11px] text-th-secondary uppercase">Selling price</p>
              <p className="text-xl font-bold text-th-text">{formatCurrency(variant.defaultSellingPrice)}</p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] text-th-secondary uppercase">Rack</p>
              <p className="text-xl font-bold text-th-text">{variant.rackLabel || "—"}</p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] text-th-secondary uppercase">Supplier</p>
              <p className="text-sm font-semibold text-th-text truncate">{variant.supplierName || "—"}</p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] text-th-secondary uppercase">Colour / Size</p>
              <p className="text-sm font-semibold text-th-text">{variant.color || "—"}{variant.size ? ` / ${variant.size}` : ""}</p>
            </div>
            <div className="card p-3">
              <p className="text-[11px] text-th-secondary uppercase">Gender</p>
              <p className="text-sm font-semibold text-th-text">{variant.gender || "—"}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button key={a.label} type="button" onClick={a.run}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${a.tone}`}>
                  <Icon size={15} /> {a.label}
                </button>
              );
            })}
          </div>

          {/* Lots */}
          <div>
            <h4 className="text-sm font-semibold text-th-text mb-2">Purchase lots</h4>
            {loading ? (
              <p className="text-sm text-th-secondary"><RefreshCw size={13} className="inline animate-spin mr-1" /> Loading...</p>
            ) : !detail || detail.lots.length === 0 ? (
              <p className="text-sm text-th-muted">No lots</p>
            ) : (
              <div className="overflow-x-auto bg-th-base rounded-[8px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-th-hover bg-th-base">
                      <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Lot</th>
                      <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Qty</th>
                      <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Cost</th>
                      <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Expiry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-th-border">
                    {detail.lots.map((l) => (
                      <tr key={l._id}>
                        <td className="px-3 py-2 text-sm font-mono text-th-text">{l.lotNumber}</td>
                        <td className="px-3 py-2 text-right text-sm font-semibold text-th-text">{l.quantity}</td>
                        <td className="px-3 py-2 text-right text-sm text-th-secondary">{formatCurrency(l.purchasePrice)}</td>
                        <td className="px-3 py-2 text-sm text-th-secondary">{formatDateTime(l.expiryDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Movements */}
          <div>
            <h4 className="text-sm font-semibold text-th-text mb-2">Recent activity</h4>
            {loading ? (
              <p className="text-sm text-th-secondary"><RefreshCw size={13} className="inline animate-spin mr-1" /> Loading...</p>
            ) : !detail || detail.recentMovements.length === 0 ? (
              <p className="text-sm text-th-muted">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {detail.recentMovements.map((m) => (
                  <div key={m._id} className="flex items-center gap-3 rounded-[8px] border border-th-border bg-th-base px-3 py-2.5">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap ${movementTone(m.type)}`}>
                      {movementLabel(m.type)}
                    </span>
                    <span className={`text-sm font-semibold ${m.quantity < 0 ? "text-[#e74c3c]" : "text-[#1ed760]"}`}>
                      {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                    </span>
                    <span className="ml-auto text-xs text-th-secondary whitespace-nowrap">{formatDateTime(m.createdAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button type="button" onClick={() => void refetch()}
          className="mx-5 mb-4 inline-flex items-center justify-center gap-2 rounded-lg border border-th-border px-3 py-2 text-sm text-th-secondary hover:bg-th-hover">
          <RefreshCw size={14} /> Refresh details
        </button>
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove item?"
        message={`Remove "${variant.sku}"? It will no longer appear in stock listings.`}
        confirmLabel={deleting ? "Removing..." : "Remove"}
        danger
        onConfirm={() => void confirmDelete()}
        onCancel={() => setConfirmRemove(false)}
      />
    </div>
  );
}

export function StockEmpty({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-th-muted">
      <Layers size={44} className="mb-3 opacity-30" />
      <p className="text-sm">No items found</p>
      <button type="button" onClick={onNew} className="mt-4 btn-primary flex items-center gap-2">
        <Boxes size={15} /> Add your first item
      </button>
    </div>
  );
}

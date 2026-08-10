import { useMemo, useState } from "react";
import { Plus, Trash2, Search, RefreshCw, PackagePlus, Boxes, Hand, type LucideIcon } from "lucide-react";
import {
  useAddStock, useCreateVariantWithStock, useWithdrawStock,
  useV2SearchVariants, useV2Racks, useV2Brands,
} from "../../hooks";
import { WITHDRAWAL_REASONS, PRODUCT_CATEGORIES, type InventoryVariant, type WithdrawalReason } from "../../types/inventoryV2";
import { useToast } from "../../context/ToastContext";

const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover";
const inputStyle = { border: "1px solid rgb(124,124,124)" } as const;

function SectionCard({ title, icon: Icon, children }: { title: string; icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="bg-th-surface rounded-[8px] p-5 md:p-6 shadow-sm border border-th-border">
      <h3 className="text-base font-semibold text-th-text flex items-center gap-2 mb-4">
        <Icon size={18} className="text-[#1ed760]" /> {title}
      </h3>
      {children}
    </div>
  );
}

export default function StockTab() {
  const toast = useToast();
  const { racks } = useV2Racks();
  const { brands } = useV2Brands(5);

  const [sub, setSub] = useState<"add" | "new" | "withdraw">("add");

  // Add stock to existing variant
  const [query, setQuery] = useState("");
  const { results: searchResults, loading: searching } = useV2SearchVariants(query, query.trim().length > 0);
  const [selected, setSelected] = useState<InventoryVariant | null>(null);
  const [addForm, setAddForm] = useState({
    quantity: 1, purchasePrice: 0, sellingPrice: "", supplierName: "", rackId: "",
    batchNumber: "", purchaseDate: "", expiryDate: "", note: "",
  });
  const [addSaving, setAddSaving] = useState(false);
  const { add } = useAddStock();

  // New variant with stock
  const [newForm, setNewForm] = useState({
    sku: "", brandId: "", brandName: "", category: "Specs", model: "", color: "", size: "",
    gender: "", quantity: 1, purchasePrice: 0, sellingPrice: "", rackId: "", supplierName: "",
    material: "", frameShape: "", batchNumber: "", purchaseDate: "", expiryDate: "", note: "",
  });
  const [newSaving, setNewSaving] = useState(false);
  const { create: createWithStock } = useCreateVariantWithStock();

  // Withdraw
  const [withdrawQuery, setWithdrawQuery] = useState("");
  const { results: withdrawResults, loading: withdrawingSearch } = useV2SearchVariants(withdrawQuery, withdrawQuery.trim().length > 0);
  const [items, setItems] = useState<Array<{ variantId: string; sku: string; label: string; quantity: number }>>([]);
  const [reason, setReason] = useState<WithdrawalReason>("Demo");
  const [note, setNote] = useState("");
  const [withdrawSaving, setWithdrawSaving] = useState(false);
  const { withdraw } = useWithdrawStock();

  const rackOptions = useMemo(() => racks, [racks]);
  const brandOptions = useMemo(() => brands.map((b) => ({ _id: b._id, name: b.name })), [brands]);

  function pickVariant(v: InventoryVariant): void {
    setSelected(v);
    setQuery("");
  }

  function pickWithdrawItem(v: InventoryVariant): void {
    setItems((prev) => {
      const existing = prev.find((i) => i.variantId === v._id);
      if (existing) {
        return prev.map((i) => (i.variantId === v._id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...prev, { variantId: v._id, sku: v.sku, label: `${v.brandName || ""} ${v.model || ""} ${v.color || ""}`.trim(), quantity: 1 }];
    });
    setWithdrawQuery("");
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!selected) { toast.error("Search and select a variant first"); return; }
    const qty = Number(addForm.quantity);
    if (!Number.isFinite(qty) || qty < 1) { toast.error("Quantity must be at least 1"); return; }
    setAddSaving(true);
    try {
      const res = await add({
        variantId: selected._id,
        quantity: Math.floor(qty),
        purchasePrice: Number(addForm.purchasePrice) || 0,
        sellingPrice: addForm.sellingPrice !== "" ? Number(addForm.sellingPrice) : undefined,
        supplierName: addForm.supplierName.trim() || undefined,
        rackId: addForm.rackId || undefined,
        batchNumber: addForm.batchNumber.trim() || undefined,
        purchaseDate: addForm.purchaseDate || undefined,
        expiryDate: addForm.expiryDate || undefined,
        note: addForm.note.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Added ${qty} to ${selected.sku}`);
        setSelected(null);
        setAddForm((f) => ({ ...f, quantity: 1, purchasePrice: 0, sellingPrice: "", note: "", batchNumber: "", purchaseDate: "", expiryDate: "" }));
      } else {
        toast.error(res.message || "Failed to add stock");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to add stock");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleNewVariant(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!newForm.sku.trim()) { toast.error("SKU is required"); return; }
    if (!newForm.model.trim()) { toast.error("Model is required"); return; }
    const qty = Number(newForm.quantity);
    if (!Number.isFinite(qty) || qty < 1) { toast.error("Quantity must be at least 1"); return; }
    setNewSaving(true);
    try {
      const selectedBrand = brandOptions.find((b) => b._id === newForm.brandId);
      const res = await createWithStock({
        sku: newForm.sku.trim(),
        brandId: newForm.brandId || undefined,
        brand: newForm.brandName.trim() || selectedBrand?.name || undefined,
        category: newForm.category || undefined,
        model: newForm.model.trim(),
        gender: newForm.gender || undefined,
        color: newForm.color.trim() || undefined,
        size: newForm.size.trim() || undefined,
        quantity: Math.floor(qty),
        purchasePrice: Number(newForm.purchasePrice) || 0,
        sellingPrice: newForm.sellingPrice !== "" ? Number(newForm.sellingPrice) : undefined,
        rackId: newForm.rackId || undefined,
        supplierName: newForm.supplierName.trim() || undefined,
        material: newForm.material.trim() || undefined,
        frameShape: newForm.frameShape.trim() || undefined,
        batchNumber: newForm.batchNumber.trim() || undefined,
        purchaseDate: newForm.purchaseDate || undefined,
        expiryDate: newForm.expiryDate || undefined,
        note: newForm.note.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Variant ${newForm.sku} created with ${qty} in stock`);
        setNewForm((f) => ({ ...f, sku: "", model: "", color: "", size: "", quantity: 1, purchasePrice: 0, sellingPrice: "", batchNumber: "", purchaseDate: "", expiryDate: "", note: "" }));
      } else {
        toast.error(res.message || "Failed to create variant");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to create variant");
    } finally {
      setNewSaving(false);
    }
  }

  async function handleWithdraw(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    const bad = items.find((i) => !Number.isFinite(i.quantity) || i.quantity < 1);
    if (bad) { toast.error(`Invalid quantity for ${bad.sku}`); return; }
    setWithdrawSaving(true);
    try {
      const res = await withdraw({
        items: items.map((i) => ({ variantId: i.variantId, quantity: Math.floor(i.quantity) })),
        reason,
        note: note.trim() || undefined,
      });
      if (res.success) {
        toast.success(`Withdrawal of ${res.data?.withdrawal.totalQty ?? 0} units recorded`);
        setItems([]);
        setNote("");
      } else {
        toast.error(res.message || "Withdrawal failed");
      }
    } catch (err) {
      toast.error((err as Error).message || "Withdrawal failed");
    } finally {
      setWithdrawSaving(false);
    }
  }

  const subTabs = [
    { key: "add", label: "Add Stock", icon: PackagePlus },
    { key: "new", label: "New Variant + Stock", icon: Boxes },
    { key: "withdraw", label: "Withdraw", icon: Hand },
  ] as const;  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-th-elevated rounded-pill p-1 w-fit">
        {subTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setSub(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-pill text-small-bold transition-all active:scale-95 ${
                sub === t.key ? "bg-primary-500 text-surface-950 shadow-sm" : "text-th-secondary hover:text-th-text"
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {sub === "add" && (
        <SectionCard title="Add Stock to Existing Variant" icon={PackagePlus}>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
              <input
                type="text"
                placeholder="Search variant by SKU, brand, model, color..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={`${inputCls} pl-10`}
                style={inputStyle}
                aria-label="Search variant"
              />
              {query.trim() && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-th-border bg-th-surface shadow-xl">
                  {searching && <p className="px-4 py-3 text-sm text-th-secondary"><RefreshCw size={13} className="inline animate-spin mr-1" /> Searching...</p>}
                  {!searching && searchResults.length === 0 && <p className="px-4 py-3 text-sm text-th-muted">No variants found</p>}
                  {searchResults.map((v) => (
                    <button
                      key={v._id}
                      type="button"
                      onClick={() => pickVariant(v)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-th-hover transition-colors"
                    >
                      <span className="font-mono text-sm text-th-text">{v.sku}</span>
                      <span className="text-xs text-th-secondary truncate max-w-[60%]">{v.brandName} {v.model} {v.color}</span>
                      <span className="text-xs font-semibold text-[#1ed760]">Stock: {v.stockQuantity}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {selected && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-[#1ed760]/30 bg-[#1ed760]/5 px-4 py-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-th-text">{selected.sku}</p>
                  <p className="text-xs text-th-secondary">{selected.brandName} {selected.model} {selected.color}{selected.size ? ` / ${selected.size}` : ""} · Current stock: {selected.stockQuantity}</p>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary" aria-label="Clear selection">
                  <Trash2 size={15} />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Quantity *</label>
                <input className={inputCls} style={inputStyle} type="number" min={1} value={addForm.quantity} onChange={(e) => setAddForm((f) => ({ ...f, quantity: Number(e.target.value) }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Purchase price</label>
                <input className={inputCls} style={inputStyle} type="number" min={0} value={addForm.purchasePrice} onChange={(e) => setAddForm((f) => ({ ...f, purchasePrice: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Selling price (optional)</label>
                <input className={inputCls} style={inputStyle} type="number" min={0} value={addForm.sellingPrice} onChange={(e) => setAddForm((f) => ({ ...f, sellingPrice: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Supplier</label>
                <input className={inputCls} style={inputStyle} value={addForm.supplierName} onChange={(e) => setAddForm((f) => ({ ...f, supplierName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Rack</label>
                <select className={inputCls} style={inputStyle} value={addForm.rackId} onChange={(e) => setAddForm((f) => ({ ...f, rackId: e.target.value }))}>
                  <option value="">Keep current rack</option>
                  {rackOptions.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Batch number</label>
                <input className={inputCls} style={inputStyle} value={addForm.batchNumber} onChange={(e) => setAddForm((f) => ({ ...f, batchNumber: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Purchase date</label>
                <input className={inputCls} style={inputStyle} type="date" value={addForm.purchaseDate} onChange={(e) => setAddForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Expiry date</label>
                <input className={inputCls} style={inputStyle} type="date" value={addForm.expiryDate} onChange={(e) => setAddForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Note</label>
                <input className={inputCls} style={inputStyle} value={addForm.note} onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <button type="submit" disabled={addSaving || !selected} className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus size={16} /> {addSaving ? "Adding..." : "Add Stock"}
            </button>
          </form>
        </SectionCard>
      )}

      {sub === "new" && (
        <SectionCard title="Create Variant with Initial Stock" icon={Boxes}>
          <form onSubmit={handleNewVariant} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">SKU *</label>
                <input className={inputCls} style={inputStyle} value={newForm.sku} onChange={(e) => setNewForm((f) => ({ ...f, sku: e.target.value.toUpperCase() }))} placeholder="e.g. FRM-002-BLK" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Model *</label>
                <input className={inputCls} style={inputStyle} value={newForm.model} onChange={(e) => setNewForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g. GOLD-202" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Brand</label>
                <select className={inputCls} style={inputStyle} value={newForm.brandId} onChange={(e) => setNewForm((f) => ({ ...f, brandId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {brandOptions.map((b) => <option key={b._id} value={b._id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Brand name (free text)</label>
                <input className={inputCls} style={inputStyle} value={newForm.brandName} onChange={(e) => setNewForm((f) => ({ ...f, brandName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Category</label>
                <select className={inputCls} style={inputStyle} value={newForm.category} onChange={(e) => setNewForm((f) => ({ ...f, category: e.target.value }))}>
                  {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Gender</label>
                <select className={inputCls} style={inputStyle} value={newForm.gender} onChange={(e) => setNewForm((f) => ({ ...f, gender: e.target.value }))}>
                  <option value="">All / Unisex</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Unisex">Unisex</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Color</label>
                <input className={inputCls} style={inputStyle} value={newForm.color} onChange={(e) => setNewForm((f) => ({ ...f, color: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Size</label>
                <input className={inputCls} style={inputStyle} value={newForm.size} onChange={(e) => setNewForm((f) => ({ ...f, size: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Quantity *</label>
                <input className={inputCls} style={inputStyle} type="number" min={1} value={newForm.quantity} onChange={(e) => setNewForm((f) => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Purchase price</label>
                <input className={inputCls} style={inputStyle} type="number" min={0} value={newForm.purchasePrice} onChange={(e) => setNewForm((f) => ({ ...f, purchasePrice: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Selling price</label>
                <input className={inputCls} style={inputStyle} type="number" min={0} value={newForm.sellingPrice} onChange={(e) => setNewForm((f) => ({ ...f, sellingPrice: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Rack</label>
                <select className={inputCls} style={inputStyle} value={newForm.rackId} onChange={(e) => setNewForm((f) => ({ ...f, rackId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {rackOptions.map((r) => <option key={r._id} value={r._id}>{r.code}{r.section ? ` · ${r.section}` : ""}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Supplier</label>
                <input className={inputCls} style={inputStyle} value={newForm.supplierName} onChange={(e) => setNewForm((f) => ({ ...f, supplierName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Material</label>
                <input className={inputCls} style={inputStyle} value={newForm.material} onChange={(e) => setNewForm((f) => ({ ...f, material: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Frame shape</label>
                <input className={inputCls} style={inputStyle} value={newForm.frameShape} onChange={(e) => setNewForm((f) => ({ ...f, frameShape: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Batch number</label>
                <input className={inputCls} style={inputStyle} value={newForm.batchNumber} onChange={(e) => setNewForm((f) => ({ ...f, batchNumber: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Purchase date</label>
                <input className={inputCls} style={inputStyle} type="date" value={newForm.purchaseDate} onChange={(e) => setNewForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Expiry date</label>
                <input className={inputCls} style={inputStyle} type="date" value={newForm.expiryDate} onChange={(e) => setNewForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Note</label>
                <input className={inputCls} style={inputStyle} value={newForm.note} onChange={(e) => setNewForm((f) => ({ ...f, note: e.target.value }))} />
              </div>
            </div>
            <button type="submit" disabled={newSaving} className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus size={16} /> {newSaving ? "Creating..." : "Create Variant with Stock"}
            </button>
          </form>
        </SectionCard>
      )}

      {sub === "withdraw" && (
        <SectionCard title="Withdraw Stock" icon={Hand}>
          <form onSubmit={handleWithdraw} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Reason *</label>
                <select className={inputCls} style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value as WithdrawalReason)}>
                  {WITHDRAWAL_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-th-secondary mb-1.5">Note</label>
                <input className={inputCls} style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
            </div>

            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
              <input
                type="text"
                placeholder="Search and add variant to withdraw..."
                value={withdrawQuery}
                onChange={(e) => setWithdrawQuery(e.target.value)}
                className={`${inputCls} pl-10`}
                style={inputStyle}
                aria-label="Search variants to withdraw"
              />
              {withdrawQuery.trim() && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-xl border border-th-border bg-th-surface shadow-xl">
                  {withdrawingSearch && <p className="px-4 py-3 text-sm text-th-secondary"><RefreshCw size={13} className="inline animate-spin mr-1" /> Searching...</p>}
                  {!withdrawingSearch && withdrawResults.length === 0 && <p className="px-4 py-3 text-sm text-th-muted">No variants found</p>}
                  {withdrawResults.map((v) => (
                    <button
                      key={v._id}
                      type="button"
                      onClick={() => pickWithdrawItem(v)}
                      disabled={v.stockQuantity <= 0}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-th-hover transition-colors disabled:opacity-40"
                    >
                      <span className="font-mono text-sm text-th-text">{v.sku}</span>
                      <span className="text-xs text-th-secondary truncate max-w-[50%]">{v.brandName} {v.model} {v.color}</span>
                      <span className="text-xs font-semibold text-[#1ed760]">Stock: {v.stockQuantity}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="overflow-x-auto bg-th-base rounded-[8px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-th-hover bg-th-base">
                      <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">SKU</th>
                      <th className="px-3 py-2 text-left text-[12px] font-semibold text-th-secondary uppercase">Item</th>
                      <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase">Qty</th>
                      <th className="px-3 py-2 text-right text-[12px] font-semibold text-th-secondary uppercase"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-th-border">
                    {items.map((i) => (
                      <tr key={i.variantId}>
                        <td className="px-3 py-2 font-mono text-sm text-th-text">{i.sku}</td>
                        <td className="px-3 py-2 text-sm text-th-secondary">{i.label}</td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            value={i.quantity}
                            onChange={(e) => setItems((prev) => prev.map((x) => (x.variantId === i.variantId ? { ...x, quantity: Number(e.target.value) } : x)))}
                            className={`${inputCls} w-24 ml-auto text-right`}
                            style={inputStyle}
                            aria-label={`Quantity for ${i.sku}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button type="button" onClick={() => setItems((prev) => prev.filter((x) => x.variantId !== i.variantId))} className="p-1.5 hover:bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]" aria-label={`Remove ${i.sku}`}>
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <button type="submit" disabled={withdrawSaving || items.length === 0} className="btn-primary w-full flex items-center justify-center gap-2">
              <Hand size={16} /> {withdrawSaving ? "Withdrawing..." : `Withdraw ${items.length} item${items.length === 1 ? "" : "s"}`}
            </button>
          </form>
        </SectionCard>
      )}
    </div>
  );
}

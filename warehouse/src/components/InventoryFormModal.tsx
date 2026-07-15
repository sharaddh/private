import { useState } from "react";
import api from "../api";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import Spinner from "./Spinner";
import type { InventoryItem, InventoryForm as FormType } from "../types/inventory";
import { EMPTY_FORM } from "../types/inventory";

interface Props {
  open: boolean;
  onClose: () => void;
  editing: InventoryItem | null;
  onSaved: () => void;
}

export default function InventoryFormModal({ open, onClose, editing, onSaved }: Props) {
  const [form, setForm] = useState<FormType>(() => {
    if (!editing) return EMPTY_FORM;
    return {
      sku: editing.sku || "",
      category: editing.category || "Lens",
      inventoryType: editing.inventoryType || "lens",
      brand: editing.brand || "",
      model: editing.model || "",
      color: editing.color || "",
      size: editing.size || "",
      gender: editing.gender || "",
      supplier: editing.supplier || "",
      quantity: editing.quantity || 0,
      location: (editing.location as "shop" | "warehouse") || "warehouse",
      purchasePrice: editing.purchasePrice || 0,
      sellingPrice: editing.sellingPrice || 0,
      description: editing.description || "",
    };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { toast } = useToast();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.sku.trim()) { setError("SKU is required"); return; }
    setSaving(true); setError("");
    try {
      if (editing) {
        const res = await api.put("/api/inventory/" + editing._id, form);
        if (res.success) { toast("Lens updated successfully"); onSaved(); onClose(); }
        else { setError(res.message || "Failed to update"); }
      } else {
        const res = await api.post("/api/inventory", form);
        if (res.success) { toast("Lens created successfully"); onSaved(); onClose(); }
        else { setError(res.message || "Failed to create"); }
      }
    } catch { setError("An error occurred"); }
    finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit Lens" : "Add Lens"} size="lg">
      <form onSubmit={handleSave} className="p-6 space-y-4">
        {error && <div className="bg-negative/10 text-negative px-4 py-3 rounded-pill text-sm">{error}</div>}

        <div>
          <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">SKU *</label>
          <input className="input-field" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })} placeholder="e.g. LENS-001" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Brand</label>
            <input className="input-field" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Brand" />
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Model</label>
            <input className="input-field" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Category</label>
            <select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="Lens">Lens</option>
            </select>
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Type</label>
            <select className="input-field" value={form.inventoryType} onChange={(e) => setForm({ ...form, inventoryType: e.target.value })}>
              <option value="lens">Lens</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Color</label>
            <input className="input-field" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Size</label>
            <input className="input-field" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} />
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Gender</label>
            <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Any</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Unisex">Unisex</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Supplier</label>
          <input className="input-field" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Quantity</label>
            <input className="input-field" type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} min="0" />
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Location</label>
            <select className="input-field" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value as "shop" | "warehouse" })}>
              <option value="warehouse">Warehouse</option>
              <option value="shop">Shop</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Purchase Price</label>
            <input className="input-field" type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} min="0" />
          </div>
          <div>
            <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Selling Price</label>
            <input className="input-field" type="number" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} min="0" />
          </div>
        </div>

        <div>
          <label className="block text-caption-bold text-th-secondary mb-1.5 uppercase tracking-wider">Description</label>
          <textarea className="input-field" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
            {saving ? <><Spinner size={14} className="border-surface-950 border-t-transparent" /> Saving...</> : editing ? "Update Lens" : "Create Lens"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

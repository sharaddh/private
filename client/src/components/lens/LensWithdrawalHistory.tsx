import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, PackageX, Pencil, Minus, Plus, Trash2, X } from "lucide-react";
import Modal from "../Modal";
import { useLensCart } from "./LensCartContext";
import { useToast } from "../../context/ToastContext";
import type { ShopLensWithdrawal } from "../../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onUpdated?: () => void;
}

function normPower(v: string): string {
  return v === "+0.00" || v === "0.00" || v === "-0.00" ? "0.00" : v;
}

function formatPower(lensType: string, powerKey: string): string {
  if (powerKey.includes("|")) {
    const [sph, cyl] = powerKey.split("|");
    return `${normPower(sph)} | ${normPower(cyl)}`;
  }
  const label = lensType === "sph" ? "SPH" : lensType === "cyl" ? "CYL" : "PWR";
  return `${label} ${normPower(powerKey)}`;
}

export default function LensWithdrawalHistory({ open, onClose, onUpdated }: Props) {
  const { getWithdrawals, updateWithdrawal, deleteWithdrawal } = useLensCart();
  const toast = useToast();
  const [withdrawals, setWithdrawals] = useState<ShopLensWithdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true);
    const res = await getWithdrawals();
    if (res.success && res.data) {
      setWithdrawals(res.data);
    }
    setLoading(false);
  }, [getWithdrawals]);

  useEffect(() => {
    if (open) fetchWithdrawals();
  }, [open, fetchWithdrawals]);

  const startEdit = (w: ShopLensWithdrawal) => {
    const d: Record<string, number> = {};
    w.items.forEach((it, i) => {
      d[i] = it.quantity;
    });
    setDraft(d);
    setEditingId(w._id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft({});
  };

  const handleSave = async (w: ShopLensWithdrawal) => {
    const items = w.items
      .map((it, i) => ({ coating: it.coating, lensType: it.lensType, powerKey: it.powerKey, quantity: draft[i] ?? it.quantity }))
      .filter((it) => it.quantity > 0);
    setSaving(true);
    if (items.length === 0) {
      const ok = await deleteWithdrawal(w._id);
      setSaving(false);
      if (ok) {
        toast.success("Withdrawal deleted, stock restored");
        cancelEdit();
        fetchWithdrawals();
        onUpdated?.();
      } else {
        toast.error("Failed to delete withdrawal");
      }
      return;
    }
    const res = await updateWithdrawal(w._id, items);
    setSaving(false);
    if (res) {
      toast.success("Withdrawal updated, stock adjusted");
      cancelEdit();
      fetchWithdrawals();
      onUpdated?.();
    } else {
      toast.error("Failed to update withdrawal");
    }
  };

  const handleRemoveItem = async (w: ShopLensWithdrawal, index: number) => {
    const it = w.items[index];
    if (!it) return;
    if (!confirm(`Remove "${it.coating} · ${formatPower(it.lensType, it.powerKey)}" (${it.quantity} pc) from this withdrawal? The lens${it.quantity !== 1 ? "es" : ""} will be returned to stock.`)) return;
    const remaining = w.items.filter((_, i) => i !== index);
    const items = remaining.map((x) => ({ coating: x.coating, lensType: x.lensType, powerKey: x.powerKey, quantity: x.quantity }));
    setSaving(true);
    if (items.length === 0) {
      const ok = await deleteWithdrawal(w._id);
      setSaving(false);
      if (ok) {
        toast.success("Withdrawal deleted, stock restored");
        fetchWithdrawals();
        onUpdated?.();
      } else {
        toast.error("Failed to delete withdrawal");
      }
      return;
    }
    const res = await updateWithdrawal(w._id, items);
    setSaving(false);
    if (res) {
      toast.success("Item removed, stock returned");
      if (editingId === w._id) cancelEdit();
      fetchWithdrawals();
      onUpdated?.();
    } else {
      toast.error("Failed to remove item");
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Lens Withdrawal History" size="xl">
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={20} className="animate-spin text-th-muted" />
        </div>
      ) : withdrawals.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3">
          <PackageX size={32} className="text-th-muted" />
          <p className="text-th-muted text-body font-bold">No withdrawals yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {withdrawals.map((w) => {
            const editing = editingId === w._id;
            return (
              <div key={w._id} className="rounded-xl border border-th-border bg-th-surface overflow-hidden">
                <div className="flex items-center gap-2.5 px-4 py-3 border-b border-th-hover bg-th-elevated/50">
                  <Clock size={15} className="text-primary-500 shrink-0" />
                  <span className="text-small-bold font-bold text-th-text">
                    {new Date(w.withdrawnAt).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <span className="ml-auto text-small font-bold text-primary-500">
                    {w.totalQuantity} pc{w.totalQuantity !== 1 ? "s" : ""} · ₹{w.totalPrice.toLocaleString("en-IN")}
                  </span>
                  <button type="button"
                    onClick={() => (editing ? cancelEdit() : startEdit(w))}
                    disabled={saving}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill text-micro font-bold transition-all active:scale-95 disabled:opacity-40 shrink-0 ${
                      editing ? "bg-th-elevated text-th-muted border border-th-border" : "bg-primary-500/15 text-primary-500 hover:bg-primary-500/25"
                    }`}
                  >
                    {editing ? <X size={13} /> : <Pencil size={13} />}
                    {editing ? "Cancel" : "Edit"}
                  </button>
                </div>
                <div className="px-4 py-3">
                  {editing ? (
                    <div className="space-y-2">
                      {w.items.map((it, i) => {
                        const qty = draft[i] ?? it.quantity;
                        const max = it.available != null ? it.quantity + it.available : Infinity;
                        const removed = qty <= 0;
                        return (
                          <div key={i} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 transition-all ${removed ? "border-negative/30 bg-negative/5 opacity-60" : "border-th-hover bg-th-elevated/30"}`}>
                            <span className={`flex-1 min-w-0 text-small font-bold text-th-text truncate ${removed ? "line-through text-th-muted" : ""}`}>
                              {it.coating} · {formatPower(it.lensType, it.powerKey)}
                            </span>
                            <span className="text-micro text-th-muted shrink-0">@₹{it.price}</span>
                            <div className="flex flex-col items-center gap-0.5 shrink-0">
                              <div className="flex items-center gap-1">
                                <button type="button"
                                  onClick={() => setDraft((prev) => ({ ...prev, [i]: Math.max(0, qty - 1) }))}
                                  disabled={qty <= 0 || saving}
                                  className="w-7 h-7 rounded-lg bg-negative/10 text-negative flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                                  aria-label="Decrease"
                                >
                                  <Minus size={13} />
                                </button>
                                <span className="w-8 text-center text-small-bold font-bold text-th-text">{removed ? 0 : qty}</span>
                                <button type="button"
                                  onClick={() => setDraft((prev) => ({ ...prev, [i]: Math.min(max, qty + 1) }))}
                                  disabled={qty >= max || saving}
                                  className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                                  aria-label="Increase"
                                >
                                  <Plus size={13} />
                                </button>
                                <button type="button"
                                  onClick={() => setDraft((prev) => ({ ...prev, [i]: 0 }))}
                                  disabled={saving}
                                  className="w-7 h-7 rounded-lg text-negative hover:bg-negative/10 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                                  aria-label={`Remove ${it.coating}`}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                              <span className="text-micro text-th-muted">{removed ? "removed" : Number.isFinite(max) ? `max ${max}` : ""}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex gap-2 pt-1">
                        <button type="button"
                          onClick={() => handleSave(w)}
                          disabled={saving}
                          className="flex-1 px-3 py-2 rounded-pill bg-primary-500 text-surface-950 text-small-bold shadow-sm active:scale-95 transition-all disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save changes"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        {w.items.map((it, i) => (
                          <div
                            key={`${it.coating}-${it.lensType}-${it.powerKey}-${i}`}
                            className="flex items-center gap-1 px-2 py-1 rounded-pill bg-th-elevated text-th-secondary text-micro font-bold"
                          >
                            <span className="whitespace-nowrap">{it.coating} · {formatPower(it.lensType, it.powerKey)} × {it.quantity}</span>
                            <button type="button"
                              onClick={() => handleRemoveItem(w, i)}
                              disabled={saving}
                              className="text-th-muted hover:text-negative transition-colors disabled:opacity-40"
                              aria-label={`Remove ${it.coating}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      {w.note && <p className="mt-2 text-small text-th-muted">{w.note}</p>}
                      <p className="mt-2 text-micro text-th-muted">by {w.username}</p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

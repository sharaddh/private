import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, Trash2, X, ShoppingCart, Loader2, Tags } from "lucide-react";
import api from "../../api";
import { useLensCart } from "./LensCartContext";
import { useToast } from "../../context/ToastContext";
import type { FogMark } from "../../types";

interface Props {
  onWithdrawn: () => void;
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

export default function LensCartDrawer({ onWithdrawn }: Props) {
  const { items, count, open, setOpen, updateQty, removeItem, clear, withdraw, fogMarkEnabled, updateFogMark } = useLensCart();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [fogMarks, setFogMarks] = useState<FogMark[]>([]);
  const [savingMark, setSavingMark] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  useEffect(() => {
    if (open && fogMarkEnabled) {
      api.get<FogMark[]>("/api/fog-marks").then((res) => {
        if (res.success && Array.isArray(res.data)) setFogMarks(res.data);
      });
    }
  }, [open, fogMarkEnabled]);

  if (!open) return null;

  const totalPieces = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.quantity * i.price, 0);

  const handleWithdraw = async () => {
    if (count === 0) return;
    setBusy(true);
    const result = await withdraw();
    setBusy(false);
    if (result) {
      toast.success(`${result.withdrawn} item(s) withdrawn from stock`);
      if (result.errors.length > 0) toast.error(result.errors.join("; "));
      onWithdrawn();
    } else {
      toast.error("Withdrawal failed");
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex justify-end animate-fade-in">
      <div className="w-full max-w-md bg-th-surface h-full flex flex-col" style={{ boxShadow: "var(--shadow-elevated)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-th-hover">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={18} className="text-primary-500" />
            <h3 className="text-body-bold font-bold text-th-text">Lens Cart</h3>
            {count > 0 && (
              <span className="px-2 py-0.5 rounded-pill bg-primary-500 text-surface-950 text-micro font-bold">{count}</span>
            )}
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close cart" className="p-1.5 hover:bg-th-elevated rounded-lg text-th-secondary hover:text-th-text transition-colors">
            <X size={18} />
          </button>
        </div>

        {count === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 px-6">
            <div className="w-14 h-14 rounded-full bg-th-elevated flex items-center justify-center">
              <ShoppingCart size={24} className="text-th-muted" />
            </div>
            <p className="text-th-muted text-body font-bold">Cart is empty</p>
            <p className="text-small text-th-muted text-center">Tap any lens card on the stock page to add it here.</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
              {items.map((item) => (
                <div key={item._id} className="p-3 rounded-xl border border-th-border bg-th-surface">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-small-bold font-bold text-th-text truncate">{item.coating}</div>
                      <div className="text-small text-th-muted truncate">{formatPower(item.lensType, item.powerKey)}</div>
                      <div className="text-micro font-bold text-primary-500">₹{item.price.toLocaleString("en-IN")}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button type="button"
                        onClick={async () => { if (item.quantity > 1) await updateQty(item._id, item.quantity - 1); else await removeItem(item._id); }}
                        className="w-8 h-8 rounded-lg bg-th-elevated text-th-secondary hover:text-th-text flex items-center justify-center active:scale-90 transition-all"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-small-bold font-bold text-th-text">{item.quantity}</span>
                      <button type="button"
                        onClick={async () => {
                          if (typeof item.available === "number" && item.quantity >= item.available) {
                            toast.error(`Only ${item.available} in stock`);
                            return;
                          }
                          const ok = await updateQty(item._id, item.quantity + 1);
                          if (!ok) toast.error("Cannot exceed available stock");
                        }}
                        disabled={typeof item.available === "number" && item.quantity >= item.available}
                        className="w-8 h-8 rounded-lg bg-th-elevated text-th-secondary hover:text-th-text flex items-center justify-center active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button type="button"
                      onClick={async () => { if (await removeItem(item._id)) toast.info("Removed from cart"); }}
                      className="p-2 rounded-lg text-th-muted hover:text-negative hover:bg-negative/10 transition-colors shrink-0"
                      aria-label="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  {fogMarkEnabled && (
                    <div className="flex items-center gap-2 mt-2.5 pt-2.5 border-t border-th-hover">
                      <Tags size={14} className="text-th-muted shrink-0" />
                      <select
                        value={item.fogMark || ""}
                        disabled={savingMark === item._id}
                        onChange={async (e) => {
                          setSavingMark(item._id);
                          const ok = await updateFogMark(item._id, e.target.value);
                          if (!ok) toast.error("Failed to update fog mark");
                          setSavingMark(null);
                        }}
                        className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-small font-medium border bg-th-input outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50 ${
                          item.fogMark ? "border-primary-500/40 text-primary-500" : "border-th-border text-th-muted"
                        }`}
                      >
                        <option value="">No mark</option>
                        {fogMarks.map((m) => (
                          <option key={m._id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="border-t border-th-hover px-5 py-4 space-y-3">
              <div className="flex items-center justify-between text-small-bold">
                <span className="text-th-muted">{totalPieces} piece{totalPieces !== 1 ? "s" : ""}</span>
                <span className="text-th-text font-bold">₹{totalAmount.toLocaleString("en-IN")}</span>
              </div>
              <div className="flex gap-2">
                <button type="button"
                  onClick={async () => { if (await clear()) toast.info("Cart cleared"); }}
                  disabled={busy}
                  className="px-3 py-2.5 rounded-pill bg-th-elevated text-th-secondary hover:text-negative text-small-bold border border-th-border disabled:opacity-40"
                >
                  Clear
                </button>
                <button type="button"
                  onClick={handleWithdraw}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-pill bg-primary-500 text-surface-950 text-small-bold shadow-sm hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                >
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <ShoppingCart size={16} />}
                  Withdraw from stock
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

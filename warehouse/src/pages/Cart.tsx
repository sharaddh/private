import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import api from "../api";
import type { LensStockItem } from "../types/lensStock";
import { priceForPower } from "../types/lensStock";
import type { FogMark } from "../types/fogMark";
import { formatCurrency, formatLensPower, powerTextClass } from "../utils/helpers";
import { ShoppingCart, Trash2, Minus, Plus, PackageMinus, Glasses, Tags, History } from "lucide-react";

export default function Cart() {
  const { items, count, updateQty, removeItem, clearCart, withdraw, setFogMark } = useCart();
  const { user } = useAuth();
  const [withdrawing, setWithdrawing] = useState(false);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [priceMap, setPriceMap] = useState<Record<string, LensStockItem>>({});
  const [fogMarks, setFogMarks] = useState<FogMark[]>([]);
  const [savingMark, setSavingMark] = useState<string | null>(null);

  async function loadStock() {
    const res = await api.get<LensStockItem[]>("/api/warehouse/lens-stock");
    if (res.success && Array.isArray(res.data)) {
      const map: Record<string, number> = {};
      const itemsByCoating: Record<string, LensStockItem> = {};
      for (const item of res.data) {
        itemsByCoating[item.coating] = item;
        const q = (item.quantities as Record<string, Record<string, number>>) || {};
        for (const lensType of Object.keys(q)) {
          for (const [power, qty] of Object.entries(q[lensType])) {
            const key = `${item.coating}::${lensType}::${power}`;
            map[key] = qty;
          }
        }
      }
      setStockMap(map);
      setPriceMap(itemsByCoating);
    }
  }

  useEffect(() => {
    loadStock();
  }, []);

  useEffect(() => {
    api.get<FogMark[]>("/api/fog-marks").then((res) => {
      if (res.success && Array.isArray(res.data)) setFogMarks(res.data);
    });
  }, []);

  function getStockQty(coating: string, lensType: string, powerKey: string): number {
    return stockMap[`${coating}::${lensType}::${powerKey}`] || 0;
  }

  const totalPrice = items.reduce((sum, i) => sum + (i.price ?? priceForPower(priceMap[i.coating], i.powerKey) ?? 0) * i.quantity, 0);

  async function handleWithdraw() {
    if (!confirm("Withdraw all items? This will reduce lens stock and save to your history.")) return;
    setWithdrawing(true);
    await withdraw();
    setWithdrawing(false);
  }

  async function handleFogMark(itemId: string, mark: string) {
    setSavingMark(itemId);
    await setFogMark(itemId, mark);
    setSavingMark(null);
  }

  return (
    <div className="h-full flex flex-col gap-4 pb-20 lg:pb-0 animate-page-enter">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-th-border bg-th-surface px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary-500/15 flex items-center justify-center shrink-0">
            <span className="text-body-bold text-primary-500">{(user?.name || user?.username || "U").charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="text-body-bold text-th-text truncate">{user?.name || user?.username || "User"}</p>
            <p className="text-small text-th-muted truncate">@{user?.username || "—"} · {user?.role === "owner" ? "Owner" : user?.role || "User"}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
            <ShoppingCart size={22} className="text-primary-500" />
          </div>
          <div>
            <h1 className="text-feature font-bold text-th-text leading-tight">Cart</h1>
            <p className="text-small text-th-muted">{count} item{count !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/withdrawals"
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-small font-bold bg-th-elevated text-th-text active:scale-95 transition-all"
          >
            <History size={16} /> My Withdrawals
          </Link>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-negative text-small font-bold bg-negative/10 active:scale-95 transition-all"
            >
              <Trash2 size={16} /> Clear All
            </button>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-th-elevated flex items-center justify-center">
              <ShoppingCart size={28} className="text-th-muted" />
            </div>
            <p className="text-th-muted text-body font-bold">Cart is empty</p>
            <p className="text-th-muted text-small">Tap lenses on the stock page to add them</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto space-y-3">
            {items.map((item, idx) => {
              const lensLabel = item.lensType === "compound" ? "Compound" : item.lensType.toUpperCase();
              const stock = getStockQty(item.coating, item.lensType, item.powerKey);
              const atMax = stock > 0 && item.quantity >= stock;

              return (
                <div key={item._id} style={{ animationDelay: `${Math.min(idx, 10) * 35}ms` }} className="card p-3 sm:p-4 animate-fade-up">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center shrink-0">
                        <Glasses size={18} className="text-primary-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-body-bold text-th-text truncate">{item.coating}</span>
                          <span className="px-2 py-0.5 rounded text-small font-bold bg-th-elevated text-th-secondary">{lensLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 min-w-0">
                          <span className={`text-small-bold ${powerTextClass(item.powerKey)} truncate min-w-0`}>{formatLensPower(item.powerKey)}</span>
                          {stock > 0 && (
                            <span className={`text-small font-medium ${atMax ? "text-negative" : "text-th-muted"}`}>
                              stock: {stock}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-th-border">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <Tags size={14} className="text-th-muted shrink-0" />
                      <select
                        value={item.fogMark || ""}
                        disabled={savingMark === item._id}
                        onChange={(e) => handleFogMark(item._id, e.target.value)}
                        className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-small font-medium border bg-th-base outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50 ${
                          item.fogMark
                            ? "border-primary-500/40 text-primary-500"
                            : "border-th-border text-th-muted"
                        }`}
                      >
                        <option value="">No mark</option>
                        {fogMarks.map((m) => (
                          <option key={m._id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-th-elevated rounded-xl p-1">
                        <button
                          onClick={() => item.quantity <= 1 ? removeItem(item._id) : updateQty(item._id, item.quantity - 1)}
                          className="w-10 h-10 rounded-lg bg-negative/10 text-negative flex items-center justify-center active:scale-90 transition-all"
                        >
                          <Minus size={18} strokeWidth={2.5} />
                        </button>
                        <span className="w-10 text-center text-body-bold text-th-text">{item.quantity}</span>
                        <button
                          onClick={() => { if (!atMax) updateQty(item._id, item.quantity + 1); }}
                          disabled={atMax}
                          className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus size={18} strokeWidth={2.5} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item._id)}
                        className="w-10 h-10 rounded-lg bg-negative/10 text-negative flex items-center justify-center active:scale-90 transition-all"
                      >
                        <Trash2 size={18} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="shrink-0 card p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-5">
                <div>
                  <div className="text-small text-th-muted">Items</div>
                  <div className="text-body-bold text-th-text">{count}</div>
                </div>
                <div>
                  <div className="text-small text-th-muted">Total</div>
                  <div className="text-feature font-bold text-primary-500">{formatCurrency(totalPrice)}</div>
                </div>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={withdrawing}
                className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-primary-500 text-surface-950 text-body font-bold active:scale-95 transition-all disabled:opacity-50 shrink-0"
              >
                <PackageMinus size={20} />
                {withdrawing ? "Withdrawing..." : "Withdraw"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

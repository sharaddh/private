import { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import type { LensStockItem } from "../types/lensStock";
import { formatCurrency } from "../utils/helpers";
import { ShoppingCart, Trash2, Minus, Plus, PackageMinus, Clock, ChevronDown, ChevronRight, CheckCircle2, Glasses } from "lucide-react";

interface WithdrawalRecord {
  _id: string;
  username: string;
  items: { coating: string; lensType: string; powerKey: string; quantity: number; price?: number }[];
  totalQuantity: number;
  totalPrice?: number;
  paid?: boolean;
  paidAt?: string;
  withdrawnAt: string;
}

export default function Cart() {
  const { items, count, updateQty, removeItem, clearCart, withdraw } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [withdrawing, setWithdrawing] = useState(false);
  const [history, setHistory] = useState<WithdrawalRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchStock() {
      const res = await api.get<LensStockItem[]>("/api/warehouse/lens-stock");
      if (res.success && Array.isArray(res.data)) {
        const map: Record<string, number> = {};
        const prices: Record<string, number> = {};
        for (const item of res.data) {
          prices[item.coating] = item.price ?? 0;
          const q = (item.quantities as Record<string, Record<string, number>>) || {};
          for (const lensType of Object.keys(q)) {
            for (const [power, qty] of Object.entries(q[lensType])) {
              const key = `${item.coating}::${lensType}::${power}`;
              map[key] = qty;
            }
          }
        }
        setStockMap(map);
        setPriceMap(prices);
      }
    }
    fetchStock();
  }, []);

  function getStockQty(coating: string, lensType: string, powerKey: string): number {
    return stockMap[`${coating}::${lensType}::${powerKey}`] || 0;
  }

  const totalPrice = items.reduce((sum, i) => sum + (i.price ?? priceMap[i.coating] ?? 0) * i.quantity, 0);

  async function fetchHistory() {
    setLoadingHistory(true);
    const res = await api.get<WithdrawalRecord[]>("/api/cart/withdrawals");
    if (res.success && Array.isArray(res.data)) {
      setHistory(res.data);
    }
    setLoadingHistory(false);
  }

  useEffect(() => {
    fetchHistory();
  }, []);

  async function markPaid(id: string) {
    setPayingId(id);
    const res = await api.put<WithdrawalRecord>(`/api/cart/withdrawals/${id}/pay`, {});
    if (res.success && res.data) {
      setHistory((prev) => prev.map((r) => (r._id === id ? res.data! : r)));
      toast("Withdrawal marked as paid", "success");
    } else {
      toast(res.message || "Failed to mark as paid", "error");
    }
    setPayingId(null);
  }

  async function handleWithdraw() {
    if (!confirm("Withdraw all items? This will reduce lens stock and save to your history.")) return;
    setWithdrawing(true);
    await withdraw();
    setWithdrawing(false);
    fetchHistory();
  }

  return (
    <div className="h-full flex flex-col gap-4 pb-20 lg:pb-0 animate-page-enter">
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
        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-negative text-small font-bold bg-negative/10 active:scale-95 transition-all"
          >
            <Trash2 size={16} /> Clear All
          </button>
        )}
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
              const isNeg = item.powerKey.startsWith("-");
              const isPos = item.powerKey.startsWith("+") && item.powerKey !== "+0.00";
              const lensLabel = item.lensType === "compound" ? "Both" : item.lensType.toUpperCase();
              const qtyColor = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-secondary";
              const stock = getStockQty(item.coating, item.lensType, item.powerKey);
              const atMax = stock > 0 && item.quantity >= stock;
              const price = item.price ?? priceMap[item.coating] ?? 0;

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
                          <span className={`text-small-bold ${qtyColor} truncate min-w-0`}>{item.powerKey}</span>
                          {stock > 0 && (
                            <span className={`text-small font-medium ${atMax ? "text-negative" : "text-th-muted"}`}>
                              stock: {stock}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-small-bold text-th-text">{formatCurrency(price)}</div>
                      <div className="text-small text-th-muted">per lens</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-th-border">
                    <div className="flex items-baseline gap-1.5 min-w-0">
                      <span className="text-small font-bold text-th-secondary">{formatCurrency(price)} × {item.quantity}</span>
                      <span className="text-small font-bold text-th-muted">=</span>
                      <span className="text-body-bold text-primary-500">{formatCurrency(price * item.quantity)}</span>
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

          <div className="shrink-0">
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl bg-primary-500 text-surface-950 text-body font-bold active:scale-95 transition-all disabled:opacity-50"
            >
              <PackageMinus size={20} />
              {withdrawing ? "Withdrawing..." : `Withdraw ${count} item${count !== 1 ? "s" : ""} · ${formatCurrency(totalPrice)}`}
            </button>
          </div>
        </>
      )}

      {/* Withdrawal History */}
      <div className="shrink-0">
        <button
          onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen && history.length === 0) fetchHistory(); }}
          className="flex items-center gap-2 w-full px-2 py-2 rounded-lg hover:bg-th-elevated transition-colors"
        >
          {historyOpen ? <ChevronDown size={16} className="text-th-muted" /> : <ChevronRight size={16} className="text-th-muted" />}
          <Clock size={16} className="text-th-muted" />
          <span className="text-small font-bold text-th-text uppercase tracking-wider">My Withdrawals</span>          <span className="ml-auto flex items-center gap-2 min-w-0">
            {user?.username && <span className="text-small font-medium text-primary-500 truncate min-w-0">{user.username}</span>}
            {history.length > 0 && (
              <span className="px-2 py-0.5 rounded-pill bg-th-elevated text-small font-bold text-th-text shrink-0">{history.length}</span>
            )}
          </span>
        </button>

        {historyOpen && (
          <div className="mt-2 space-y-2 max-h-72 overflow-auto">
            {loadingHistory ? (
              <p className="text-center text-th-muted text-small py-4">Loading...</p>
            ) : history.length === 0 ? (
              <p className="text-center text-th-muted text-small py-4">No withdrawals yet for {user?.username || "you"}</p>
            ) : (
              history.map((rec, idx) => (
                <div key={rec._id} style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }} className="card p-3 sm:p-4 animate-fade-up">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <PackageMinus size={16} className="text-emerald-500" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-body-bold text-th-text truncate">{rec.username}</span>
                        <div className="mt-0.5 text-small text-th-muted">{rec.totalQuantity} item{rec.totalQuantity !== 1 ? "s" : ""}</div>
                      </div>
                    </div>
                    <span className="text-small text-th-muted text-right whitespace-nowrap shrink-0">
                      {new Date(rec.withdrawnAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      <br />
                      {new Date(rec.withdrawnAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {rec.items.map((it, idx) => {
                      const isNeg = it.powerKey.startsWith("-");
                      const isPos = it.powerKey.startsWith("+") && it.powerKey !== "+0.00";
                      return (
                        <span
                          key={idx}
                          className={`px-2 py-0.5 rounded text-small font-medium ${
                            isNeg ? "bg-amber-400/15 text-amber-500" : isPos ? "bg-emerald-400/15 text-emerald-500" : "bg-th-elevated text-th-secondary"
                          }`}
                        >
                          {it.coating} {it.powerKey} x{it.quantity}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap mt-3 pt-3 border-t border-th-border">
                    <span className="text-body-bold text-th-text">
                      Total: <span className="text-primary-500">{formatCurrency(rec.totalPrice ?? 0)}</span>
                    </span>
                    {rec.paid ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-pill bg-emerald-500/15 text-emerald-500 text-small-bold">
                        <CheckCircle2 size={16} /> Paid
                      </span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-pill bg-amber-500/15 text-amber-500 text-small-bold">Unpaid</span>
                        <button
                          onClick={() => markPaid(rec._id)}
                          disabled={payingId === rec._id}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-pill bg-primary-500 text-surface-950 text-small-bold active:scale-95 transition-all disabled:opacity-50"
                        >
                          <CheckCircle2 size={16} />
                          Mark as Paid
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

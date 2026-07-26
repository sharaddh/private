import { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import api from "../api";
import type { LensStockItem } from "../types/lensStock";
import { ShoppingCart, Trash2, Minus, Plus, PackageMinus, Clock, ChevronDown, ChevronRight } from "lucide-react";

interface WithdrawalRecord {
  _id: string;
  username: string;
  items: { coating: string; lensType: string; powerKey: string; quantity: number }[];
  totalQuantity: number;
  withdrawnAt: string;
}

export default function Cart() {
  const { items, count, updateQty, removeItem, clearCart, withdraw } = useCart();
  const [withdrawing, setWithdrawing] = useState(false);
  const [history, setHistory] = useState<WithdrawalRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});

  useEffect(() => {
    async function fetchStock() {
      const res = await api.get<LensStockItem[]>("/api/warehouse/lens-stock");
      if (res.success && Array.isArray(res.data)) {
        const map: Record<string, number> = {};
        for (const item of res.data) {
          const q = (item.quantities as Record<string, Record<string, number>>) || {};
          for (const lensType of Object.keys(q)) {
            for (const [power, qty] of Object.entries(q[lensType])) {
              const key = `${item.coating}::${lensType}::${power}`;
              map[key] = qty;
            }
          }
        }
        setStockMap(map);
      }
    }
    fetchStock();
  }, []);

  function getStockQty(coating: string, lensType: string, powerKey: string): number {
    return stockMap[`${coating}::${lensType}::${powerKey}`] || 0;
  }

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

  async function handleWithdraw() {
    if (!confirm("Withdraw all items? This will reduce lens stock and save to your history.")) return;
    setWithdrawing(true);
    await withdraw();
    setWithdrawing(false);
    fetchHistory();
  }

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center">
            <ShoppingCart size={18} className="text-primary-500" />
          </div>
          <div>
            <h1 className="text-feature font-bold text-th-text leading-tight">Cart</h1>
            <p className="text-micro text-th-muted">{count} item{count !== 1 ? "s" : ""}</p>
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={clearCart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-negative text-micro font-bold bg-negative/10 active:scale-95 transition-all"
          >
            <Trash2 size={14} /> Clear All
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-th-elevated flex items-center justify-center">
              <ShoppingCart size={24} className="text-th-muted" />
            </div>
            <p className="text-th-muted text-body">Cart is empty</p>
            <p className="text-th-muted text-micro">Tap lenses on the stock page to add them</p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-auto space-y-2">
            {items.map((item) => {
              const isNeg = item.powerKey.startsWith("-");
              const isPos = item.powerKey.startsWith("+") && item.powerKey !== "+0.00";
              const lensLabel = item.lensType === "compound" ? "Both" : item.lensType.toUpperCase();
              const qtyColor = isNeg ? "text-amber-500" : isPos ? "text-emerald-500" : "text-th-secondary";
              const stock = getStockQty(item.coating, item.lensType, item.powerKey);
              const atMax = stock > 0 && item.quantity >= stock;

              return (
                <div key={item._id} className="card p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-th-text truncate">{item.coating}</span>
                        <span className="px-1.5 py-0.5 rounded text-micro font-bold bg-th-elevated text-th-secondary">{lensLabel}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-xs font-bold ${qtyColor}`}>{item.powerKey}</span>
                        {stock > 0 && (
                          <span className={`text-micro font-medium ${atMax ? "text-negative" : "text-th-muted"}`}>
                            stock: {stock}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 bg-th-elevated rounded-xl p-1">
                        <button
                          onClick={() => item.quantity <= 1 ? removeItem(item._id) : updateQty(item._id, item.quantity - 1)}
                          className="w-8 h-8 rounded-lg bg-negative/10 text-negative flex items-center justify-center active:scale-90 transition-all"
                        >
                          <Minus size={14} strokeWidth={2.5} />
                        </button>
                        <span className="w-8 text-center text-sm font-bold text-th-text">{item.quantity}</span>
                        <button
                          onClick={() => { if (!atMax) updateQty(item._id, item.quantity + 1); }}
                          disabled={atMax}
                          className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item._id)}
                        className="w-8 h-8 rounded-lg bg-negative/10 text-negative flex items-center justify-center active:scale-90 transition-all"
                      >
                        <Trash2 size={14} strokeWidth={2} />
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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-500 text-surface-950 text-sm font-bold active:scale-95 transition-all disabled:opacity-50"
            >
              <PackageMinus size={18} />
              {withdrawing ? "Withdrawing..." : `Withdraw ${count} item${count !== 1 ? "s" : ""}`}
            </button>
          </div>
        </>
      )}

      {/* Withdrawal History */}
      <div className="shrink-0">
        <button
          onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen && history.length === 0) fetchHistory(); }}
          className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-th-elevated transition-colors"
        >
          {historyOpen ? <ChevronDown size={14} className="text-th-muted" /> : <ChevronRight size={14} className="text-th-muted" />}
          <Clock size={14} className="text-th-muted" />
          <span className="text-xs font-bold text-th-text uppercase tracking-wider">Withdrawal History</span>
          {history.length > 0 && <span className="text-xs text-th-muted font-medium">({history.length})</span>}
        </button>

        {historyOpen && (
          <div className="mt-2 space-y-2 max-h-64 overflow-auto">
            {loadingHistory ? (
              <p className="text-center text-th-muted text-micro py-4">Loading...</p>
            ) : history.length === 0 ? (
              <p className="text-center text-th-muted text-micro py-4">No withdrawals yet</p>
            ) : (
              history.map((rec) => (
                <div key={rec._id} className="card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-th-text">{rec.username}</span>
                      <span className="text-micro text-th-muted">{rec.totalQuantity} item{rec.totalQuantity !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-micro text-th-muted">
                      {new Date(rec.withdrawnAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" "}
                      {new Date(rec.withdrawnAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {rec.items.map((it, idx) => {
                      const isNeg = it.powerKey.startsWith("-");
                      const isPos = it.powerKey.startsWith("+") && it.powerKey !== "+0.00";
                      return (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded text-micro font-medium ${
                            isNeg ? "bg-amber-400/15 text-amber-500" : isPos ? "bg-emerald-400/15 text-emerald-500" : "bg-th-elevated text-th-secondary"
                          }`}
                        >
                          {it.coating} {it.powerKey} x{it.quantity}
                        </span>
                      );
                    })}
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

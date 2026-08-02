import { useState, useEffect } from "react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import type { LensStockItem } from "../types/lensStock";
import { priceForPower } from "../types/lensStock";
import type { FogMark } from "../types/fogMark";
import { formatCurrency, formatLensPower, lensTypeLabel, powerChipClass, powerTextClass } from "../utils/helpers";
import { generateWithdrawalPdf } from "../utils/withdrawalPdf";
import { ShoppingCart, Trash2, Minus, Plus, PackageMinus, Clock, ChevronDown, ChevronRight, CheckCircle2, Glasses, Tags, MessageCircle } from "lucide-react";

interface WithdrawalRecord {
  _id: string;
  username: string;
  items: { coating: string; lensType: string; powerKey: string; quantity: number; price?: number; fogMark?: string }[];
  totalQuantity: number;
  totalPrice?: number;
  paid?: boolean;
  paidAt?: string;
  withdrawnAt: string;
}

export default function Cart() {
  const { items, count, updateQty, removeItem, clearCart, withdraw, setFogMark } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [withdrawing, setWithdrawing] = useState(false);
  const [history, setHistory] = useState<WithdrawalRecord[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [priceMap, setPriceMap] = useState<Record<string, LensStockItem>>({});
  const [fogMarks, setFogMarks] = useState<FogMark[]>([]);
  const [savingMark, setSavingMark] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStock() {
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
    fetchStock();
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

  async function handleFogMark(itemId: string, mark: string) {
    setSavingMark(itemId);
    await setFogMark(itemId, mark);
    setSavingMark(null);
  }

  function handleSendPdf(rec: WithdrawalRecord) {
    generateWithdrawalPdf({
      username: rec.username,
      withdrawnAt: rec.withdrawnAt,
      items: rec.items,
      totalQuantity: rec.totalQuantity,
      totalPrice: rec.totalPrice,
    });
    window.open("https://web.whatsapp.com/", "_blank");
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
          <div className="mt-2 space-y-2 flex-1 min-h-0 overflow-auto">
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
                    {rec.items.map((it, idx) => (
                      <span
                        key={idx}
                        className={`px-2 py-0.5 rounded text-small font-medium ${powerChipClass(it.powerKey)}`}
                      >
                        {it.coating} · {lensTypeLabel(it.lensType)} · {formatLensPower(it.powerKey)} x{it.quantity}
                        {it.fogMark ? ` · ${it.fogMark}` : ""}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap mt-3 pt-3 border-t border-th-border">
                    <span className="text-body-bold text-th-text">
                      Total: <span className="text-primary-500">{formatCurrency(rec.totalPrice ?? 0)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendPdf(rec)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-pill bg-emerald-500/15 text-emerald-500 text-small-bold active:scale-95 transition-all"
                      >
                        <MessageCircle size={16} />
                        WhatsApp
                      </button>
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
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import api from "../api";
import type { LensStockItem } from "../types/lensStock";
import { priceForPower } from "../types/lensStock";
import type { FogMark } from "../types/fogMark";
import { formatCurrency, formatLensPower, lensTypeLabel, powerTextClass } from "../utils/helpers";
import { generateWithdrawalPdf } from "../utils/withdrawalPdf";
import StatCard from "../components/StatCard";
import {
  Drawer, DrawerContent, DrawerHandle, DrawerTitle,
} from "../components/ui/drawer";
import {
  History, PackageMinus, CheckCircle2, Undo2, MessageCircle, Pencil, Check, Minus, Plus, Trash2,
  Clock, Glasses, IndianRupee, X,
} from "lucide-react";

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

interface EditItem {
  coating: string;
  lensType: string;
  powerKey: string;
  quantity: number;
  fogMark?: string;
}

function powerDisplay(item: { lensType: string; powerKey: string }): string {
  const formatted = formatLensPower(item.powerKey);
  if (item.lensType === "compound") return formatted.replace("SPH ", "").replace("CYL ", "");
  return `${lensTypeLabel(item.lensType)} ${formatted}`;
}

export default function Withdrawals() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [history, setHistory] = useState<WithdrawalRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [priceMap, setPriceMap] = useState<Record<string, LensStockItem>>({});
  const [editingRec, setEditingRec] = useState<WithdrawalRecord | null>(null);
  const [editItems, setEditItems] = useState<EditItem[]>([]);
  const [savingEdit, setSavingEdit] = useState(false);
  const [fogMarks, setFogMarks] = useState<FogMark[]>([]);

  useEffect(() => {
    api.get<FogMark[]>("/api/fog-marks").then((res) => {
      if (res.success && Array.isArray(res.data)) setFogMarks(res.data);
    });
  }, []);

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

  const stats = useMemo(() => {
    let totalItems = 0;
    let totalAmount = 0;
    let unpaid = 0;
    for (const r of history) {
      totalItems += r.totalQuantity;
      totalAmount += r.totalPrice ?? 0;
      if (!r.paid) unpaid++;
    }
    return { totalItems, totalAmount, unpaid, paid: history.length - unpaid };
  }, [history]);

  async function togglePaid(rec: WithdrawalRecord) {
    setTogglingId(rec._id);
    const next = !rec.paid;
    const res = await api.put<WithdrawalRecord>(`/api/cart/withdrawals/${rec._id}/pay`, { paid: next });
    if (res.success && res.data) {
      setHistory((prev) => prev.map((r) => (r._id === rec._id ? res.data! : r)));
      toast(next ? "Withdrawal marked as paid" : "Withdrawal marked as unpaid", "success");
    } else {
      toast(res.message || "Failed to update payment status", "error");
    }
    setTogglingId(null);
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

  function openEdit(rec: WithdrawalRecord) {
    setEditingRec(rec);
    setEditItems(rec.items.map((it) => ({ coating: it.coating, lensType: it.lensType, powerKey: it.powerKey, quantity: it.quantity, fogMark: it.fogMark })));
  }

  function changeEditQty(idx: number, delta: number) {
    setEditItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it))
    );
  }

  function removeEditItem(idx: number) {
    setEditItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function changeEditFog(idx: number, fog: string) {
    setEditItems((prev) => prev.map((it, i) => (i === idx ? { ...it, fogMark: fog } : it)));
  }

  async function saveEdit() {
    if (!editingRec) return;
    if (editItems.length === 0 && !confirm("Remove all items from this withdrawal?")) return;
    setSavingEdit(true);
    const res = await api.put<WithdrawalRecord>(`/api/cart/withdrawals/${editingRec._id}`, { items: editItems });
    if (res.success && res.data) {
      setHistory((prev) => prev.map((r) => (r._id === editingRec._id ? res.data! : r)));
      toast("Withdrawal updated", "success");
      setEditingRec(null);
      loadStock();
    } else {
      toast(res.message || "Failed to update withdrawal", "error");
    }
    setSavingEdit(false);
  }

  return (
    <div className="h-full flex flex-col gap-4 pb-20 lg:pb-0 animate-page-enter">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center shrink-0">
            <History size={22} className="text-primary-500" />
          </div>
          <div>
            <h1 className="text-feature font-bold text-th-text leading-tight">Withdrawals</h1>
            <p className="text-small text-th-muted">
              {user?.username ? `@${user.username}` : "You"} · {history.length} withdrawal{history.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      {history.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={History}
            iconColor="text-primary-500"
            iconBg="bg-primary-500/15"
            value={history.length}
            label="Withdrawals"
          />
          <StatCard
            icon={Glasses}
            iconColor="text-announcement-500"
            iconBg="bg-announcement-500/15"
            value={stats.totalItems}
            label="Lenses withdrawn"
          />
          <StatCard
            icon={IndianRupee}
            iconColor="text-emerald-500"
            iconBg="bg-emerald-500/15"
            value={formatCurrency(stats.totalAmount)}
            label="Total amount"
          />
          <StatCard
            icon={Clock}
            iconColor="text-amber-500"
            iconBg="bg-amber-500/15"
            value={stats.unpaid}
            label="Unpaid"
            badge={stats.unpaid > 0 ? { text: "due", variant: "yellow" } : undefined}
          />
        </div>
      )}

      {/* Withdrawals List */}
      <div className="flex-1 min-h-0 overflow-auto space-y-3">
        {loadingHistory ? (
          <p className="text-center text-th-muted text-small py-8">Loading...</p>
        ) : history.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-th-elevated flex items-center justify-center">
                <PackageMinus size={28} className="text-th-muted" />
              </div>
              <p className="text-th-muted text-body font-bold">No withdrawals yet</p>
              <p className="text-th-muted text-small">Withdraw items from the Cart page</p>
            </div>
          </div>
        ) : (
          history.map((rec, idx) => {
            const isPaid = !!rec.paid;
            return (
              <div
                key={rec._id}
                style={{ animationDelay: `${Math.min(idx, 8) * 30}ms` }}
                className="bg-th-card border border-th-border rounded-xl overflow-hidden animate-fade-up"
              >
                {/* Header Strip */}
                <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b ${isPaid ? "border-emerald-500/20 bg-emerald-500/5" : "border-amber-500/20 bg-amber-500/5"}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isPaid ? "bg-emerald-500/15" : "bg-amber-500/15"}`}>
                      {isPaid ? (
                        <CheckCircle2 size={20} className="text-emerald-500" />
                      ) : (
                        <Clock size={20} className="text-amber-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-body-bold text-th-text truncate">{rec.username}</span>
                        {isPaid ? (
                          <span className="px-2 py-0.5 rounded-pill bg-emerald-500/15 text-emerald-500 text-badge font-bold shrink-0">Paid</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-pill bg-amber-500/15 text-amber-500 text-badge font-bold shrink-0">Unpaid</span>
                        )}
                      </div>
                      <div className="mt-0.5 text-small text-th-muted truncate">
                        {new Date(rec.withdrawnAt).toLocaleString("en-IN", {
                          day: "numeric", month: "short", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => togglePaid(rec)}
                    disabled={togglingId === rec._id}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-pill text-small-bold active:scale-95 transition-all disabled:opacity-50 shrink-0 ${
                      isPaid ? "bg-th-elevated text-th-text hover:bg-th-elevated/80" : "bg-primary-500 text-surface-950 hover:bg-primary-400"
                    }`}
                  >
                    {togglingId === rec._id ? (
                      "Saving..."
                    ) : isPaid ? (
                      <>
                        <Undo2 size={16} /> Mark Unpaid
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Mark Paid
                      </>
                    )}
                  </button>
                </div>

                {/* Items Body */}
                <div className="px-4 py-3">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-th-border text-badge text-th-muted uppercase tracking-wider">
                        <th className="py-2 pr-2 font-bold">#</th>
                        <th className="py-2 pr-2 font-bold">Power</th>
                        <th className="py-2 pr-2 font-bold">Coating</th>
                        <th className="py-2 pr-2 font-bold">ID</th>
                        <th className="py-2 font-bold text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rec.items.map((it, idx) => (
                        <tr key={idx} className="border-b border-th-border/50 last:border-0">
                          <td className="py-2 pr-2 text-small text-th-muted whitespace-nowrap">{idx + 1}</td>
                          <td className={`py-2 pr-2 text-small-bold whitespace-nowrap ${powerTextClass(it.powerKey)}`}>
                            {powerDisplay(it)}
                          </td>
                          <td className="py-2 pr-2 text-small-bold text-th-text">{it.coating}</td>
                          <td className="py-2 pr-2 text-small text-th-secondary">
                            {it.fogMark || "—"}
                          </td>
                          <td className="py-2 text-small-bold text-th-text text-right whitespace-nowrap">×{it.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer Strip */}
                <div className="flex items-center justify-between gap-2 flex-wrap px-4 py-3 border-t border-th-border bg-th-elevated/20">
                  <div className="min-w-0">
                    <div className="text-badge text-th-muted uppercase tracking-wider">Total</div>
                    <div className="text-body-bold text-th-text">
                      {rec.totalQuantity} item{rec.totalQuantity !== 1 ? "s" : ""} ·{" "}
                      <span className="text-primary-500">{formatCurrency(rec.totalPrice ?? 0)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleSendPdf(rec)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 text-small-bold active:scale-95 transition-all"
                    >
                      <MessageCircle size={16} />
                      WhatsApp
                    </button>
                    <button
                      onClick={() => openEdit(rec)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-pill bg-th-elevated text-th-text hover:bg-th-elevated/80 text-small-bold active:scale-95 transition-all"
                    >
                      <Pencil size={16} />
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Edit Drawer */}
      <Drawer
        open={!!editingRec}
        onOpenChange={(o) => { if (!o && !savingEdit) setEditingRec(null); }}
        handleOnly
        autoFocus
      >
        <DrawerContent className="max-h-[85dvh]">
          <DrawerHandle />
          <DrawerTitle className="sr-only">Edit Withdrawal</DrawerTitle>

          <div className="shrink-0 flex items-center justify-between px-5 pb-3 border-b border-th-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0">
                <Pencil size={16} className="text-primary-500" />
              </div>
              <h3 className="text-body-bold text-th-text truncate">Edit Withdrawal</h3>
            </div>
            <button
              onClick={() => { if (!savingEdit) setEditingRec(null); }}
              className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted transition-colors shrink-0"
            >
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-2 min-h-0">
            {editItems.length === 0 ? (
              <p className="text-center text-th-muted text-body py-6">No items in this withdrawal</p>
            ) : (
              editItems.map((it, idx) => {
                const stock = stockMap[`${it.coating}::${it.lensType}::${it.powerKey}`] || 0;
                return (
                  <div key={`${it.coating}|${it.lensType}|${it.powerKey}`} className="p-3 rounded-xl bg-th-elevated border border-th-border/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="text-small-bold text-th-text truncate">{it.coating}</span>
                        <span className="px-1.5 py-0.5 rounded text-badge font-bold bg-th-base text-th-secondary">{lensTypeLabel(it.lensType)}</span>
                        <span className={`text-small-bold ${powerTextClass(it.powerKey)}`}>{formatLensPower(it.powerKey)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => changeEditQty(idx, -1)}
                          disabled={it.quantity <= 1}
                          className="w-8 h-8 rounded-lg bg-negative/10 text-negative flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                        >
                          <Minus size={14} strokeWidth={2.5} />
                        </button>
                        <span className="w-8 text-center text-body-bold text-th-text">{it.quantity}</span>
                        <button
                          onClick={() => changeEditQty(idx, 1)}
                          className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center active:scale-90 transition-all"
                        >
                          <Plus size={14} strokeWidth={2.5} />
                        </button>
                        <button
                          onClick={() => removeEditItem(idx)}
                          className="w-8 h-8 rounded-lg bg-negative/10 text-negative flex items-center justify-center active:scale-90 transition-all"
                        >
                          <Trash2 size={14} strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-badge text-th-muted uppercase tracking-wider shrink-0">ID</span>
                      <select
                        value={it.fogMark || ""}
                        onChange={(e) => changeEditFog(idx, e.target.value)}
                        className={`flex-1 min-w-0 px-2.5 py-1.5 rounded-lg text-small font-medium border bg-th-base outline-none focus:ring-2 focus:ring-primary-500/40 ${
                          it.fogMark ? "border-primary-500/40 text-primary-500" : "border-th-border text-th-muted"
                        }`}
                      >
                        <option value="">No mark</option>
                        {fogMarks.map((m) => (
                          <option key={m._id} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                      <span className="text-badge text-th-muted whitespace-nowrap shrink-0">Stock: {stock}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="shrink-0 border-t border-th-border px-5 py-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-small text-th-muted">
                {editItems.reduce((s, it) => s + it.quantity, 0)} item{editItems.reduce((s, it) => s + it.quantity, 0) !== 1 ? "s" : ""}
              </span>
              <span className="text-small-bold text-th-text">
                Total · <span className="text-primary-500">{formatCurrency(editItems.reduce((s, it) => s + (priceForPower(priceMap[it.coating], it.powerKey) || 0) * it.quantity, 0))}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditingRec(null)}
                disabled={savingEdit}
                className="flex-1 px-4 py-3 rounded-xl bg-th-elevated text-th-text text-body font-bold active:scale-95 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-primary-500 text-surface-950 text-body font-bold active:scale-95 transition-all disabled:opacity-50"
              >
                <Check size={16} strokeWidth={2.5} />
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
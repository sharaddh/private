import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Minus, Plus, Search, Trash2, Package, ShoppingCart, Loader2, RefreshCw,
} from "lucide-react";
import { inventoryService, withdrawalService } from "../services";
import { useTranslate } from "../context/TranslateContext";
import { useToast } from "../context/ToastContext";
import { useDebounce } from "../hooks";
import type { InventoryItem } from "../types";

interface CartLine {
  sku: string;
  brand: string;
  model: string;
  color: string;
  category: string;
  qty: number;
  price: number;
  maxQty: number;
}

const PAGE_SIZE = 10;

export default function Withdraw() {
  const { uiT } = useTranslate();
  const toast = useToast();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebounce(searchInput, 350);
  const [results, setResults] = useState<InventoryItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lastRef, setLastRef] = useState<string | null>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearched(true);
    try {
      const res = await inventoryService.listFiltered({ search: q, page: 1, limit: PAGE_SIZE });
      setResults(res.data?.data || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debouncedSearch);
  }, [debouncedSearch, runSearch]);

  const inCart = (sku: string) => cart.find((c) => c.sku === sku);

  function addToCart(item: InventoryItem) {
    const existing = inCart(item.sku);
    const stock = item.quantity || 0;
    if (stock <= 0) return;
    if (existing && existing.qty >= stock) {
      toast.error(uiT("Already at max stock", "पहले से अधिकतम स्टॉक पर है"));
      return;
    }
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.sku === item.sku);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(next[idx].qty + 1, stock) };
        return next;
      }
      return [
        ...prev,
        {
          sku: item.sku,
          brand: item.brand || "",
          model: item.model || "",
          color: item.color || "",
          category: item.category || "",
          qty: 1,
          price: item.sellingPrice || 0,
          maxQty: stock,
        },
      ];
    });
  }

  function changeQty(sku: string, delta: number) {
    setCart((prev) =>
      prev.map((c) => {
        if (c.sku !== sku) return c;
        const qty = Math.min(Math.max(c.qty + delta, 1), c.maxQty);
        return { ...c, qty };
      })
    );
  }

  function changePrice(sku: string, price: number) {
    setCart((prev) => prev.map((c) => (c.sku === sku ? { ...c, price: Math.max(price || 0, 0) } : c)));
  }

  function removeLine(sku: string) {
    setCart((prev) => prev.filter((c) => c.sku !== sku));
  }

  const totals = useMemo(() => {
    const totalQty = cart.reduce((s, c) => s + c.qty, 0);
    const totalPrice = cart.reduce((s, c) => s + c.qty * c.price, 0);
    return { totalQty, totalPrice };
  }, [cart]);

  async function handleWithdraw() {
    if (cart.length === 0) {
      toast.error(uiT("Cart is empty", "कार्ट खाली है"));
      return;
    }
    setSubmitting(true);
    try {
      const res = await withdrawalService.createWithdrawal({
        items: cart.map((c) => ({ sku: c.sku, qty: c.qty, price: c.price })),
        note: note.trim() || undefined,
      });
      if (res.success) {
        toast.success(uiT("Stock withdrawn successfully", "स्टॉक निकासी सफल"));
        setCart([]);
        setNote("");
        setLastRef(res.data?._id || null);
        void runSearch(debouncedSearch);
      } else {
        toast.error(res.message || uiT("Withdrawal failed", "निकासी विफल"));
      }
    } catch (e) {
      toast.error((e as Error).message || uiT("Withdrawal failed", "निकासी विफल"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <button onClick={() => navigate(-1)} aria-label={uiT("Go back", "वापस जाएं")} className="inline-flex items-center gap-2 text-sm text-th-secondary hover:text-th-text">
        <ArrowLeft size={16} aria-hidden="true" /> {uiT("Back", "वापस")}
      </button>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{uiT("Withdraw Stock", "स्टॉक निकासी")}</h1>
          <p className="text-sm text-muted-500 mt-1">
            {uiT("Take frames and lenses out of inventory and record it.", "चश्मे और लेंस इन्वेंट्री से बाहर निकालें और रिकॉर्ड करें।")}
          </p>
        </div>
        <Link to="/inventory/withdraw/history" className="btn-secondary flex items-center gap-2">
          <RefreshCw size={18} aria-hidden="true" /> {uiT("History", "इतिहास")}
        </Link>
      </div>

      {lastRef && (
        <div className="card bg-th-surface rounded-lg p-4 flex items-center justify-between gap-3 border border-[#1ed760]/40">
          <p className="text-sm text-th-text">{uiT("Withdrawal recorded", "निकासी दर्ज हो गई")} ✓</p>
          <Link to="/inventory/withdraw/history" className="btn-primary btn-sm flex items-center gap-1.5">
            {uiT("View history", "इतिहास देखें")} <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
      )}

      <div className="card bg-th-surface rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Search size={16} className="text-th-secondary" aria-hidden="true" />
          <input
            className="input-field flex-1"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={uiT("Search by SKU, brand, model, color...", "SKU, ब्रांड, मॉडल, रंग से खोजें...")}
            aria-label={uiT("Search inventory", "इन्वेंट्री खोजें")}
          />
        </div>

        {searching && (
          <div className="flex items-center gap-2 text-sm text-th-secondary py-3">
            <Loader2 size={15} className="animate-spin" /> {uiT("Searching...", "खोज रहे हैं...")}
          </div>
        )}

        {!searching && searched && results.length === 0 && (
          <p className="text-sm text-th-muted py-3">{uiT("No items found", "कोई आइटम नहीं मिला")}</p>
        )}

        {results.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-th-hover bg-th-base">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">{uiT("Item", "आइटम")}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">{uiT("Stock", "स्टॉक")}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">{uiT("Price", "मूल्य")}</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-th-secondary uppercase tracking-wider"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-th-border">
                {results.map((item) => {
                  const stock = item.quantity || 0;
                  const existing = inCart(item.sku);
                  const maxed = !!existing && existing.qty >= stock;
                  return (
                    <tr key={item._id} className="hover:bg-th-card transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-th-text">{item.sku}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="text-sm font-medium text-th-text">{item.brand || "—"} {item.model || ""}</span>
                        {item.color && <span className="text-xs text-th-secondary block">{item.color}</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${stock > 0 ? "bg-blue-500/10 text-blue-400" : "bg-[#e74c3c]/10 text-[#e74c3c]"}`}>
                          {stock}
                        </span>
                        {existing && <span className="text-xs text-th-muted ml-1.5">({existing.qty} {uiT("in cart", "कार्ट में")})</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-sm text-th-text">₹{item.sellingPrice || 0}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        <button
                          onClick={() => addToCart(item)}
                          disabled={stock <= 0 || maxed}
                          className="btn-secondary btn-sm flex items-center gap-1 disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label={uiT("Add to cart", "कार्ट में जोड़ें")}
                        >
                          <Plus size={14} aria-hidden="true" /> {uiT("Add", "जोड़ें")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card bg-th-surface rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShoppingCart size={16} className="text-th-secondary" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-th-text">{uiT("Cart", "कार्ट")} ({cart.length})</h2>
        </div>

        {cart.length === 0 ? (
          <p className="text-sm text-th-muted py-4 text-center">
            <Package size={28} className="mx-auto mb-2 opacity-30" aria-hidden="true" />
            {uiT("No items in cart. Search above to add items.", "कार्ट में कोई आइटम नहीं। आइटम जोड़ने के लिए ऊपर खोजें।")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-th-hover bg-th-base">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">SKU</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">{uiT("Item", "आइटम")}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">{uiT("Qty", "मात्रा")}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">{uiT("Price", "मूल्य")}</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-th-secondary uppercase tracking-wider">{uiT("Total", "कुल")}</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-th-border">
                {cart.map((line) => (
                  <tr key={line.sku} className="hover:bg-th-card transition-colors">
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-xs text-th-text">{line.sku}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-sm font-medium text-th-text">{line.brand || "—"} {line.model || ""}</span>
                      {line.color && <span className="text-xs text-th-secondary block">{line.color}</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => changeQty(line.sku, -1)}
                          disabled={line.qty <= 1}
                          className="p-1 rounded-md hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed text-th-text"
                          aria-label={uiT("Decrease", "घटाएं")}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-10 text-center text-sm font-semibold text-th-text">{line.qty}</span>
                        <button
                          onClick={() => changeQty(line.sku, 1)}
                          disabled={line.qty >= line.maxQty}
                          className="p-1 rounded-md hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed text-th-text"
                          aria-label={uiT("Increase", "बढ़ाएं")}
                        >
                          <Plus size={14} />
                        </button>
                        <span className="text-[11px] text-th-muted ml-1">/ {line.maxQty}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-th-secondary">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={line.price}
                          onChange={(e) => changePrice(line.sku, Number(e.target.value))}
                          className="input-field !py-1 w-24"
                          aria-label={uiT("Price", "मूल्य")}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-sm font-semibold text-th-text">₹{line.qty * line.price}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <button
                        onClick={() => removeLine(line.sku)}
                        className="p-1 rounded-md hover:bg-th-elevated text-[#e74c3c]"
                        aria-label={uiT("Remove", "हटाएं")}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cart.length > 0 && (
          <div className="mt-4 border-t border-th-border pt-4 space-y-4">
            <input
              className="input-field w-full"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={uiT("Note (optional) e.g. stock taken to warehouse", "नोट (वैकल्पिक) जैसे: स्टॉक गोदाम में ले जाया गया")}
              aria-label={uiT("Note", "नोट")}
            />
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="text-sm">
                <span className="text-th-secondary">{uiT("Total", "कुल")}: </span>
                <span className="font-semibold text-th-text">{totals.totalQty} {uiT("items", "आइटम")}</span>
                <span className="text-th-secondary mx-2">•</span>
                <span className="font-semibold text-th-text">₹{totals.totalPrice}</span>
              </div>
              <button
                onClick={handleWithdraw}
                disabled={submitting || cart.length === 0}
                className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <><Loader2 size={16} className="animate-spin" /> {uiT("Withdrawing...", "निकासी हो रही है...")}</>
                ) : (
                  <><Package size={16} /> {uiT("Withdraw Stock", "स्टॉक निकासी करें")}</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

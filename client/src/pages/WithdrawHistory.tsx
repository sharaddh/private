import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, History, RefreshCw, Loader2 } from "lucide-react";
import { withdrawalService } from "../services";
import { useTranslate } from "../context/TranslateContext";
import type { Withdrawal } from "../types";

const PAGE_SIZE = 15;

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function WithdrawHistory() {
  const { uiT } = useTranslate();
  const navigate = useNavigate();

  const [list, setList] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await withdrawalService.listFiltered({ page, limit: PAGE_SIZE });
      if (res.success && res.data) {
        setList(res.data.data || []);
        setTotal(res.data.total || 0);
        setPages(res.data.pages || 0);
      } else {
        setList([]);
      }
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const rangeStart = list.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + list.length;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(-1)} aria-label={uiT("Go back", "वापस जाएं")} className="inline-flex items-center gap-2 text-sm text-th-secondary hover:text-th-text">
        <ArrowLeft size={16} aria-hidden="true" /> {uiT("Back", "वापस")}
      </button>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{uiT("Withdrawal History", "निकासी इतिहास")}</h1>
          <p className="text-sm text-muted-500 mt-1">
            {uiT("Record of stock withdrawn from inventory.", "इन्वेंट्री से निकाले गए स्टॉक का रिकॉर्ड।")}
          </p>
        </div>
        <button
          onClick={() => { setPage(1); void load(); }}
          disabled={loading}
          className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          aria-label={uiT("Refresh", "रीफ्रेश करें")}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden="true" /> {uiT("Refresh", "रीफ्रेश")}
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-th-secondary text-sm">
          <Loader2 size={15} className="animate-spin" /> {uiT("Loading...", "लोड हो रहा है...")}
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-th-muted">
          <History size={48} className="mb-3 opacity-30" aria-hidden="true" />
          <p className="text-sm">{uiT("No withdrawals yet", "अभी कोई निकासी नहीं")}</p>
        </div>
      )}

      {list.length > 0 && (
        <div className="overflow-x-auto bg-th-surface rounded-[8px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-hover bg-th-base">
                <th className="px-4 py-3 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Date", "दिनांक")}</th>
                <th className="px-4 py-3 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("By", "द्वारा")}</th>
                <th className="px-4 py-3 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Items", "आइटम")}</th>
                <th className="px-4 py-3 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Qty", "मात्रा")}</th>
                <th className="px-4 py-3 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Value", "मूल्य")}</th>
                <th className="px-4 py-3 text-left text-[15px] font-semibold text-th-secondary uppercase tracking-wider">{uiT("Note", "नोट")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-border">
              {list.map((w) => (
                <tr key={w._id} className="hover:bg-th-card transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-th-text">{formatDate(w.createdAt)}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-th-text">{w.by || "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      {w.items.slice(0, 3).map((it) => (
                        <span key={it.sku} className="text-xs text-th-secondary whitespace-nowrap">
                          <span className="font-mono text-th-text">{it.sku}</span> — {it.brand} {it.model}
                          {it.color ? ` / ${it.color}` : ""} × {it.qty}
                        </span>
                      ))}
                      {w.items.length > 3 && (
                        <span className="text-xs text-th-muted">+{w.items.length - 3} {uiT("more", "और")}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-th-text">{w.totalQty}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-th-text">₹{w.totalPrice}</td>
                  <td className="px-4 py-3 text-sm text-th-secondary max-w-[220px]">
                    <span className="block truncate" title={w.note || ""}>{w.note || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-th-secondary">
            {uiT("Showing", "दिखा रहे हैं")} {rangeStart}–{rangeEnd} {uiT("of", "में से")} {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
              aria-label={uiT("Previous page", "पिछला पेज")}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="p-2 rounded-[9999px] hover:bg-th-elevated disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-th-text"
              aria-label={uiT("Next page", "अगला पेज")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

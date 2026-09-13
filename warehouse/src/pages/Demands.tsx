import { useState, useEffect, useMemo, useCallback } from 'react';
import type { LensStockItem, LensType } from '../types/lensStock';
import type { DemandList } from '../types/demand';
import { priceForPower } from '../types/lensStock';
import api from '../api';
import { useToast } from '../context';
import { generateDemandPdf } from '../utils/demandPdf';
import { EmptyState, ConfirmDialog, SkeletonCard } from '../components';
import {
  demandKey,
  parseDemandKey,
  getQtyFor,
  ZERO_KEYS,
  SPH_INNER,
  CYL_RANGE,
  DEMAND_TABS,
  DemandPlainView,
  DemandFlatGrid,
  DemandCompoundView,
  type DemandTabKey,
} from '../components/demand/DemandGrid';
import { fmtPairs, fmtP, roundHalf, formatDateTime } from '../utils/helpers';
import { POWER_VALUES } from '../constants';
import {
  ClipboardList,
  Plus,
  ArrowLeft,
  Download,
  Trash2,
  Send,
  Eye,
  Pencil,
  ChevronDown,
  Lock,
  Minus,
} from 'lucide-react';

// ── status meta ──────────────────────────────────────────────────
const STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: 'Open', cls: 'bg-primary-500/15 text-primary-500' },
  sent: { label: 'Sent', cls: 'bg-amber-400/15 text-amber-500' },
  closed: { label: 'Closed', cls: 'bg-emerald-400/15 text-emerald-500' },
};

type Filter = 'all' | 'open' | 'sent' | 'closed';

function getTotalQty(item: LensStockItem): number {
  const q = (item.quantities as Record<string, Record<string, number>>) || {};
  let total = 0;
  for (const lt of ['sph', 'cyl', 'compound'] as const) {
    const map = q[lt];
    if (map) {
      for (const v of Object.values(map)) total += v as number;
    }
  }
  return total;
}

export default function Demands() {
  const [lists, setLists] = useState<DemandList[]>([]);
  const [lensStock, setLensStock] = useState<LensStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'lists' | 'builder'>('lists');
  const [editing, setEditing] = useState<DemandList | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lensType, setLensType] = useState<DemandTabKey>('sph');
  const [demandTarget, setDemandTarget] = useState(10);
  const [entries, setEntries] = useState<[string, number][]>([]);
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<
    { type: 'send' | 'close' | 'delete'; id: string; num: number } | null
  >(null);
  const { toast } = useToast();

  // ── load data ───────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      const [listRes, stockRes] = await Promise.all([
        api.get<DemandList[]>('/api/warehouse/demands'),
        api.get<LensStockItem[]>('/api/warehouse/lens-stock/list'),
      ]);
      if (!active) return;
      if (listRes.success && listRes.data) setLists(listRes.data);
      else toast(listRes.message || 'Failed to load demands', 'error');
      if (stockRes.success && stockRes.data) setLensStock(stockRes.data);
      else toast(stockRes.message || 'Failed to load lens stock', 'error');
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  const refreshLists = useCallback(async () => {
    const res = await api.get<DemandList[]>('/api/warehouse/demands');
    if (res.success && res.data) setLists(res.data);
  }, []);

  // ── list numbering (newest-first → #1, derived at read time) ───
  const { sorted, numMap } = useMemo(() => {
    const s = [...lists].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const m = new Map<string, number>();
    s.forEach((l, i) => m.set(l._id, i + 1));
    return { sorted: s, numMap: m };
  }, [lists]);

  const getNum = useCallback((id: string) => numMap.get(id) || 0, [numMap]);

  const visibleLists = useMemo(
    () => (filter === 'all' ? sorted : sorted.filter((l) => l.status === filter)),
    [sorted, filter]
  );

  // ── demand selection (in-memory, not persisted) ─────────────────
  const demandSel = useMemo(() => new Map(entries), [entries]);

  const incrementDemand = useCallback((key: string) => {
    setEntries((prev) => {
      const m = new Map(prev);
      m.set(key, Math.round(((m.get(key) || 0) + 0.5) * 2) / 2);
      return Array.from(m.entries());
    });
  }, []);

  const removeDemand = useCallback((key: string) => {
    setEntries((prev) => {
      const m = new Map(prev);
      m.delete(key);
      return Array.from(m.entries());
    });
  }, []);

  const selectAllLowStock = useCallback(() => {
    const next = new Map<string, number>();
    for (const item of lensStock) {
      const addIfLow = (lt: LensType, key: string) => {
        const qty = getQtyFor(item, lt, key);
        if (qty / 2 < demandTarget)
          next.set(demandKey(item.coating, lt, key), roundHalf(demandTarget - qty / 2));
      };
      addIfLow('sph', '+0.00');
      for (const key of POWER_VALUES) {
        if (ZERO_KEYS.includes(key)) continue;
        addIfLow('sph', key);
        addIfLow('cyl', key);
      }
      for (const sph of SPH_INNER) {
        for (const cyl of CYL_RANGE) {
          addIfLow('compound', `${sph}|${cyl}`);
        }
      }
    }
    setEntries(Array.from(next.entries()));
    toast(`Selected all lens powers below ${fmtP(demandTarget)}`, 'success');
  }, [lensStock, demandTarget, toast]);

  // ── demand rows (for PDF / totals) ──────────────────────────────
  const demandRows = useMemo(() => {
    const rows: Array<{
      coating: string;
      lensType: string;
      powerKey: string;
      current: number;
      target: number;
      qty: number;
      price: number;
    }> = [];
    for (const [key, qty] of demandSel) {
      const parsed = parseDemandKey(key);
      if (!parsed) continue;
      const item = lensStock.find((i) => i.coating === parsed.coating);
      if (!item) continue;
      const current = roundHalf(getQtyFor(item, parsed.lensType, parsed.powerKey) / 2);
      rows.push({
        coating: item.coating,
        lensType: parsed.lensType,
        powerKey: parsed.powerKey,
        current,
        target: demandTarget,
        qty,
        price: priceForPower(item, parsed.powerKey) || 0,
      });
    }
    return rows.sort(
      (a, b) =>
        a.coating.localeCompare(b.coating) ||
        a.lensType.localeCompare(b.lensType) ||
        a.powerKey.localeCompare(b.powerKey)
    );
  }, [demandSel, lensStock, demandTarget]);

  const totalNeed = demandRows.reduce((s, r) => s + r.qty, 0);
  const totalAmount = demandRows.reduce((s, r) => s + r.qty * r.price, 0);

  // ── builder navigation ──────────────────────────────────────────
  const startNew = useCallback(() => {
    setEditing(null);
    setEntries([]);
    setDemandTarget(10);
    setSelectedId(lensStock[0]?._id || null);
    setLensType('sph');
    setView('builder');
  }, [lensStock]);

  const openList = useCallback(
    (list: DemandList) => {
      setEditing(list);
      setEntries(
        list.items.map(
          (it) => [demandKey(it.coating, it.lensType, it.powerKey), it.qty] as [string, number]
        )
      );
      setDemandTarget(10);
      setSelectedId(
        lensStock.find((i) => i.coating === list.items[0]?.coating)?._id ||
          lensStock[0]?._id ||
          null
      );
      setLensType('sph');
      setView('builder');
    },
    [lensStock]
  );

  // ── mutation handlers ───────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const items = Array.from(demandSel.entries()).flatMap(([key, qty]) => {
      const parsed = parseDemandKey(key);
      if (!parsed) return [];
      return [{ coating: parsed.coating, lensType: parsed.lensType, powerKey: parsed.powerKey, qty }];
    });
    if (items.length === 0) {
      toast('Select at least one lens to save a demand', 'error');
      return;
    }
    setSaving(true);
    let res;
    if (editing) {
      res = await api.put(`/api/warehouse/demands/${editing._id}`, { items });
    } else {
      res = await api.post('/api/warehouse/demands', { items });
    }
    setSaving(false);
    if (res.success) {
      toast(editing ? `Demand #${getNum(editing._id)} updated` : 'Demand created', 'success');
      setView('lists');
      await refreshLists();
    } else {
      toast(res.message || 'Failed to save demand', 'error');
    }
  }, [demandSel, editing, getNum, refreshLists, toast]);

  const handleConfirm = useCallback(async () => {
    if (!confirm) return;
    setSaving(true);
    let res;
    if (confirm.type === 'send') {
      res = await api.post(`/api/warehouse/demands/${confirm.id}/send`, {});
    } else if (confirm.type === 'close') {
      res = await api.post(`/api/warehouse/demands/${confirm.id}/close`, {});
    } else {
      res = await api.del(`/api/warehouse/demands/${confirm.id}`);
    }
    setSaving(false);
    setConfirm(null);
    if (res.success) {
      const msgs = { send: 'Demand marked as sent', close: 'Demand closed', delete: 'Demand deleted' };
      toast(msgs[confirm.type], 'success');
      setView('lists');
      await refreshLists();
    } else {
      toast(res.message || 'Action failed', 'error');
    }
  }, [confirm, refreshLists, toast]);

  const handlePdf = useCallback(() => {
    if (demandRows.length === 0) {
      toast('Select at least one lens to generate demand', 'error');
      return;
    }
    generateDemandPdf({
      target: demandTarget,
      generatedAt: new Date().toISOString(),
      items: demandRows,
    });
  }, [demandRows, demandTarget, toast]);

  // PDF directly from a saved list (no view switch needed).
  const handleListPdf = useCallback(
    (list: DemandList) => {
      const rows = list.items.map((it) => {
        const item = lensStock.find((i) => i.coating === it.coating);
        return {
          coating: it.coating,
          lensType: it.lensType,
          powerKey: it.powerKey,
          qty: it.qty,
          current: undefined as number | undefined,
          target: 10,
          price: priceForPower(item, it.powerKey) || 0,
        };
      });
      if (rows.length === 0) {
        toast('This list has no items', 'error');
        return;
      }
      generateDemandPdf({
        target: 10,
        generatedAt: new Date().toISOString(),
        items: rows,
      });
    },
    [lensStock, toast]
  );

  // ── selected coating for the builder grid ───────────────────────
  const selectedItem = useMemo(
    () => lensStock.find((i) => i._id === selectedId) || null,
    [lensStock, selectedId]
  );

  const quantities = useMemo(() => {
    if (!selectedItem) return {};
    if (lensType === 'plain') return selectedItem.quantities?.sph || {};
    return selectedItem.quantities?.[lensType] || {};
  }, [selectedItem, lensType]);

  const isLocked = editing !== null && editing.status !== 'open';

  // ── loading skeleton ────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 pb-20 lg:pb-0 animate-page-enter">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-th-hover animate-pulse" />
          <div className="space-y-1.5">
            <div className="h-5 w-36 rounded bg-th-hover animate-pulse" />
            <div className="h-3 w-24 rounded bg-th-hover animate-pulse" />
          </div>
          <div className="ml-auto h-9 w-32 rounded-pill bg-th-hover animate-pulse" />
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-16 rounded-pill bg-th-hover animate-pulse" />
          ))}
        </div>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  // ── lists view ──────────────────────────────────────────────────
  if (view === 'lists') {
    const activeConfirm = confirm;
    const confirmMsg = activeConfirm
      ? activeConfirm.type === 'send'
        ? `Mark Demand #${activeConfirm.num} as sent? Once sent, the items are locked and cannot be changed.`
        : activeConfirm.type === 'close'
          ? `Close Demand #${activeConfirm.num}? It will move to closed history. Stock is not changed automatically.`
          : `Delete Demand #${activeConfirm.num}? Only open demand lists can be deleted.`
      : '';

    return (
      <div className="space-y-4 pb-20 lg:pb-0 animate-page-enter">
        {activeConfirm && (
          <ConfirmDialog
            message={confirmMsg}
            onConfirm={handleConfirm}
            onCancel={() => setConfirm(null)}
            confirmLabel={
              activeConfirm.type === 'delete'
                ? 'Delete'
                : activeConfirm.type === 'send'
                  ? 'Send'
                  : 'Close'
            }
            danger={activeConfirm.type === 'delete'}
          />
        )}

        {/* header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
            <ClipboardList size={22} className="text-primary-500" />
          </div>
          <div>
            <h1 className="text-feature font-bold text-th-text leading-tight">Demand</h1>
            <p className="text-small text-th-muted">
              {lists.length} list{lists.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={startNew}
            className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-pill bg-primary-500 text-surface-950 text-small-bold shadow-sm hover:scale-105 active:scale-95 transition-all"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">New Demand</span>
          </button>
        </div>

        {/* filter chips */}
        {lists.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {(['all', 'open', 'sent', 'closed'] as const).map((f) => {
              const active = filter === f;
              const label = f === 'all' ? 'All' : STATUS[f].label;
              const count = f === 'all' ? lists.length : lists.filter((l) => l.status === f).length;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-pill text-small-bold transition-all border ${
                    active
                      ? 'bg-primary-500 text-surface-950 border-primary-500 shadow-sm'
                      : 'bg-th-elevated text-th-secondary border-th-border hover:text-th-text'
                  }`}
                >
                  {label}
                  <span
                    className={`ml-1.5 text-micro font-bold ${active ? 'text-surface-950/70' : 'text-th-muted'}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* list rows */}
        {visibleLists.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={filter === 'all' ? 'No demand lists yet' : `No ${STATUS[filter]?.label ?? ''} lists`}
            message="Create a demand list to send to your supplier."
            action={filter === 'all' ? { label: 'New Demand', onClick: startNew } : undefined}
          />
        ) : (
          <div className="space-y-2.5">
            {visibleLists.map((list) => {
              const num = getNum(list._id);
              const meta = STATUS[list.status];
              const totalPairs = list.items.reduce((s, it) => s + it.qty, 0);
              return (
                <div
                  key={list._id}
                  className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-body-bold text-th-text font-bold">#{num}</span>
                      <span className={`px-2 py-0.5 rounded-pill text-micro font-bold ${meta.cls}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-small text-th-muted">
                      {list.items.length} item{list.items.length !== 1 ? 's' : ''}
                      {' · '}
                      {totalPairs > 0 ? fmtP(totalPairs) : 'empty'}
                      <span className="hidden sm:inline"> · by {list.createdBy || '—'}</span>
                    </p>
                    <p className="text-micro text-th-muted mt-0.5">
                      {list.status === 'sent' && list.sentAt
                        ? `Sent ${formatDateTime(list.sentAt)}`
                        : list.status === 'closed' && list.closedAt
                          ? `Closed ${formatDateTime(list.closedAt)}`
                          : formatDateTime(list.createdAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {list.status === 'open' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openList(list)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-small-bold bg-primary-500/15 text-primary-500 hover:bg-primary-500/25 transition-colors"
                        >
                          <Pencil size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleListPdf(list)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-small-bold bg-th-elevated text-th-secondary border border-th-border hover:text-th-text transition-colors"
                        >
                          <Download size={14} />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ type: 'send', id: list._id, num })}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-small-bold bg-th-elevated text-th-secondary border border-th-border hover:text-th-text transition-colors"
                        >
                          <Send size={14} />
                          Send
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ type: 'delete', id: list._id, num })}
                          className="p-2 rounded-pill text-small-bold text-negative hover:bg-negative/10 transition-colors"
                          title="Delete demand"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}

                    {list.status === 'sent' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openList(list)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-small-bold bg-th-elevated text-th-secondary border border-th-border hover:text-th-text transition-colors"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleListPdf(list)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-small-bold bg-th-elevated text-th-secondary border border-th-border hover:text-th-text transition-colors"
                        >
                          <Download size={14} />
                          PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirm({ type: 'close', id: list._id, num })}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-small-bold bg-th-elevated text-th-secondary border border-th-border hover:text-th-text transition-colors"
                        >
                          Close
                        </button>
                      </>
                    )}

                    {list.status === 'closed' && (
                      <>
                        <button
                          type="button"
                          onClick={() => openList(list)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-small-bold bg-th-elevated text-th-secondary border border-th-border hover:text-th-text transition-colors"
                        >
                          <Eye size={14} />
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleListPdf(list)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-pill text-small-bold bg-th-elevated text-th-secondary border border-th-border hover:text-th-text transition-colors"
                        >
                          <Download size={14} />
                          PDF
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── builder view ────────────────────────────────────────────────
  const statusMeta = editing ? STATUS[editing.status] : null;
  const editingNum = editing ? getNum(editing._id) : 0;

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0 animate-page-enter">
      {confirm && (
        <ConfirmDialog
          message={
            confirm.type === 'send'
              ? `Mark Demand #${confirm.num} as sent? Once sent, the items are locked and cannot be changed.`
              : confirm.type === 'close'
                ? `Close Demand #${confirm.num}? It will move to closed history.`
                : `Delete Demand #${confirm.num}?`
          }
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
          confirmLabel={
            confirm.type === 'delete' ? 'Delete' : confirm.type === 'send' ? 'Send' : 'Close'
          }
          danger={confirm.type === 'delete'}
        />
      )}

      {/* header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setView('lists')}
          className="p-2 hover:bg-th-hover rounded-lg text-th-muted hover:text-th-text transition-colors"
          aria-label="Back to lists"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-body-bold font-bold text-th-text truncate">
              {editing ? (
                <>
                  Demand <span className="text-primary-500">#{editingNum}</span>
                </>
              ) : (
                'New Demand'
              )}
            </h1>
            {statusMeta && (
              <span className={`px-2 py-0.5 rounded-pill text-micro font-bold ${statusMeta.cls}`}>
                {statusMeta.label}
              </span>
            )}
          </div>
          {editing && (
            <p className="text-small text-th-muted">
              {editing.items.length} item{editing.items.length !== 1 ? 's' : ''} · by{' '}
              {editing.createdBy || '—'}
            </p>
          )}
        </div>
      </div>

      {/* locked banner */}
      {isLocked && (
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-400/10 border border-amber-400/30 rounded-xl text-small text-th-secondary">
          <Lock size={16} className="shrink-0 text-amber-500" />
          <span>
            This demand has been {editing?.status === 'sent' ? 'sent' : 'closed'}
            {editing?.sentAt ? ` on ${formatDateTime(editing.sentAt)}` : ''}. Items are locked.
          </span>
        </div>
      )}

      {/* fill target stepper */}
      <div className="flex items-center gap-2 px-3 py-2 bg-th-surface border border-th-border rounded-xl">
        <span className="text-small-bold text-th-secondary shrink-0">Fill target</span>
        {!isLocked && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDemandTarget((t) => Math.max(0.5, Math.round((t - 0.5) * 2) / 2))}
              className="w-7 h-7 rounded-lg bg-th-elevated text-th-secondary hover:text-th-text flex items-center justify-center"
              aria-label="Decrease target"
            >
              <Minus size={12} />
            </button>
            <input
              type="number"
              name="demand-target"
              min={0.5}
              step={0.5}
              value={demandTarget}
              onChange={(e) =>
                setDemandTarget(Math.max(0.5, Math.round((Number(e.target.value) || 0.5) * 2) / 2))
              }
              className="w-14 h-7 text-center text-small-bold bg-th-input text-th-text border border-th-border rounded-lg focus:outline-none focus:border-primary-500"
              aria-label="Target stock level"
            />
            <span className="text-small-bold text-th-secondary">p</span>
            <button
              type="button"
              onClick={() => setDemandTarget((t) => Math.round((t + 0.5) * 2) / 2)}
              className="w-7 h-7 rounded-lg bg-th-elevated text-th-secondary hover:text-th-text flex items-center justify-center"
              aria-label="Increase target"
            >
              <Plus size={12} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLocked ? 'bg-amber-500' : 'bg-primary-500'}`}
          />
          <span className="text-small text-th-muted hidden sm:inline">
            {editing?.status === 'sent' ? 'Mark as sent' : 'Mark as sent → Close'}
          </span>
        </div>
      </div>

      {/* mobile: coating select + tabs */}
      <div className="lg:hidden space-y-2.5">
        <div className="relative">
          <select
            name="demand-coating"
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={isLocked}
            className="w-full px-3.5 py-3 rounded-xl bg-th-surface border border-th-border text-small-bold text-th-text appearance-none cursor-pointer pr-10 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {lensStock.map((item) => (
              <option key={item._id} value={item._id}>
                {item.coating} · {getTotalQty(item) > 0 ? fmtPairs(getTotalQty(item)) : 'Empty'}
              </option>
            ))}
          </select>
          <ChevronDown
            size={18}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-th-muted pointer-events-none"
          />
        </div>
        <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5">
          {DEMAND_TABS.map((t) => (
            <button
              type="button"
              key={t.key}
              onClick={() => setLensType(t.key)}
              className={`flex-1 px-2 py-2.5 rounded-pill text-small-bold transition-all ${
                lensType === t.key ? 'bg-primary-500 text-surface-950 shadow-sm' : 'text-th-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* desktop: sidebar + content */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="hidden lg:flex w-60 shrink-0 card p-4 flex-col overflow-hidden">
          <h3 className="text-small font-bold text-th-text uppercase tracking-wider mb-4 flex items-center justify-between">
            Coatings
            <span className="px-2 py-0.5 rounded-pill bg-th-elevated text-th-muted text-micro font-bold">
              {lensStock.length}
            </span>
          </h3>
          <div className="flex-1 overflow-auto scrollbar-thin space-y-1.5">
            {lensStock.map((item) => {
              const total = getTotalQty(item);
              const isActive = item._id === selectedId;
              return (
                <div
                  key={item._id}
                  onClick={() => setSelectedId(item._id)}
                  className={`flex items-center gap-3 px-3.5 py-3.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-primary-500/10 border border-primary-500/30 shadow-sm ring-1 ring-primary-500/10'
                      : 'hover:bg-th-elevated border border-transparent hover:border-th-border'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-small-bold truncate ${isActive ? 'text-th-text' : 'text-th-secondary'}`}
                    >
                      {item.coating}
                    </div>
                    <div
                      className={`text-small mt-0.5 font-medium ${total > 0 ? 'text-primary-500' : 'text-th-muted'}`}
                    >
                      {total > 0 ? `${fmtPairs(total)} in stock` : 'Empty'}
                    </div>
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1">
                    <span className="text-small font-bold text-th-muted whitespace-nowrap">
                      −₹{item.priceNeg ?? 0}/+₹{item.pricePos ?? 0}
                    </span>
                    {total > 0 && (
                      <span className="px-2 py-0.5 rounded-pill text-micro font-bold bg-primary-500/15 text-primary-500">
                        {fmtPairs(total)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 card p-2 sm:p-3 lg:p-4 overflow-hidden flex flex-col">
          {selectedItem ? (
            <>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-th-border">
                <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                <span className="text-body-bold font-bold text-th-text truncate">
                  {selectedItem.coating}
                </span>
                <span className="text-small-bold text-primary-500 shrink-0">
                  −₹{selectedItem.priceNeg ?? 0}/+₹{selectedItem.pricePos ?? 0}
                </span>
                <div className="ml-auto hidden lg:flex gap-1 bg-th-elevated rounded-pill p-1">
                  {DEMAND_TABS.map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      onClick={() => setLensType(t.key)}
                      className={`px-3.5 py-2 rounded-pill text-small-bold transition-all ${
                        lensType === t.key
                          ? 'bg-primary-500 text-surface-950 shadow-sm'
                          : 'text-th-secondary hover:text-th-text'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                {lensType === 'compound' ? (
                  <DemandCompoundView
                    coating={selectedItem.coating}
                    quantities={quantities}
                    demandTarget={demandTarget}
                    getDemandQty={(key) => demandSel.get(key) || 0}
                    onToggleDemand={incrementDemand}
                    onRemoveDemand={removeDemand}
                    disabled={isLocked}
                  />
                ) : lensType === 'plain' ? (
                  <DemandPlainView
                    coating={selectedItem.coating}
                    quantities={quantities}
                    demandTarget={demandTarget}
                    getDemandQty={(key) => demandSel.get(key) || 0}
                    onToggleDemand={incrementDemand}
                    onRemoveDemand={removeDemand}
                    disabled={isLocked}
                  />
                ) : (
                  <DemandFlatGrid
                    coating={selectedItem.coating}
                    quantities={quantities}
                    lensType={lensType as LensType}
                    demandTarget={demandTarget}
                    getDemandQty={(key) => demandSel.get(key) || 0}
                    onToggleDemand={incrementDemand}
                    onRemoveDemand={removeDemand}
                    disabled={isLocked}
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-14 h-14 rounded-full bg-th-elevated flex items-center justify-center">
                <ClipboardList size={24} className="text-th-muted" />
              </div>
              <p className="text-th-muted text-body font-bold">Select a coating to build demand</p>
            </div>
          )}
        </div>
      </div>

      {/* sticky bottom action bar */}
      <div className="sticky bottom-[72px] lg:bottom-2 z-20">
        <div className="bg-th-surface border border-th-border rounded-xl px-3.5 py-3 shadow-lifted flex flex-col sm:flex-row items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <ClipboardList size={18} className="text-primary-500 shrink-0" />
            <span className="text-small-bold text-th-text">
              {demandSel.size} lens{demandSel.size !== 1 ? 'es' : ''} selected
            </span>
            <span className="text-small text-th-muted hidden md:inline">·</span>
            <span className="text-small text-th-secondary hidden md:inline">
              <span className="text-primary-500 font-bold">{fmtP(totalNeed)}</span> to buy
            </span>
            <span className="text-small text-th-secondary hidden lg:inline">
              ·{' '}
              <span className="text-primary-500 font-bold">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {!isLocked && (
              <>
                <button
                  type="button"
                  onClick={selectAllLowStock}
                  className="px-3.5 py-2 rounded-pill bg-th-elevated text-th-secondary hover:text-th-text text-small-bold border border-th-border"
                >
                  All low stock
                </button>
                <button
                  type="button"
                  onClick={() => setEntries([])}
                  disabled={demandSel.size === 0}
                  className="px-3.5 py-2 rounded-pill bg-th-elevated text-th-secondary hover:text-negative text-small-bold border border-th-border disabled:opacity-40"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || demandSel.size === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-pill bg-primary-500 text-surface-950 text-small-bold shadow-sm hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Save
                </button>
                {editing && editing.status === 'open' && (
                  <button
                    type="button"
                    onClick={() => setConfirm({ type: 'send', id: editing._id, num: editingNum })}
                    disabled={saving || demandSel.size === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-pill bg-amber-500 text-surface-950 text-small-bold shadow-sm hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Send size={14} />
                    Mark as sent
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={handlePdf}
              disabled={demandRows.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-pill bg-th-elevated text-th-secondary hover:text-th-text text-small-bold border border-th-border disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download size={14} />
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
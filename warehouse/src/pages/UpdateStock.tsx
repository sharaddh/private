import { useState, useEffect, useCallback, useMemo } from 'react';
import type { LensStockItem } from '../types/lensStock';
import api from '../api';
import { useToast } from '../context';
import CoatingList from '../components/lens/CoatingList';
import LensGrid from '../components/lens/LensGrid';
import { formatCurrency, fmtPairs } from '../utils/helpers';
import { PackagePlus, Plus, Check, X, Pencil, Trash2 } from 'lucide-react';

function getTotalQty(item: LensStockItem): number {
  const q = (item.quantities as Record<string, Record<string, number>>) || {};
  let total = 0;
  for (const lensType of ['sph', 'cyl', 'compound']) {
    const map = q[lensType];
    if (map) {
      for (const v of Object.values(map)) {
        total += v as number;
      }
    }
  }
  return total;
}

function UpdateStockSkeleton() {
  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-th-hover animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-5 w-36 rounded bg-th-hover animate-pulse" />
          <div className="h-3 w-24 rounded bg-th-hover animate-pulse" />
        </div>
      </div>

      {/* Mobile: coating strip */}
      <div className="lg:hidden space-y-2">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="shrink-0 w-24 h-20 rounded-xl bg-th-hover animate-pulse" />
          ))}
        </div>
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="hidden lg:flex w-72 shrink-0 card p-4 flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-th-hover animate-pulse" />
          ))}
        </div>
        <div className="flex-1 card p-3 lg:p-4">
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-th-border">
            <div className="w-2 h-2 rounded-full bg-th-hover animate-pulse shrink-0" />
            <div className="h-4 w-32 rounded bg-th-hover animate-pulse" />
            <div className="ml-auto h-7 w-24 rounded-lg bg-th-hover animate-pulse" />
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 gap-1.5">
            {Array.from({ length: 14 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-th-hover animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function UpdateStock() {
  const [items, setItems] = useState<LensStockItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileAdding, setMobileAdding] = useState(false);
  const [mobileNewName, setMobileNewName] = useState('');
  const [mobileNewPriceNeg, setMobileNewPriceNeg] = useState('');
  const [mobileNewPricePos, setMobileNewPricePos] = useState('');
  const [mobileRenaming, setMobileRenaming] = useState(false);
  const [mobileRenameName, setMobileRenameName] = useState('');
  const [mobileRenamePriceNeg, setMobileRenamePriceNeg] = useState('');
  const [mobileRenamePricePos, setMobileRenamePricePos] = useState('');
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceNegDraft, setPriceNegDraft] = useState('');
  const [pricePosDraft, setPricePosDraft] = useState('');
  const { toast } = useToast();

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await api.get<LensStockItem[]>('/api/warehouse/lens-stock/list');
    if (res.success && res.data) {
      setItems(res.data);
      if (res.data.length > 0 && !selectedId) {
        setSelectedId(res.data[0]._id);
      }
    } else {
      toast(res.message || 'Failed to load lens stock', 'error');
    }
    setLoading(false);
  }, [selectedId, toast]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const selectedItem = useMemo(
    () => items.find((i) => i._id === selectedId) || null,
    [items, selectedId]
  );

  const handleAdd = useCallback((item: LensStockItem) => {
    setItems((prev) => [...prev, item]);
    setSelectedId(item._id);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setItems((prev) => {
        const next = prev.filter((i) => i._id !== id);
        if (selectedId === id) {
          setSelectedId(next.length > 0 ? next[0]._id : null);
        }
        return next;
      });
    },
    [selectedId]
  );

  const handleRename = useCallback(
    (id: string, coating: string, priceNeg: number, pricePos: number) => {
      setItems((prev) =>
        prev.map((i) => (i._id === id ? { ...i, coating, priceNeg, pricePos, price: priceNeg } : i))
      );
    },
    []
  );

  const handleGridUpdate = useCallback((updated: LensStockItem) => {
    setItems((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
  }, []);

  const handleMobileAdd = useCallback(async () => {
    const name = mobileNewName.trim();
    if (!name) return;
    const priceNeg = mobileNewPriceNeg.trim() === '' ? 0 : Number(mobileNewPriceNeg);
    const pricePos = mobileNewPricePos.trim() === '' ? 0 : Number(mobileNewPricePos);
    if (Number.isNaN(priceNeg) || priceNeg < 0 || Number.isNaN(pricePos) || pricePos < 0) {
      toast('Enter valid prices', 'error');
      return;
    }
    const res = await api.post<LensStockItem>('/api/warehouse/lens-stock', {
      coating: name,
      priceNeg,
      pricePos,
    });
    if (res.success && res.data) {
      setItems((prev) => [...prev, res.data!]);
      setSelectedId(res.data!._id);
      setMobileNewName('');
      setMobileNewPriceNeg('');
      setMobileNewPricePos('');
      setMobileAdding(false);
      toast('Coating added', 'success');
    } else {
      toast(res.message || 'Failed to add', 'error');
    }
  }, [mobileNewName, mobileNewPriceNeg, mobileNewPricePos, toast]);

  const startMobileRename = useCallback(() => {
    if (!selectedItem) return;
    setMobileRenameName(selectedItem.coating);
    setMobileRenamePriceNeg(String(selectedItem.priceNeg ?? selectedItem.price ?? 0));
    setMobileRenamePricePos(String(selectedItem.pricePos ?? selectedItem.price ?? 0));
    setMobileRenaming(true);
  }, [selectedItem]);

  const cancelMobileRename = useCallback(() => {
    setMobileRenaming(false);
    setMobileRenameName('');
    setMobileRenamePriceNeg('');
    setMobileRenamePricePos('');
  }, []);

  const handleMobileRename = useCallback(async () => {
    if (!selectedItem) return;
    const name = mobileRenameName.trim();
    if (!name) {
      toast('Enter a coating name', 'error');
      return;
    }
    const priceNeg = mobileRenamePriceNeg.trim() === '' ? 0 : Number(mobileRenamePriceNeg);
    const pricePos = mobileRenamePricePos.trim() === '' ? 0 : Number(mobileRenamePricePos);
    if (Number.isNaN(priceNeg) || priceNeg < 0 || Number.isNaN(pricePos) || pricePos < 0) {
      toast('Enter valid prices', 'error');
      return;
    }
    const res = await api.put<LensStockItem>(`/api/warehouse/lens-stock/${selectedItem._id}`, {
      coating: name,
      priceNeg,
      pricePos,
    });
    if (res.success && res.data) {
      handleGridUpdate(res.data);
      setMobileRenaming(false);
      toast('Coating updated', 'success');
    } else {
      toast(res.message || 'Failed to update coating', 'error');
    }
  }, [selectedItem, mobileRenameName, mobileRenamePriceNeg, mobileRenamePricePos, toast, handleGridUpdate]);

  const handleMobileDelete = useCallback(
    (item: LensStockItem) => {
      if (!confirm(`Delete "${item.coating}"?`)) return;
      const run = async () => {
        const res = await api.del(`/api/warehouse/lens-stock/${item._id}`);
        if (res.success) {
          handleDelete(item._id);
          toast('Coating deleted', 'success');
        } else {
          toast(res.message || 'Failed to delete coating', 'error');
        }
      };
      void run();
    },
    [handleDelete, toast]
  );

  const savePrice = useCallback(async () => {
    if (!selectedItem) return;
    const priceNeg = priceNegDraft.trim() === '' ? 0 : Number(priceNegDraft);
    const pricePos = pricePosDraft.trim() === '' ? 0 : Number(pricePosDraft);
    if (Number.isNaN(priceNeg) || priceNeg < 0 || Number.isNaN(pricePos) || pricePos < 0) {
      toast('Enter valid prices', 'error');
      return;
    }
    const res = await api.put<LensStockItem>(`/api/warehouse/lens-stock/${selectedItem._id}`, {
      coating: selectedItem.coating,
      priceNeg,
      pricePos,
    });
    if (res.success && res.data) {
      handleGridUpdate(res.data);
      setEditingPrice(false);
      toast('Prices updated', 'success');
    } else {
      toast(res.message || 'Failed to update prices', 'error');
    }
  }, [selectedItem, priceNegDraft, pricePosDraft, toast, handleGridUpdate]);

  const startPriceEdit = useCallback(() => {
    if (!selectedItem) return;
    setPriceNegDraft(String(selectedItem.priceNeg ?? selectedItem.price ?? 0));
    setPricePosDraft(String(selectedItem.pricePos ?? selectedItem.price ?? 0));
    setEditingPrice(true);
  }, [selectedItem]);

  const cancelPriceEdit = useCallback(() => {
    setEditingPrice(false);
    setPriceNegDraft('');
    setPricePosDraft('');
  }, []);

  if (loading) return <UpdateStockSkeleton />;

  return (
    <div className="h-full flex flex-col gap-3 pb-20 lg:pb-0 animate-page-enter">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
          <PackagePlus size={22} className="text-primary-500" />
        </div>
        <div>
          <h1 className="text-feature font-bold text-th-text leading-tight">Update Stock</h1>
          <p className="text-small text-th-muted">
            {items.length} coating{items.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Mobile: coating strip */}
      <div className="lg:hidden">
        {mobileAdding ? (
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex gap-2">
              <input
                autoFocus
                value={mobileNewName}
                onChange={(e) => setMobileNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMobileAdd();
                  if (e.key === 'Escape') {
                    setMobileAdding(false);
                    setMobileNewName('');
                    setMobileNewPriceNeg('');
                    setMobileNewPricePos('');
                  }
                }}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                placeholder="Coating name..."
              />
              <button
                onClick={handleMobileAdd}
                className="p-2.5 rounded-xl bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors"
              >
                <Check size={20} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => {
                  setMobileAdding(false);
                  setMobileNewName('');
                  setMobileNewPriceNeg('');
                  setMobileNewPricePos('');
                }}
                className="p-2.5 rounded-xl bg-th-elevated text-th-muted hover:text-th-text transition-colors"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 flex-1">
                <span className="text-small font-bold text-th-muted shrink-0">−₹</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={mobileNewPriceNeg}
                  onChange={(e) => setMobileNewPriceNeg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleMobileAdd();
                  }}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                  placeholder="Neg price"
                />
              </div>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-small font-bold text-th-muted shrink-0">+₹</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={mobileNewPricePos}
                  onChange={(e) => setMobileNewPricePos(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleMobileAdd();
                  }}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                  placeholder="Pos price"
                />
              </div>
            </div>
          </div>
        ) : mobileRenaming ? (
          <div className="flex flex-col gap-2 mb-2">
            <div className="flex gap-2">
              <input
                autoFocus
                value={mobileRenameName}
                onChange={(e) => setMobileRenameName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleMobileRename();
                  if (e.key === 'Escape') cancelMobileRename();
                }}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                placeholder="Coating name..."
              />
              <button
                onClick={handleMobileRename}
                className="p-2.5 rounded-xl bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors"
              >
                <Check size={20} strokeWidth={2.5} />
              </button>
              <button
                onClick={cancelMobileRename}
                className="p-2.5 rounded-xl bg-th-elevated text-th-muted hover:text-th-text transition-colors"
              >
                <X size={20} strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex gap-2">
              <div className="flex items-center gap-1 flex-1">
                <span className="text-small font-bold text-th-muted shrink-0">−₹</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={mobileRenamePriceNeg}
                  onChange={(e) => setMobileRenamePriceNeg(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleMobileRename();
                  }}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                  placeholder="Neg price"
                />
              </div>
              <div className="flex items-center gap-1 flex-1">
                <span className="text-small font-bold text-th-muted shrink-0">+₹</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={mobileRenamePricePos}
                  onChange={(e) => setMobileRenamePricePos(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleMobileRename();
                  }}
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-th-input border border-th-border text-small font-bold text-th-text placeholder:text-th-muted focus:outline-none focus:border-primary-500"
                  placeholder="Pos price"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {items.map((item) => {
              const total = getTotalQty(item);
              const isSelected = item._id === selectedId;
              return (
                <button
                  key={item._id}
                  onClick={() => setSelectedId(item._id)}
                  className={`shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2.5 min-w-[96px] rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-primary-500/10 border-primary-500/30 ring-1 ring-primary-500/10'
                      : 'border-th-border hover:border-th-border-med bg-th-surface'
                  }`}
                >
                  <span
                    className={`text-small font-bold w-full text-center leading-snug ${isSelected ? 'text-th-text' : 'text-th-secondary'}`}
                  >
                    {item.coating}
                  </span>
                  <span
                    className={`text-small font-medium ${total > 0 ? 'text-primary-500' : 'text-th-muted'}`}
                  >
                    {total > 0 ? `${fmtPairs(total)} in stock` : 'Empty'}
                  </span>
                  <span className="text-small font-bold text-th-muted">
                    {item.priceNeg || item.pricePos
                      ? `−${formatCurrency(item.priceNeg ?? 0)}/+${formatCurrency(item.pricePos ?? 0)}`
                      : 'Free'}
                  </span>
                </button>
              );
            })}
            <button
              onClick={() => {
                setMobileAdding(true);
                setMobileNewName('');
                setMobileNewPriceNeg('');
                setMobileNewPricePos('');
              }}
              className="shrink-0 flex flex-col items-center justify-center gap-1 px-3 py-2.5 min-w-[96px] rounded-xl border border-dashed border-th-border hover:border-primary-500/50 bg-th-surface hover:bg-primary-500/5 transition-all"
            >
              <Plus size={20} className="text-primary-500" />
              <span className="text-small font-bold text-th-muted">Add</span>
            </button>
          </div>
          {selectedItem && (
            <div className="flex items-center gap-2">
              <button
                onClick={startMobileRename}
                className="flex items-center justify-center gap-1.5 flex-1 px-3.5 py-2.5 rounded-xl bg-th-elevated text-th-text hover:bg-th-elevated/80 text-small-bold active:scale-95 transition-all"
              >
                <Pencil size={15} />
                Rename
              </button>
              <button
                onClick={() => handleMobileDelete(selectedItem)}
                className="flex items-center justify-center gap-1.5 flex-1 px-3.5 py-2.5 rounded-xl bg-negative/10 text-negative hover:bg-negative/20 text-small-bold active:scale-95 transition-all"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Desktop: sidebar + content */}
      <div className="flex-1 flex gap-4 min-h-0">
        <div className="hidden lg:flex w-72 shrink-0 card p-4 flex-col overflow-hidden">
          <CoatingList
            items={items}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        </div>

        <div className="flex-1 card p-2 sm:p-3 lg:p-4 overflow-hidden flex flex-col">
          {selectedItem ? (
            <>
              <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-th-border min-w-0">
                <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                <span className="text-body-bold font-bold text-th-text truncate min-w-0">
                  {selectedItem.coating}
                </span>
                {editingPrice ? (
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className="text-small font-bold text-th-muted">Neg ₹</span>
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceNegDraft}
                      onChange={(e) => setPriceNegDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') savePrice();
                        if (e.key === 'Escape') cancelPriceEdit();
                      }}
                      className="w-24 px-2.5 py-1.5 rounded-lg bg-th-input border border-th-border text-small font-bold text-th-text focus:outline-none focus:border-primary-500"
                    />
                    <span className="text-small font-bold text-th-muted">Pos ₹</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={pricePosDraft}
                      onChange={(e) => setPricePosDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') savePrice();
                        if (e.key === 'Escape') cancelPriceEdit();
                      }}
                      className="w-24 px-2.5 py-1.5 rounded-lg bg-th-input border border-th-border text-small font-bold text-th-text focus:outline-none focus:border-primary-500"
                    />
                    <button
                      onClick={savePrice}
                      className="p-2 rounded-md bg-primary-500/20 text-primary-500 hover:bg-primary-500/30 transition-colors"
                    >
                      <Check size={16} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={cancelPriceEdit}
                      className="p-2 rounded-md bg-th-elevated text-th-muted hover:text-th-text transition-colors"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={startPriceEdit}
                    className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-th-elevated text-primary-500 hover:bg-primary-500/10 text-small font-bold transition-colors"
                    title="Edit prices"
                  >
                    <span>
                      −{formatCurrency(selectedItem.priceNeg ?? 0)} / +
                      {formatCurrency(selectedItem.pricePos ?? 0)}
                    </span>
                    <Pencil size={14} />
                  </button>
                )}
              </div>
              <div className="flex-1 overflow-auto">
                <LensGrid item={selectedItem} onUpdate={handleGridUpdate} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="w-14 h-14 rounded-full bg-th-elevated flex items-center justify-center">
                <PackagePlus size={24} className="text-th-muted" />
              </div>
              <p className="text-th-muted text-body font-bold">Select a coating to update</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

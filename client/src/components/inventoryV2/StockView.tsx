import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Search,
  RefreshCw,
  PackagePlus,
  Eye,
  Hand,
  SlidersHorizontal,
  Pencil,
  Copy,
  MoreHorizontal,
} from 'lucide-react';
import { useV2Variants, useV2Brands, useV2Racks } from '../../hooks';
import { PRODUCT_CATEGORIES, type InventoryVariant } from '../../types/inventoryV2';
import { Pagination, formatCurrency, itemLabel, stockTextClass } from './shared';
import { SkeletonTable } from '../Skeleton';
import { type StockActionState, VariantDetailPanel, StockEmpty } from './StockActions';

const PAGE_SIZE = 20;
const STOCK_FILTERS = [
  { value: 'all', label: 'All stock' },
  { value: 'in', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
] as const;

function RowMenu({
  variant,
  onAction,
  onSelect,
}: {
  variant: InventoryVariant;
  onAction: (a: StockActionState) => void;
  onSelect: (v: InventoryVariant) => void;
}) {
  const [open, setOpen] = useState(false);
  const items = [
    { label: 'View details', icon: Eye, run: () => onSelect(variant) },
    { label: 'Add stock', icon: PackagePlus, run: () => onAction({ type: 'add', variant }) },
    { label: 'Withdraw', icon: Hand, run: () => onAction({ type: 'withdraw', variant }) },
    { label: 'Adjust', icon: SlidersHorizontal, run: () => onAction({ type: 'adjust', variant }) },
    { label: 'Duplicate', icon: Copy, run: () => onAction({ type: 'new', variant }) },
    { label: 'Edit', icon: Pencil, run: () => onAction({ type: 'edit', variant }) },
  ];
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary"
        aria-label="More actions"
      >
        <MoreHorizontal size={15} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-th-border bg-th-surface shadow-xl py-1">
            {items.map((i) => {
              const Icon = i.icon;
              return (
                <button
                  key={i.label}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    i.run();
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-th-text hover:bg-th-hover"
                >
                  <Icon size={14} className="text-th-secondary" /> {i.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export default function StockView({
  onAction,
  refreshKey,
  onRefresh,
  onNewItem,
}: {
  onAction: (a: StockActionState) => void;
  refreshKey: number;
  onRefresh: () => void;
  onNewItem: () => void;
}) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('All');
  const [stock, setStock] = useState<string>('all');
  const [threshold, setThreshold] = useState(5);
  const [brandId, setBrandId] = useState('');
  const [rackId, setRackId] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InventoryVariant | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const { variants, total, pages, loading, refetch } = useV2Variants({
    page,
    limit: PAGE_SIZE,
    search: debounced.trim() || undefined,
    category: category !== 'All' ? category : undefined,
    stock: stock === 'all' ? undefined : (stock as 'in' | 'low' | 'out'),
    threshold: stock === 'low' ? threshold : undefined,
    brandId: brandId || undefined,
    rackId: rackId || undefined,
  });
  const { brands } = useV2Brands(threshold);
  const { racks } = useV2Racks();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebounced(search), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debounced, category, stock, threshold, brandId, rackId]);
  useEffect(() => {
    void refetch();
  }, [refreshKey, refetch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-th-secondary">
          {total} item{total === 1 ? '' : 's'} in stock
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetch()}
            className="btn-secondary flex items-center gap-2"
            aria-label="Refresh"
          >
            <RefreshCw size={15} /> Refresh
          </button>
          <button
            onClick={onNewItem}
            className="btn-primary flex items-center gap-2"
            aria-label="Add item"
          >
            <Plus size={16} /> New Item
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary"
          />
          <input
            type="text"
            placeholder="Search by SKU, brand, model, colour..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-th-elevated text-th-text placeholder-th-muted text-sm"
            style={{ border: 'rgb(124,124,124) 0px 0px 0px 1px inset' }}
            aria-label="Search stock"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input-field w-auto"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="Filter by category"
          >
            <option value="All">All categories</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            className="input-field w-auto"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            aria-label="Filter by stock"
          >
            {STOCK_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {stock === 'low' && (
            <select
              className="input-field w-auto"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              aria-label="Low stock threshold"
            >
              {[3, 5, 10, 20].map((t) => (
                <option key={t} value={t}>
                  ≤ {t}
                </option>
              ))}
            </select>
          )}
          <select
            className="input-field w-auto"
            value={brandId}
            onChange={(e) => setBrandId(e.target.value)}
            aria-label="Filter by brand"
          >
            <option value="">All brands</option>
            {brands.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            className="input-field w-auto"
            value={rackId}
            onChange={(e) => setRackId(e.target.value)}
            aria-label="Filter by rack"
          >
            <option value="">All racks</option>
            {racks.map((r) => (
              <option key={r._id} value={r._id}>
                {r.code}
                {r.section ? ` · ${r.section}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !variants.length ? (
        <SkeletonTable rows={6} cols={7} />
      ) : variants.length === 0 ? (
        <StockEmpty onNew={onNewItem} />
      ) : (
        <div className="overflow-x-auto bg-th-surface rounded-[8px]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-hover bg-th-base">
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">
                  Item
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">
                  Rack
                </th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">
                  Price
                </th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-border">
              {variants.map((v) => (
                <tr
                  key={v._id}
                  className="hover:bg-th-card transition-colors cursor-pointer"
                  onClick={() => setSelected(v)}
                >
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-sm text-th-text">
                    {v.sku}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-th-text">
                    {itemLabel(v)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="badge badge-blue">{v.category || '—'}</span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-th-secondary">
                    {v.rackLabel || '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <span className={`font-semibold ${stockTextClass(v.stockQuantity, threshold)}`}>
                      {v.stockQuantity}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-th-text">
                    {formatCurrency(v.defaultSellingPrice)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onAction({ type: 'add', variant: v })}
                        className="p-1.5 hover:bg-[#1ed760]/10 rounded-lg text-[#1ed760]"
                        aria-label="Add stock"
                      >
                        <PackagePlus size={15} />
                      </button>
                      <RowMenu variant={v} onAction={onAction} onSelect={setSelected} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />

      {selected && (
        <VariantDetailPanel
          variant={selected}
          onClose={() => setSelected(null)}
          onAction={onAction}
          onDone={onRefresh}
        />
      )}
    </div>
  );
}

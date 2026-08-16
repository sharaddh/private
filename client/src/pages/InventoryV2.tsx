import { useState } from 'react';
import { LayoutDashboard, Boxes, History, Settings2, type LucideIcon } from 'lucide-react';
import OverviewView from '../components/inventoryV2/OverviewView';
import StockView from '../components/inventoryV2/StockView';
import HistoryView from '../components/inventoryV2/HistoryView';
import ManageView from '../components/inventoryV2/ManageView';
import {
  AddStockModal,
  WithdrawModal,
  AdjustModal,
  NewItemModal,
  EditVariantModal,
  type StockActionState,
} from '../components/inventoryV2/StockActions';
import type { InventoryVariant } from '../types/inventoryV2';

type SectionKey = 'overview' | 'stock' | 'history' | 'manage';

const SECTIONS: Array<{ key: SectionKey; label: string; icon: LucideIcon }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'stock', label: 'Stock', icon: Boxes },
  { key: 'history', label: 'History', icon: History },
  { key: 'manage', label: 'Manage', icon: Settings2 },
];

export default function InventoryV2() {
  const [active, setActive] = useState<SectionKey>('overview');
  const [action, setAction] = useState<StockActionState | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [openCountCreate, setOpenCountCreate] = useState(false);

  const refresh = () => setRefreshKey((k) => k + 1);
  const closeAction = () => setAction(null);
  const openAction = (a: StockActionState) => setAction(a);

  const startCount = () => {
    setActive('manage');
    setOpenCountCreate(true);
  };

  const handleDone = (existing?: InventoryVariant) => {
    closeAction();
    if (existing) openAction({ type: 'add', variant: existing });
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Inventory</h1>
        <p className="text-sm text-muted-500 mt-1">
          Everything about your stock — items, purchases, withdrawals and counts.
        </p>
      </div>

      <div className="flex gap-1 bg-th-elevated rounded-pill p-1 w-fit max-w-full overflow-x-auto">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-pill text-small-bold whitespace-nowrap transition-all active:scale-95 ${
                active === s.key
                  ? 'bg-primary-500 text-surface-950 shadow-sm'
                  : 'text-th-secondary hover:text-th-text'
              }`}
            >
              <Icon size={15} />
              {s.label}
            </button>
          );
        })}
      </div>

      {active === 'overview' && (
        <OverviewView
          onAction={openAction}
          onStartCount={startCount}
          onShowStock={() => setActive('stock')}
        />
      )}
      {active === 'stock' && (
        <StockView
          onAction={openAction}
          refreshKey={refreshKey}
          onRefresh={refresh}
          onNewItem={() => openAction({ type: 'new' })}
        />
      )}
      {active === 'history' && <HistoryView refreshKey={refreshKey} />}
      {active === 'manage' && (
        <ManageView
          refreshKey={refreshKey}
          openCountCreate={openCountCreate}
          onCountCreateHandled={() => setOpenCountCreate(false)}
        />
      )}

      <AddStockModal
        open={action?.type === 'add'}
        variant={action?.variant}
        onClose={closeAction}
        onDone={handleDone}
      />
      <WithdrawModal
        open={action?.type === 'withdraw'}
        variant={action?.variant}
        onClose={closeAction}
        onDone={handleDone}
      />
      <AdjustModal
        open={action?.type === 'adjust'}
        variant={action?.variant}
        onClose={closeAction}
        onDone={handleDone}
      />
      <EditVariantModal
        open={action?.type === 'edit'}
        variant={action?.variant}
        onClose={closeAction}
        onDone={handleDone}
      />
      <NewItemModal
        open={action?.type === 'new'}
        variant={action?.variant}
        onClose={closeAction}
        onDone={handleDone}
      />
    </div>
  );
}

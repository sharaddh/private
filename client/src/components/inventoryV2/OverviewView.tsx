import { useMemo, useState } from "react";
import {
  Package, Boxes, AlertTriangle, PackageX, Building2, Wallet, IndianRupee,
  Activity, RefreshCw, PackagePlus, ClipboardList, Hand, Layers, ChevronRight, ArrowUpRight,
} from "lucide-react";
import { useV2Dashboard, useV2Variants } from "../../hooks";
import { formatDateTime, formatCurrency, movementLabel, movementTone, StockStatusBadge, itemLabel, QuickActionButton, PageSection } from "./shared";
import PageSkeleton from "../PageSkeleton";
import type { StockActionState } from "./StockActions";

const THRESHOLD_OPTIONS = [3, 5, 10, 20];

export default function OverviewView({ onAction, onStartCount, onShowStock }: {
  onAction: (a: StockActionState) => void;
  onStartCount: () => void;
  onShowStock: () => void;
}) {
  const [threshold, setThreshold] = useState(5);
  const { dashboard, loading, refetch } = useV2Dashboard(threshold);
  const { variants: lowItems } = useV2Variants({ limit: 5, stock: "low", threshold });
  const { variants: outItems } = useV2Variants({ limit: 5, stock: "out" });

  const stats = useMemo(
    () =>
      dashboard
        ? [
            { label: "Items (SKUs)", value: dashboard.variants, icon: Layers, tone: "text-sky-400" },
            { label: "Stock Units", value: dashboard.stockUnits, icon: Package, tone: "text-th-text" },
            { label: "Low Stock", value: dashboard.lowStock, icon: AlertTriangle, tone: "text-amber-400" },
            { label: "Out of Stock", value: dashboard.outOfStock, icon: PackageX, tone: "text-[#e74c3c]" },
            { label: "Brands", value: dashboard.brands, icon: Building2, tone: "text-purple-400" },
          ]
        : [],
    [dashboard]
  );

  if (loading && !dashboard) return <PageSkeleton page="dashboard" />;

  const alerts = [
    ...lowItems.map((v) => ({ v, kind: "low" as const })),
    ...outItems.map((v) => ({ v, kind: "out" as const })),
  ];

  return (
    <div className="space-y-5">
      {/* Value + refresh row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-th-secondary">Low stock threshold</span>
          <select className="input-field w-auto" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Low stock threshold">
            {THRESHOLD_OPTIONS.map((t) => <option key={t} value={t}>≤ {t}</option>)}
          </select>
          <button onClick={refetch} className="btn-secondary flex items-center gap-2" aria-label="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          {dashboard && (
            <>
              <div className="card px-4 py-2 flex items-center gap-2">
                <Wallet size={16} className="text-th-secondary" />
                <div>
                  <p className="text-[11px] text-th-secondary uppercase tracking-wide">Stock Value</p>
                  <p className="text-sm font-bold text-th-text">{formatCurrency(dashboard.inventoryCost)}</p>
                </div>
              </div>
              <div className="card px-4 py-2 flex items-center gap-2">
                <IndianRupee size={16} className="text-th-secondary" />
                <div>
                  <p className="text-[11px] text-th-secondary uppercase tracking-wide">Retail Value</p>
                  <p className="text-sm font-bold text-th-text">{formatCurrency(dashboard.inventoryValue)}</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card text-center">
              <Icon size={22} className={`mx-auto mb-2 ${s.tone}`} />
              <p className="text-2xl font-bold text-th-text">{s.value}</p>
              <p className="text-sm text-th-secondary">{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <QuickActionButton icon={PackagePlus} label="Add Stock" hint="Stock a purchase into an existing item" onClick={() => onAction({ type: "add" })} />
        <QuickActionButton icon={Boxes} label="New Item" hint="Add a new product/SKU with stock" onClick={() => onAction({ type: "new" })} />
        <QuickActionButton icon={Hand} label="Withdraw" hint="Demo, damaged or internal use" tone="amber" onClick={() => onAction({ type: "withdraw" })} />
        <QuickActionButton icon={ClipboardList} label="Start Count" hint="Physical stock count session" tone="neutral" onClick={onStartCount} />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <PageSection
          icon={AlertTriangle}
          title="Needs attention"
          subtitle="Low or out-of-stock items"
          actions={
            <button onClick={onShowStock} className="text-sm font-medium text-[#1ed760] hover:underline inline-flex items-center gap-1">
              View all stock <ArrowUpRight size={14} />
            </button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {alerts.map(({ v, kind }) => (
              <button
                key={v._id}
                onClick={() => onAction({ type: "add", variant: v })}
                className="flex items-center gap-3 rounded-[8px] border border-th-border bg-th-base px-3 py-2.5 text-left hover:bg-th-hover transition-colors"
              >
                <span className={`h-2 w-2 rounded-full flex-shrink-0 ${kind === "out" ? "bg-[#e74c3c]" : "bg-amber-400"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block font-mono text-xs text-th-text">{v.sku}</span>
                  <span className="block text-xs text-th-secondary truncate">{itemLabel(v)}</span>
                </span>
                <StockStatusBadge qty={v.stockQuantity} threshold={threshold} />
                <ChevronRight size={14} className="text-th-secondary flex-shrink-0" />
              </button>
            ))}
          </div>
        </PageSection>
      )}

      {/* Recent activity */}
      <PageSection icon={Activity} title="Recent Activity" subtitle="Latest stock movements">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-hover bg-th-base">
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">After</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">By</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-border">
              {(dashboard?.recentActivity || []).map((m) => (
                <tr key={m._id} className="hover:bg-th-card transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-block rounded-full px-2.5 py-1 text-[12px] font-semibold ${movementTone(m.type)}`}>
                      {movementLabel(m.type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-sm text-th-text">{m.sku || "—"}</td>
                  <td className={`px-4 py-3 whitespace-nowrap text-right font-semibold ${m.quantity < 0 ? "text-[#e74c3c]" : "text-[#1ed760]"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-th-secondary">{m.afterQuantity}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-th-text">{m.by || "—"}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-th-secondary">{formatDateTime(m.createdAt)}</td>
                </tr>
              ))}
              {(!dashboard || dashboard.recentActivity.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-th-muted">No recent activity</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </div>
  );
}

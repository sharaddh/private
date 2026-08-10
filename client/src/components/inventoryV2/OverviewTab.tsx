import { useMemo, useState } from "react";
import {
  Package, Layers, Boxes, AlertTriangle, PackageX, Building2, Wallet, IndianRupee,
  Activity, RefreshCw,
} from "lucide-react";
import { useV2Dashboard } from "../../hooks";
import { MOVEMENT_TYPE_LABELS, type InventoryMovement } from "../../types/inventoryV2";
import { formatDateTime, formatCurrency } from "./shared";
import PageSkeleton from "../PageSkeleton";

const THRESHOLD_OPTIONS = [3, 5, 10, 20];

function movementTone(type: string): string {
  switch (type) {
    case "PURCHASE":
    case "RETURN":
    case "TRANSFER_IN":
    case "OPENING_BALANCE":
      return "bg-[#1ed760]/10 text-[#1ed760]";
    case "WITHDRAWAL":
    case "ORDER":
    case "TRANSFER_OUT":
    case "DAMAGE":
      return "bg-[#e74c3c]/10 text-[#e74c3c]";
    case "COUNT_CORRECTION":
    case "ADJUSTMENT":
    case "LOCATION_CHANGE":
      return "bg-amber-500/10 text-amber-400";
    default:
      return "bg-th-hover text-th-secondary";
  }
}

export default function OverviewTab() {
  const [threshold, setThreshold] = useState(5);
  const { dashboard, loading, refetch } = useV2Dashboard(threshold);

  const stats = useMemo(
    () =>
      dashboard
        ? [
            { label: "Products", value: dashboard.products, icon: Boxes, tone: "text-[#1ed760]" },
            { label: "Variants", value: dashboard.variants, icon: Layers, tone: "text-sky-400" },
            { label: "Stock Units", value: dashboard.stockUnits, icon: Package, tone: "text-th-text" },
            { label: "Low Stock", value: dashboard.lowStock, icon: AlertTriangle, tone: "text-amber-400" },
            { label: "Out of Stock", value: dashboard.outOfStock, icon: PackageX, tone: "text-[#e74c3c]" },
            { label: "Brands", value: dashboard.brands, icon: Building2, tone: "text-purple-400" },
          ]
        : [],
    [dashboard]
  );

  if (loading && !dashboard) return <PageSkeleton page="dashboard" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-th-secondary">Low stock threshold</span>
          <select
            className="input-field w-auto"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            aria-label="Low stock threshold"
          >
            {THRESHOLD_OPTIONS.map((t) => (
              <option key={t} value={t}>≤ {t}</option>
            ))}
          </select>
          <button onClick={refetch} className="btn-secondary flex items-center gap-2" aria-label="Refresh">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
        {dashboard && (
          <div className="flex items-center gap-4 flex-wrap">
            <div className="card px-4 py-2 flex items-center gap-2">
              <Wallet size={16} className="text-th-secondary" />
              <div>
                <p className="text-[11px] text-th-secondary uppercase tracking-wide">Cost Value</p>
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
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
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

      <div>
        <h2 className="text-base font-semibold text-th-text mb-3 flex items-center gap-2">
          <Activity size={18} className="text-[#1ed760]" /> Recent Activity
        </h2>
        <div className="bg-th-surface rounded-[8px] overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-th-hover bg-th-base">
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">SKU</th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Stock</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">By</th>
                <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-th-border">
              {(dashboard?.recentActivity || []).map((m: InventoryMovement) => (
                <tr key={m._id} className="hover:bg-th-card transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`badge ${movementTone(m.type)}`}>
                      {MOVEMENT_TYPE_LABELS[m.type] || m.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-mono text-sm text-th-text">{m.sku || "—"}</td>
                  <td className={`px-4 py-3 whitespace-nowrap text-right font-semibold ${m.quantity < 0 ? "text-[#e74c3c]" : "text-[#1ed760]"}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right text-sm text-th-secondary">
                    {m.beforeQuantity} → {m.afterQuantity}
                  </td>
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
      </div>
    </div>
  );
}

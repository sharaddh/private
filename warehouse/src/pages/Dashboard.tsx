import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import {
  Users,
  ShoppingCart,
  PackageMinus,
  Glasses,
  Clock,
  CheckCircle2,
  Warehouse,
  Activity,
  ListChecks,
  AlertTriangle,
  IndianRupee,
  Package,
  TrendingUp,
} from 'lucide-react';
import { coatingColor } from '../utils/coatingColors';
import { SkeletonStats } from '../components/Skeleton';
import StatCard from '../components/StatCard';
import SectionHeader from '../components/SectionHeader';
import QuickAction from '../components/QuickAction';
import Badge from '../components/Badge';
import {
  formatCurrency,
  fmtPairs,
  formatDate,
  lensTypeLabel,
  powerChipClass,
  formatLensPower,
} from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

interface WithdrawalRecord {
  _id: string;
  user: string;
  username: string;
  items: { coating: string; lensType: string; powerKey: string; quantity: number }[];
  totalQuantity: number;
  totalPrice?: number;
  paid?: boolean;
  withdrawnAt: string;
}

interface Stats {
  totalItems: number;
  lowStock: number;
  warehouseItems: number;
  totalValue: number;
  totalLensCoatings: number;
  totalLensStock: number;
  totalUsers: number;
  totalWithdrawals: number;
  totalWithdrawnItems: number;
  recentWithdrawals: WithdrawalRecord[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    api
      .get<Stats>('/api/warehouse/inventory/stats')
      .then((res) => {
        if (res.success && res.data) {
          const d = res.data;
          if (!Array.isArray(d.recentWithdrawals)) d.recentWithdrawals = [];
          setStats(d);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div>
          <div className="h-8 w-48 bg-th-hover rounded animate-pulse mb-2" />
          <div className="h-4 w-64 bg-th-hover rounded animate-pulse" />
        </div>
        <SkeletonStats />
      </div>
    );
  }

  const recent = stats?.recentWithdrawals || [];
  const lowStockCount = stats?.lowStock || 0;
  const firstName = (user?.name || user?.username || 'User').split(' ')[0];
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const inventoryValue = stats?.totalValue || 0;

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
            <Warehouse size={22} className="text-primary-500" />
          </div>
          <div className="min-w-0">
            <h1 className="page-title leading-tight">Welcome back, {firstName}</h1>
            <p className="page-subtitle truncate">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-pill bg-th-elevated text-small font-bold text-th-secondary hidden sm:inline-flex">
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp size={14} className="text-emerald-500" />{' '}
              {fmtPairs(stats?.totalLensStock || 0)} in stock
            </span>
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatCard
          icon={Glasses}
          iconColor="text-primary-500"
          iconBg="bg-primary-500/20"
          value={fmtPairs(stats?.totalLensStock || 0)}
          label="Lens Pairs"
          badge={
            stats?.totalLensCoatings
              ? {
                  text: `${stats.totalLensCoatings} coating${stats.totalLensCoatings !== 1 ? 's' : ''}`,
                  variant: 'blue',
                }
              : undefined
          }
        />
        <StatCard
          icon={Package}
          iconColor="text-cyan-500"
          iconBg="bg-cyan-500/20"
          value={stats?.totalItems || 0}
          label="Inventory Items"
          badge={
            stats?.warehouseItems
              ? { text: `${stats.warehouseItems} in WH`, variant: 'purple' }
              : undefined
          }
        />
        <StatCard
          icon={IndianRupee}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/20"
          value={formatCurrency(inventoryValue)}
          label="Stock Value"
        />
        <StatCard
          icon={Users}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/20"
          value={stats?.totalUsers || 0}
          label="Users"
        />
        <StatCard
          icon={PackageMinus}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/20"
          value={stats?.totalWithdrawals || 0}
          label="Withdrawals"
          badge={
            (stats?.totalWithdrawnItems || 0) > 0
              ? { text: `${stats?.totalWithdrawnItems} items`, variant: 'green' }
              : undefined
          }
        />
        <StatCard
          icon={AlertTriangle}
          iconColor="text-negative"
          iconBg="bg-negative/15"
          value={lowStockCount}
          label="Low Stock Items"
          badge={lowStockCount > 0 ? { text: 'Action needed', variant: 'yellow' } : undefined}
        />
      </div>

      {/* Quick Actions */}
      <div className="glass-card">
        <SectionHeader title="Quick Actions" icon={Activity} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <QuickAction
            icon={Glasses}
            label="Lens Stock"
            color="primary-500"
            onClick={() => navigate('/')}
          />
          <QuickAction
            icon={ShoppingCart}
            label="Cart"
            color="announcement"
            onClick={() => navigate('/cart')}
          />
          <QuickAction
            icon={Users}
            label="Users"
            color="emerald-500"
            onClick={() => navigate('/users')}
          />
        </div>
      </div>

      {/* Recent Withdrawals */}
      {recent.length > 0 && (
        <div className="glass-card">
          <SectionHeader
            title="Recent Withdrawals"
            icon={ListChecks}
            action={<Badge variant="gray">{recent.length}</Badge>}
          />
          <div className="space-y-1">
            {recent.map((rec, idx) => {
              const isDue = rec.paid === false;
              return (
                <div
                  key={rec._id}
                  onClick={() => navigate('/users')}
                  style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
                  className="p-3 hover:bg-th-hover cursor-pointer transition-all rounded-md animate-fade-up"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                        isDue ? 'bg-amber-500/15' : 'bg-emerald-500/15'
                      }`}
                    >
                      {isDue ? (
                        <Clock size={16} className="text-amber-500" />
                      ) : (
                        <CheckCircle2 size={16} className="text-emerald-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-body-bold text-th-text truncate">{rec.username}</p>
                      <p className="text-small text-th-muted truncate">
                        {fmtPairs(rec.totalQuantity)} · {formatDate(rec.withdrawnAt)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-body-bold text-th-text">
                        {formatCurrency(rec.totalPrice ?? 0)}
                      </p>
                      {isDue ? (
                        <span className="px-1.5 py-0.5 rounded-pill bg-amber-500/15 text-amber-500 text-micro font-bold inline-block mt-0.5">
                          Due
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-pill bg-emerald-500/15 text-emerald-500 text-micro font-bold inline-block mt-0.5">
                          Paid
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2 pl-12">
                    {rec.items.slice(0, 4).map((it, idx) => (
                      <span
                        key={idx}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-micro font-medium ${powerChipClass(it.powerKey)}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${coatingColor(it.coating).dot}`} />
                        {it.coating} {lensTypeLabel(it.lensType)} · {formatLensPower(it.powerKey)} ×
                        {fmtPairs(it.quantity)}
                      </span>
                    ))}
                    {rec.items.length > 4 && (
                      <span className="text-micro text-th-muted">+{rec.items.length - 4} more</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

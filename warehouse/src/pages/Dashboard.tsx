import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Users, ShoppingCart, PackageMinus, Glasses, Clock, Warehouse, Activity, ListChecks } from "lucide-react";
import { SkeletonStats } from "../components/Skeleton";
import StatCard from "../components/StatCard";
import SectionHeader from "../components/SectionHeader";
import QuickAction from "../components/QuickAction";
import { formatDate } from "../utils/helpers";

interface WithdrawalRecord {
  _id: string;
  user: string;
  username: string;
  items: { coating: string; lensType: string; powerKey: string; quantity: number }[];
  totalQuantity: number;
  withdrawnAt: string;
}

interface Stats {
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

  useEffect(() => {
    api.get<Stats>("/api/warehouse/inventory/stats").then((res) => {
      if (res.success && res.data) {
        const d = res.data;
        if (!Array.isArray(d.recentWithdrawals)) d.recentWithdrawals = [];
        setStats(d);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
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

  return (
    <div className="space-y-6 animate-fade-in pb-20 lg:pb-0">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-500/15 flex items-center justify-center">
          <Warehouse size={22} className="text-primary-500" />
        </div>
        <div>
          <h1 className="page-title leading-tight">Lens Warehouse</h1>
          <p className="page-subtitle">Overview of lens stock and activity</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Glasses}
          iconColor="text-primary-500"
          iconBg="bg-primary-500/20"
          value={stats?.totalLensCoatings || 0}
          label="Lens Coatings"
        />
        <StatCard
          icon={Glasses}
          iconColor="text-amber-500"
          iconBg="bg-amber-500/20"
          value={stats?.totalLensStock || 0}
          label="Total Lens Pieces"
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
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/20"
          value={stats?.totalWithdrawals || 0}
          label="Withdrawals"
          badge={(stats?.totalWithdrawnItems || 0) > 0 ? { text: `${stats?.totalWithdrawnItems} items`, variant: "green" } : undefined}
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
            onClick={() => navigate("/lens-stock")}
          />
          <QuickAction
            icon={ShoppingCart}
            label="Cart"
            color="announcement"
            onClick={() => navigate("/cart")}
          />
          <QuickAction
            icon={Users}
            label="Users"
            color="emerald-500"
            onClick={() => navigate("/users")}
          />
        </div>
      </div>

      {/* Recent Withdrawals */}
      {recent.length > 0 && (
        <div className="glass-card">
          <SectionHeader title="Recent Withdrawals" icon={ListChecks} />
          <div className="space-y-1">
            {recent.map((rec, idx) => (
              <div
                key={rec._id}
                onClick={() => navigate("/users")}
                style={{ animationDelay: `${Math.min(idx, 8) * 35}ms` }}
                className="flex items-center gap-3 p-3 hover:bg-th-hover cursor-pointer transition-all rounded-md animate-fade-up"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <PackageMinus size={14} className="text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-body text-th-text truncate">{rec.username} withdrew {rec.totalQuantity} item{rec.totalQuantity !== 1 ? "s" : ""}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {rec.items.slice(0, 4).map((it, idx) => {
                      const isNeg = it.powerKey.startsWith("-");
                      const isPos = it.powerKey.startsWith("+") && it.powerKey !== "+0.00";
                      return (
                        <span
                          key={idx}
                          className={`px-1.5 py-0.5 rounded text-micro font-medium ${
                            isNeg ? "bg-amber-400/15 text-amber-500" : isPos ? "bg-emerald-400/15 text-emerald-500" : "bg-th-elevated text-th-secondary"
                          }`}
                        >
                          {it.coating} {it.powerKey} x{it.quantity}
                        </span>
                      );
                    })}
                    {rec.items.length > 4 && (
                      <span className="text-micro text-th-muted">+{rec.items.length - 4} more</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-micro text-th-muted shrink-0">
                  <Clock size={10} />
                  {formatDate(rec.withdrawnAt)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

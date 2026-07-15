import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Package, AlertTriangle, TrendingUp, ShoppingCart, Boxes } from "lucide-react";
import { SkeletonStats } from "../components/Skeleton";
import StatCard from "../components/StatCard";
import SectionHeader from "../components/SectionHeader";
import QuickAction from "../components/QuickAction";
import ItemRow from "../components/ItemRow";
import { formatCurrency } from "../utils/helpers";

interface Stats {
  totalItems: number;
  lowStock: number;
  totalValue: number;
  warehouseItems: number;
  recentItems: Record<string, unknown>[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Stats>("/api/inventory/stats").then((res) => {
      if (res.success && res.data) {
        const d = res.data;
        if (!Array.isArray(d.recentItems)) d.recentItems = [];
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title">Lens Warehouse</h1>
        <p className="page-subtitle">Overview of lens warehouse stock</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Package}
          iconColor="text-primary-500"
          iconBg="bg-primary-500/20"
          value={stats?.totalItems || 0}
          label="Total Lens SKUs"
          badge={{ text: "Total", variant: "green" }}
        />
        <StatCard
          icon={AlertTriangle}
          iconColor="text-negative"
          iconBg="bg-negative/20"
          value={stats?.lowStock || 0}
          label="Low Stock Items"
          badge={(stats?.lowStock || 0) > 0 ? { text: "Alert", variant: "red" } : undefined}
        />
        <StatCard
          icon={TrendingUp}
          iconColor="text-emerald-500"
          iconBg="bg-emerald-500/20"
          value={formatCurrency(stats?.totalValue || 0)}
          label="Stock Value"
          badge={{ text: "Value", variant: "green" }}
        />
        <StatCard
          icon={Boxes}
          iconColor="text-purple-400"
          iconBg="bg-purple-500/20"
          value={stats?.warehouseItems || 0}
          label="Warehouse Items"
          badge={{ text: "Warehouse", variant: "purple" }}
        />
      </div>

      <div className="glass-card">
        <SectionHeader title="Quick Actions" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <QuickAction
            icon={ShoppingCart}
            label="Add New Lens"
            color="primary-500"
            onClick={() => navigate("/inventory/new")}
          />
          <QuickAction
            icon={Package}
            label="View All Lenses"
            color="announcement"
            onClick={() => navigate("/inventory")}
          />
        </div>
      </div>

      {stats?.recentItems && stats.recentItems.length > 0 && (
        <div className="glass-card">
          <SectionHeader title="Recent Items" />
          <div className="divide-y divide-th-border">
            {stats.recentItems.map((item: any) => (
              <ItemRow
                key={item._id}
                item={item}
                onClick={() => navigate(`/inventory/edit/${item._id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Package, AlertTriangle, TrendingUp, ArrowRight, ShoppingCart, Boxes } from "lucide-react";
import { SkeletonStats } from "../components/Skeleton";
import Spinner from "../components/Spinner";

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
        <div className="glass-card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
              <Package size={20} className="text-primary-500" />
            </div>
            <span className="badge-green">Total</span>
          </div>
          <p className="stat-value text-th-text">{stats?.totalItems || 0}</p>
          <p className="text-caption text-th-secondary">Total Lens SKUs</p>
        </div>

        <div className="glass-card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-negative/20 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-negative" />
            </div>
            {(stats?.lowStock || 0) > 0 && <span className="badge-red">Alert</span>}
          </div>
          <p className="stat-value text-th-text">{stats?.lowStock || 0}</p>
          <p className="text-caption text-th-secondary">Low Stock Items</p>
        </div>

        <div className="glass-card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-500" />
            </div>
            <span className="badge-green">Value</span>
          </div>
          <p className="stat-value text-th-text">₹{((stats?.totalValue || 0)).toLocaleString()}</p>
          <p className="text-caption text-th-secondary">Stock Value</p>
        </div>

        <div className="glass-card-hover">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
              <Boxes size={20} className="text-purple-400" />
            </div>
            <span className="badge-purple">Warehouse</span>
          </div>
          <p className="stat-value text-th-text">{stats?.warehouseItems || 0}</p>
          <p className="text-caption text-th-secondary">Warehouse Items</p>
        </div>
      </div>

      <div className="glass-card">
        <div className="card-header">
          <h3 className="text-body-bold text-th-text">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button onClick={() => navigate("/inventory/new")}
            className="flex items-center justify-between p-4 bg-primary-500/10 rounded-md hover:bg-primary-500/20 transition-all group">
            <div className="flex items-center gap-3">
              <ShoppingCart size={18} className="text-primary-500" />
              <span className="text-body-bold text-primary-500">Add New Lens</span>
            </div>
            <ArrowRight size={18} className="text-primary-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button onClick={() => navigate("/inventory")}
            className="flex items-center justify-between p-4 bg-announcement/10 rounded-md hover:bg-announcement/20 transition-all group">
            <div className="flex items-center gap-3">
              <Package size={18} className="text-announcement" />
              <span className="text-body-bold text-announcement">View All Lenses</span>
            </div>
            <ArrowRight size={18} className="text-announcement group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {stats?.recentItems && stats.recentItems.length > 0 && (
        <div className="glass-card">
          <div className="card-header">
            <h3 className="text-body-bold text-th-text">Recent Items</h3>
          </div>
          <div className="divide-y divide-th-border">
            {stats.recentItems.map((item: any) => (
              <div key={item._id} onClick={() => navigate(`/inventory/edit/${item._id}`)}
                className="flex items-center justify-between p-3 hover:bg-th-hover cursor-pointer transition-all rounded-md -mx-1">
                <div>
                  <p className="text-body text-th-text">{item.brand} {item.model}</p>
                  <p className="text-small text-th-muted">{item.sku} — {item.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-body-bold text-th-text">Qty: {item.quantity}</p>
                  <p className={`text-small ${(item.quantity || 0) <= 5 ? "text-negative" : "text-th-muted"}`}>
                    {item.location}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

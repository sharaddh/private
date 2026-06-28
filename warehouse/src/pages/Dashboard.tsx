import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { Package, AlertTriangle, TrendingUp, ArrowRight } from "lucide-react";

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
    api.get<Stats>("/api/inventory?limit=5").then((d) => {
      if (d.success) {
        const items = (d.data as any) || [];
        const totalValue = items.reduce((sum: number, i: any) => sum + (i.purchasePrice || 0) * (i.quantity || 0), 0);
        setStats({
          totalItems: items.length,
          lowStock: items.filter((i: any) => (i.quantity || 0) <= 5).length,
          totalValue,
          warehouseItems: items.filter((i: any) => i.location === "warehouse").length,
          recentItems: items.slice(0, 5),
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Warehouse Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of warehouse inventory</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-cyan-50 rounded-xl flex items-center justify-center">
              <Package size={20} className="text-cyan-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.totalItems || 0}</p>
          <p className="text-sm text-gray-500">Total Items</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.lowStock || 0}</p>
          <p className="text-sm text-gray-500">Low Stock</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <TrendingUp size={20} className="text-emerald-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">₹{((stats?.totalValue || 0)).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Stock Value</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-purple-50 rounded-xl flex items-center justify-center">
              <Package size={20} className="text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats?.warehouseItems || 0}</p>
          <p className="text-sm text-gray-500">Warehouse Items</p>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-900">Quick Actions</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button onClick={() => navigate("/inventory/new")}
            className="flex items-center justify-between p-4 bg-cyan-50 rounded-xl hover:bg-cyan-100 transition-all group">
            <span className="text-sm font-semibold text-cyan-700">Add New Item</span>
            <ArrowRight size={18} className="text-cyan-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button onClick={() => navigate("/inventory")}
            className="flex items-center justify-between p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-all group">
            <span className="text-sm font-semibold text-blue-700">View Inventory</span>
            <ArrowRight size={18} className="text-blue-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
          <button onClick={() => navigate("/inventory?location=warehouse")}
            className="flex items-center justify-between p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-all group">
            <span className="text-sm font-semibold text-purple-700">Warehouse Stock</span>
            <ArrowRight size={18} className="text-purple-500 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>

      {stats?.recentItems && stats.recentItems.length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Recent Items</h3>
          <div className="space-y-2">
            {stats.recentItems.map((item: any) => (
              <div key={item._id} onClick={() => navigate(`/inventory/edit/${item._id}`)}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition-all">
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.brand} {item.model}</p>
                  <p className="text-xs text-gray-400">{item.sku} — {item.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">Qty: {item.quantity}</p>
                  <p className={`text-xs ${(item.quantity || 0) <= 5 ? "text-red-500" : "text-gray-400"}`}>
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

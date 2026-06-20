import React, { useEffect, useState } from "react";
import api from "../api";
import { Eye, Clock, Package, Truck, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Delivery() {
  const navigate = useNavigate();
  const [list, setList] = useState<any[]>([]);

  useEffect(() => { fetchDelivered(); }, []);

  function fetchDelivered() {
    api.get("/api/orders").then((d) => {
      if (d.success) {
        const delivered = (d.data || []).filter((o: any) => o.status === "Delivered");
        setList(delivered);
      }
    });
  }

  function customerName(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.name) return o.customerId.name;
    return "—";
  }

  function customerMobile(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?.mobile) return o.customerId.mobile;
    return "";
  }

  function customerId(o: any): string {
    if (typeof o.customerId === "object" && o.customerId?._id) return o.customerId._id;
    return o.customerId || "";
  }

  const today = new Date().toISOString().split("T")[0];
  const todayDeliveries = list.filter((d) => {
    if (!d.deliveryDate) return false;
    return new Date(d.deliveryDate).toISOString().split("T")[0] === today;
  });

  return (
    <div className="page-container">
      <div>
        <h1 className="page-title">Delivery History</h1>
        <p className="page-subtitle">All delivered orders.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card text-center py-5">
          <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Package size={20} className="text-emerald-500" />
          </div>
          <p className="stat-value text-emerald-600">{list.length}</p>
          <p className="text-sm text-gray-500">Total Delivered</p>
        </div>
        <div className="card text-center py-5">
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Clock size={20} className="text-blue-500" />
          </div>
          <p className="stat-value text-primary-600">{todayDeliveries.length}</p>
          <p className="text-sm text-gray-500">Delivered Today</p>
        </div>
        <div className="card text-center py-5">
          <div className="w-10 h-10 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <DollarSign size={20} className="text-amber-500" />
          </div>
          <p className="stat-value text-gray-900 dark:text-white">₹{list.reduce((s, o) => s + (o.billInfo?.totalAmount || 0), 0).toLocaleString()}</p>
          <p className="text-sm text-gray-500">Total Revenue</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-16">
          <Truck size={40} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-500">No delivered orders yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.map((o: any) => (
            <div key={o._id} className="card hover:shadow-soft-lg transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-800/20 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm flex-shrink-0">
                      {customerName(o).charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{customerName(o)}</p>
                      {customerMobile(o) && <p className="text-xs text-gray-400">{customerMobile(o)}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {o.frame && <span>Frame: <span className="font-medium text-gray-800 dark:text-gray-200">{o.frame}</span></span>}
                    {o.lens && <span>Lens: <span className="font-medium text-gray-800 dark:text-gray-200">{o.lens}</span></span>}
                    {o.coating && <span>Coating: <span className="font-medium text-gray-800 dark:text-gray-200">{o.coating}</span></span>}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                    {o.deliveryDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} /> {new Date(o.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    )}
                    {o.billInfo?.totalAmount > 0 && (
                      <span className="font-medium text-gray-700 dark:text-gray-300">₹{o.billInfo.totalAmount.toLocaleString()}</span>
                    )}
                  </div>
                </div>
                <button onClick={() => navigate(`/customers/${customerId(o)}?visitId=${o.visitId || ""}`)}
                  className="btn-ghost btn-sm gap-1 flex-shrink-0">
                  <Eye size={14} /> View
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

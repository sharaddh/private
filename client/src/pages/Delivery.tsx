import React, { useEffect, useState } from "react";
import api from "../api";
import { Eye, Clock, Search } from "lucide-react";
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
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Delivery History</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Delivered orders.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card text-center">
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{list.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Delivered</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{todayDeliveries.length}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Delivered Today</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            ₹{list.reduce((s, o) => s + (o.billInfo?.totalAmount || 0), 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Revenue</p>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-400 dark:text-gray-500">No delivered orders yet</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {list.map((o: any) => (
            <div key={o._id} className="card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  {/* Customer */}
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-emerald-100 dark:bg-emerald-900/50 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-sm flex-shrink-0">
                      {customerName(o).charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{customerName(o)}</p>
                      {customerMobile(o) && <p className="text-xs text-gray-400 dark:text-gray-500">{customerMobile(o)}</p>}
                    </div>
                  </div>
                  {/* Order items */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                    {o.frame && <span>Frame: <span className="font-medium text-gray-800 dark:text-gray-200">{o.frame}</span></span>}
                    {o.lens && <span>Lens: <span className="font-medium text-gray-800 dark:text-gray-200">{o.lens}</span></span>}
                    {o.coating && <span>Coating: <span className="font-medium text-gray-800 dark:text-gray-200">{o.coating}</span></span>}
                  </div>
                  {/* Delivery date + amount */}
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                    {o.deliveryDate && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> Delivered: {new Date(o.deliveryDate).toLocaleDateString()}
                      </span>
                    )}
                    {o.billInfo?.totalAmount > 0 && (
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        ₹{o.billInfo.totalAmount.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => navigate(`/customers/${customerId(o)}?visitId=${o.visitId || ""}`)}
                  className="btn-secondary px-3 py-1.5 text-xs flex items-center gap-1 flex-shrink-0">
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

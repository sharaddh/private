import React, { useEffect, useState } from "react";
import api from "../api";
import Table from "../components/Table";

export default function Delivery() {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  function fetchDeliveries() {
    api.get("/api/delivery").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
        return "bg-green-100 text-green-800";
      case "In Transit":
        return "bg-blue-100 text-blue-800";
      case "Pending":
        return "bg-yellow-100 text-yellow-800";
      case "Cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Deliveries ({list.length})</h2>
        <Table
          columns={[
            { key: "orderId", label: "Order ID" },
            { key: "customerId", label: "Customer ID" },
            { key: "deliveryDate", label: "Delivery Date" },
            { key: "address", label: "Address" },
            { key: "status", label: "Status" },
          ]}
          data={list}
          actions={(row) => (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(row.status)}`}>
              {row.status || "Pending"}
            </span>
          )}
        />
      </div>
    </div>
  );
}

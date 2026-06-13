import React, { useEffect, useState } from "react";
import api from "../api";
import Form, { Input, Select } from "../components/Form";
import Table from "../components/Table";

export default function Delivery() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({
    customerId: "",
    orderId: "",
    address: "",
    expectedDeliveryDate: "",
    status: "Pending",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchDeliveries();
  }, []);

  function fetchDeliveries() {
    api.get("/api/delivery").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post("/api/delivery", form);
      if (res.success) {
        setList([res.data, ...list]);
        setForm({ customerId: "", orderId: "", address: "", expectedDeliveryDate: "", status: "Pending" });
      }
    } finally {
      setIsLoading(false);
    }
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
      <Form onSubmit={handleSubmit} title="Create Delivery" submitLabel="Add Delivery" isLoading={isLoading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Customer ID"
            placeholder="Enter customer ID"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            required
          />
          <Input
            label="Order ID"
            placeholder="Enter order ID"
            value={form.orderId}
            onChange={(e) => setForm({ ...form, orderId: e.target.value })}
          />
          <Input
            label="Address"
            placeholder="Delivery address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            label="Expected Delivery Date"
            type="date"
            value={form.expectedDeliveryDate}
            onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })}
          />
          <Select
            label="Status"
            options={[
              { value: "Pending", label: "Pending" },
              { value: "In Transit", label: "In Transit" },
              { value: "Ready", label: "Ready" },
              { value: "Delivered", label: "Delivered" },
              { value: "Cancelled", label: "Cancelled" },
            ]}
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />
        </div>
      </Form>

      <div>
        <h2 className="text-2xl font-bold mb-4">Deliveries ({list.length})</h2>
        <Table
          columns={[
            { key: "orderId", label: "Order ID" },
            { key: "customerId", label: "Customer ID" },
            { key: "expectedDeliveryDate", label: "Delivery Date" },
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

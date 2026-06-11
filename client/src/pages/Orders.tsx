import React, { useEffect, useState } from "react";
import api from "../api";
import Form, { Input, Select } from "../components/Form";
import Table from "../components/Table";

export default function Orders() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({
    customerId: "",
    frame: "",
    lens: "",
    quantity: 1,
    deliveryDate: "",
    status: "Draft",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, []);

  function fetchOrders() {
    api.get("/api/orders").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post("/api/orders", form);
      if (res.success) {
        setList([res.data, ...list]);
        setForm({
          customerId: "",
          frame: "",
          lens: "",
          quantity: 1,
          deliveryDate: "",
          status: "Draft",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form onSubmit={handleSubmit} title="Create New Order" submitLabel="Create Order" isLoading={isLoading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Customer ID"
            placeholder="Enter customer ID"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            required
          />
          <Input
            label="Frame"
            placeholder="Frame type/model"
            value={form.frame}
            onChange={(e) => setForm({ ...form, frame: e.target.value })}
            required
          />
          <Input
            label="Lens"
            placeholder="Lens type"
            value={form.lens}
            onChange={(e) => setForm({ ...form, lens: e.target.value })}
            required
          />
          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            min="1"
          />
          <Input
            label="Delivery Date"
            type="date"
            value={form.deliveryDate}
            onChange={(e) => setForm({ ...form, deliveryDate: e.target.value })}
          />
          <Select
            label="Status"
            options={[
              { value: "Draft", label: "Draft" },
              { value: "Ordered", label: "Ordered" },
              { value: "In Lab", label: "In Lab" },
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
        <h2 className="text-2xl font-bold mb-4">Orders ({list.length})</h2>
        <Table
          columns={[
            { key: "customerId", label: "Customer ID" },
            { key: "frame", label: "Frame" },
            { key: "lens", label: "Lens" },
            { key: "quantity", label: "Qty" },
            { key: "status", label: "Status" },
            { key: "deliveryDate", label: "Delivery Date" },
          ]}
          data={list}
          actions={(row) => (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
              row.status === "Delivered" ? "bg-green-100 text-green-800" :
              row.status === "Cancelled" ? "bg-red-100 text-red-800" :
              "bg-blue-100 text-blue-800"
            }`}>
              {row.status}
            </span>
          )}
        />
      </div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import api from "../api";
import Form, { Input } from "../components/Form";
import Table from "../components/Table";

export default function Bills() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({
    customerId: "",
    description: "",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    tax: 0,
    advancePaid: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchBills();
  }, []);

  function fetchBills() {
    api.get("/api/bills").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const body = {
        customerId: form.customerId,
        items: [
          {
            description: form.description,
            quantity: form.quantity,
            unitPrice: form.unitPrice,
          },
        ],
        discount: form.discount,
        tax: form.tax,
        advancePaid: form.advancePaid,
      };
      const res = await api.post("/api/bills", body);
      if (res.success) {
        setList([res.data, ...list]);
        setForm({
          customerId: "",
          description: "",
          quantity: 1,
          unitPrice: 0,
          discount: 0,
          tax: 0,
          advancePaid: 0,
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form onSubmit={handleSubmit} title="Create New Bill" submitLabel="Create Bill" isLoading={isLoading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Customer ID"
            placeholder="Enter customer ID"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            required
          />
          <Input
            label="Item Description"
            placeholder="Product/service description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
            label="Unit Price"
            type="number"
            placeholder="0.00"
            value={form.unitPrice}
            onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })}
            step="0.01"
          />
          <Input
            label="Discount"
            type="number"
            placeholder="0.00"
            value={form.discount}
            onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
            step="0.01"
          />
          <Input
            label="Tax"
            type="number"
            placeholder="0.00"
            value={form.tax}
            onChange={(e) => setForm({ ...form, tax: Number(e.target.value) })}
            step="0.01"
          />
          <Input
            label="Advance Paid"
            type="number"
            placeholder="0.00"
            value={form.advancePaid}
            onChange={(e) => setForm({ ...form, advancePaid: Number(e.target.value) })}
            step="0.01"
          />
        </div>
      </Form>

      <div>
        <h2 className="text-2xl font-bold mb-4">Bills ({list.length})</h2>
        <Table
          columns={[
            { key: "billNumber", label: "Bill #" },
            { key: "customerId", label: "Customer ID" },
            { key: "totalAmount", label: "Total Amount" },
            { key: "discount", label: "Discount" },
            { key: "tax", label: "Tax" },
          ]}
          data={list}
          actions={() => (
            <button className="text-blue-600 hover:text-blue-800">View</button>
          )}
        />
      </div>
    </div>
  );
}

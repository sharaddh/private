import React, { useEffect, useState } from "react";
import api from "../api";
import Form, { Input, Select } from "../components/Form";
import Table from "../components/Table";

export default function Payments() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({
    customerId: "",
    billId: "",
    amount: 0,
    paymentMode: "Cash",
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchPayments();
  }, []);

  function fetchPayments() {
    api.get("/api/payments").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post("/api/payments", form);
      if (res.success) {
        setList([res.data, ...list]);
        setForm({
          customerId: "",
          billId: "",
          amount: 0,
          paymentMode: "Cash",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form onSubmit={handleSubmit} title="Record Payment" submitLabel="Record Payment" isLoading={isLoading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Customer ID"
            placeholder="Enter customer ID"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            required
          />
          <Input
            label="Bill ID"
            placeholder="Enter bill ID"
            value={form.billId}
            onChange={(e) => setForm({ ...form, billId: e.target.value })}
            required
          />
          <Input
            label="Amount"
            type="number"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
            step="0.01"
            required
          />
          <Select
            label="Payment Mode"
            options={[
              { value: "Cash", label: "Cash" },
              { value: "UPI", label: "UPI" },
              { value: "Card", label: "Card" },
              { value: "Bank Transfer", label: "Bank Transfer" },
            ]}
            value={form.paymentMode}
            onChange={(e) => setForm({ ...form, paymentMode: e.target.value })}
          />
        </div>
      </Form>

      <div>
        <h2 className="text-2xl font-bold mb-4">Payments ({list.length})</h2>
        <Table
          columns={[
            { key: "customerId", label: "Customer ID" },
            { key: "billId", label: "Bill ID" },
            { key: "amount", label: "Amount" },
            { key: "paymentMode", label: "Payment Mode" },
          ]}
          data={list}
          actions={(row) => (
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              {row.paymentMode}
            </span>
          )}
        />
      </div>
    </div>
  );
}

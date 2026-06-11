import React, { useEffect, useState } from "react";
import Form, { Input } from "../components/Form";
import Table from "../components/Table";

type Customer = {
  _id: string;
  name: string;
  email?: string;
  mobile?: string;
  address?: string;
};

export default function Customers() {
  const [list, setList] = useState<Customer[]>([]);
  const [form, setForm] = useState({ name: "", email: "", mobile: "", address: "" });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
  }, []);

  function fetchCustomers() {
    fetch((import.meta.env.VITE_API_URL || "") + "/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setList(d.data || []);
      })
      .catch(() => {});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch((import.meta.env.VITE_API_URL || "") + "/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }).then((r) => r.json());

      if (res.success) {
        setList([res.data, ...list]);
        setForm({ name: "", email: "", mobile: "", address: "" });
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <Form onSubmit={handleSubmit} title="Add New Customer" submitLabel="Add Customer" isLoading={isLoading}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Customer Name"
            placeholder="Enter customer name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <Input
            label="Email"
            type="email"
            placeholder="customer@example.com"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <Input
            label="Mobile"
            placeholder="+91 9876543210"
            value={form.mobile}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          />
          <Input
            label="Address"
            placeholder="Customer address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
      </Form>

      <div>
        <h2 className="text-2xl font-bold mb-4">Customers ({list.length})</h2>
        <Table
          columns={[
            { key: "name", label: "Name" },
            { key: "email", label: "Email" },
            { key: "mobile", label: "Mobile" },
            { key: "address", label: "Address" },
          ]}
          data={list}
          actions={(row) => (
            <button className="text-blue-600 hover:text-blue-800">Edit</button>
          )}
        />
      </div>
    </div>
  );
}

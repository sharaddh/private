import React, { useEffect, useState } from "react";
import api from "../api";
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
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCustomers();
  }, []);

  async function fetchCustomers() {
    const res = await api.get("/api/customers");
    if (res.success) {
      setList(res.data || []);
    } else {
      setError(res.message || "Unable to load customers.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await api.post("/api/customers", form);
      if (res.success) {
        setList([res.data, ...list]);
        setForm({ name: "", email: "", mobile: "", address: "" });
      } else {
        setError(res.message || "Unable to add customer.");
      }
    } catch (err) {
      setError("Unable to add customer. Please try again.");
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

      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold">Customers</h2>
            <p className="text-sm text-gray-500">Manage customer profiles and contact details.</p>
          </div>
          <div className="text-sm text-gray-600">Total: {list.length}</div>
        </div>
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

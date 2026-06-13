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
  const [form, setForm] = useState({
    name: "",
    email: "",
    mobile: "",
    alternateMobile: "",
    address: "",
    city: "",
    age: "",
    gender: "",
    tags: "",
  });
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
      const payload = {
        name: form.name,
        email: form.email || undefined,
        mobile: form.mobile || undefined,
        alternateMobile: form.alternateMobile || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        age: form.age ? Number(form.age) : undefined,
        gender: form.gender || undefined,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      };

      const res = await api.post("/api/customers", payload);
      if (res.success) {
        setList([res.data, ...list]);
        setForm({
          name: "",
          email: "",
          mobile: "",
          alternateMobile: "",
          address: "",
          city: "",
          age: "",
          gender: "",
          tags: "",
        });
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            label="Alternate Mobile"
            placeholder="Alternate mobile"
            value={form.alternateMobile}
            onChange={(e) => setForm({ ...form, alternateMobile: e.target.value })}
          />
          <Input
            label="City"
            placeholder="City"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
          <Input
            label="Age"
            type="number"
            placeholder="Age"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
            min="0"
          />
          <Input
            label="Address"
            placeholder="Customer address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
          <Input
            label="Gender"
            placeholder="Male / Female / Other"
            value={form.gender}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
          />
          <Input
            label="Tags"
            placeholder="tag1, tag2"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
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
            { key: "alternateMobile", label: "Alt Mobile" },
            { key: "city", label: "City" },
            { key: "age", label: "Age" },
            { key: "gender", label: "Gender" },
            { key: "tags", label: "Tags" },
          ]}
          data={list.map((customer) => ({
            ...customer,
            tags: customer.tags?.join(", ") || "",
          }))}
          actions={(row) => (
            <button className="text-blue-600 hover:text-blue-800">Edit</button>
          )}
        />
      </div>
    </div>
  );
}

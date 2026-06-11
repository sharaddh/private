import React, { useEffect, useState } from "react";

type Customer = {
  _id: string;
  name: string;
  mobile?: string;
};

export default function Customers() {
  const [list, setList] = useState<Customer[]>([]);

  useEffect(() => {
    fetch((import.meta.env.VITE_API_URL || "") + "/api/customers")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setList(d.data || []);
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Customers</h2>
      <ul>
        {list.map((c) => (
          <li key={c._id} className="py-2 border-b">
            {c.name} {c.mobile && <small className="text-muted">- {c.mobile}</small>}
          </li>
        ))}
      </ul>
    </div>
  );
}

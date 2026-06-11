import React, { useEffect, useState } from "react";
import api from "../api";

export default function Orders() {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/orders").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Orders</h2>
      <ul>
        {list.map((o) => (
          <li key={o._id} className="py-2 border-b">
            {o.frame || o.lens} - <small>{o.status}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import api from "../api";

export default function InventoryPage() {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/inventory").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Inventory</h2>
      <ul>
        {list.map((it) => (
          <li key={it._id} className="py-2 border-b">
            {it.sku} - {it.brand} - <strong>{it.quantity}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

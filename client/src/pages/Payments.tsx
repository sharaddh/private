import React, { useEffect, useState } from "react";
import api from "../api";

export default function Payments() {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/payments").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Payments</h2>
      <ul>
        {list.map((p) => (
          <li key={p._id} className="py-2 border-b">
            {p.amount} - <small>{p.paymentMode}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

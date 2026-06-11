import React, { useEffect, useState } from "react";
import api from "../api";

export default function Delivery() {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/delivery").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Delivery</h2>
      <ul>
        {list.map((d) => (
          <li key={d._id} className="py-2 border-b">
            {d.orderId ? d.orderId : "—"} - <small>{d.status}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

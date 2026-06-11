import React, { useEffect, useState } from "react";
import api from "../api";

export default function Bills() {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    api.get("/api/bills").then((d) => {
      if (d.success) setList(d.data || []);
    });
  }, []);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Bills</h2>
      <ul>
        {list.map((b) => (
          <li key={b._id} className="py-2 border-b">
            {b.billNumber} - <strong>{b.totalAmount}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { memo } from "react";
import { Edit3, Trash2, ArrowDownFromLine } from "lucide-react";
import type { InventoryItem } from "../types/inventory";
import Badge from "./Badge";

interface Props {
  items: InventoryItem[];
  onEdit: (item: InventoryItem) => void;
  onWithdraw: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}

const InventoryRow = memo(function InventoryRow({ item, onEdit, onWithdraw, onDelete, deleting }: {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onWithdraw: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  deleting: string | null;
}) {
  return (
    <tr className="border-b border-th-border hover:bg-th-hover transition-colors">
      <td className="px-4 py-3 text-body-bold text-th-text">{item.sku}</td>
      <td className="px-4 py-3 text-body text-th-text">
        {item.brand && <span className="font-bold">{item.brand}</span>}
        {item.brand && item.model && " "}
        {item.model}
        {!item.brand && !item.model && <span className="text-th-muted">—</span>}
      </td>
      <td className="px-4 py-3">
        <Badge variant="blue">{item.category}</Badge>
      </td>
      <td className="px-4 py-3">
        <Badge variant={item.location === "warehouse" ? "purple" : "green"}>
          {item.location}
        </Badge>
      </td>
      <td className={`px-4 py-3 text-body-bold text-right ${(item.quantity || 0) <= 5 ? "text-negative" : "text-th-text"}`}>
        {item.quantity}
      </td>
      <td className="px-4 py-3 text-body text-th-secondary text-right">₹{item.sellingPrice || 0}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onEdit(item)}
            className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted hover:text-announcement transition-colors"
            title="Edit">
            <Edit3 size={15} />
          </button>
          <button onClick={() => onWithdraw(item)}
            className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted hover:text-warning transition-colors"
            title="Withdraw">
            <ArrowDownFromLine size={15} />
          </button>
          <button onClick={() => onDelete(item._id)} disabled={deleting === item._id}
            className="p-1.5 hover:bg-th-hover rounded-lg text-th-muted hover:text-negative transition-colors disabled:opacity-40"
            title="Delete">
            <Trash2 size={15} />
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function InventoryTable({ items, onEdit, onWithdraw, onDelete, deleting }: Props) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-th-border bg-th-base">
              <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">SKU</th>
              <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Brand / Model</th>
              <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Category</th>
              <th className="text-left text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Location</th>
              <th className="text-right text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Qty</th>
              <th className="text-right text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Price</th>
              <th className="text-right text-badge text-th-muted px-4 py-3 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <InventoryRow
                key={item._id}
                item={item}
                onEdit={onEdit}
                onWithdraw={onWithdraw}
                onDelete={onDelete}
                deleting={deleting}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

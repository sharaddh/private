import type { InventoryItem } from "../types/inventory";

interface Props {
  item: InventoryItem;
  onClick: () => void;
}

export default function ItemRow({ item, onClick }: Props) {
  return (
    <div onClick={onClick}
      className="flex items-center justify-between p-3 hover:bg-th-hover cursor-pointer transition-all rounded-md -mx-1">
      <div>
        <p className="text-body text-th-text">{item.brand} {item.model}</p>
        <p className="text-small text-th-muted">{item.sku} — {item.category}</p>
      </div>
      <div className="text-right">
        <p className="text-body-bold text-th-text">Qty: {item.quantity}</p>
        <p className={`text-small ${(item.quantity || 0) <= 5 ? "text-negative" : "text-th-muted"}`}>
          {item.location}
        </p>
      </div>
    </div>
  );
}

import { AlertTriangle, Package, TrendingDown, TrendingUp } from "lucide-react";

interface Props {
  totalItems: number;
  lowStock: number;
  warehouseItems: number;
  totalValue: number;
}

export default function StatusBar({ totalItems, lowStock, warehouseItems, totalValue }: Props) {
  if (lowStock === 0) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-warning/10 border border-warning/30 rounded-pill">
      <AlertTriangle size={16} className="text-warning flex-shrink-0" />
      <p className="text-small text-th-text">
        <strong className="text-warning">{lowStock}</strong> item{lowStock !== 1 ? "s" : ""} low on stock
      </p>
    </div>
  );
}

import { useState } from "react";
import type { LensType, LensStockItem } from "../../types/lensStock";
import api from "../../api";
import { useToast } from "../../context";
import PowerRow from "./PowerRow";
import CompoundGrid from "./CompoundGrid";

interface Props {
  item: LensStockItem;
  onUpdate: (updated: LensStockItem) => void;
}

const TABS: { key: LensType; label: string; desc: string }[] = [
  { key: "sph", label: "SPH", desc: "Spherical" },
  { key: "cyl", label: "CYL", desc: "Cylindrical" },
  { key: "compound", label: "Both", desc: "Spherical + Cylindrical" },
];

export default function LensGrid({ item, onUpdate }: Props) {
  const [lensType, setLensType] = useState<LensType>("sph");
  const { toast } = useToast();

  const quantities = item.quantities?.[lensType] || {};

  const handleIncrement = async (powerKey: string) => {
    const current = quantities[powerKey] || 0;
    const res = await api.put<{ _id: string }>(`/api/lens-stock/${item._id}/quantity`, {
      lensType,
      powerKey,
      quantity: current + 1,
    });
    if (res.success) {
      onUpdate({
        ...item,
        quantities: {
          ...item.quantities,
          [lensType]: { ...quantities, [powerKey]: current + 1 },
        },
      });
    } else {
      toast(res.message || "Failed to update", "error");
    }
  };

  const handleDecrement = async (powerKey: string) => {
    const current = quantities[powerKey] || 0;
    if (current <= 0) return;
    const res = await api.put<{ _id: string }>(`/api/lens-stock/${item._id}/quantity`, {
      lensType,
      powerKey,
      quantity: current - 1,
    });
    if (res.success) {
      const updated = { ...quantities };
      if (current - 1 <= 0) {
        delete updated[powerKey];
      } else {
        updated[powerKey] = current - 1;
      }
      onUpdate({
        ...item,
        quantities: {
          ...item.quantities,
          [lensType]: updated,
        },
      });
    } else {
      toast(res.message || "Failed to update", "error");
    }
  };

  const totalQty = Object.values(quantities).reduce((sum, q) => sum + q, 0);
  const stockCount = Object.values(quantities).filter((q) => q > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1.5 bg-th-elevated rounded-pill p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setLensType(t.key)}
              className={`px-4 py-1.5 rounded-pill text-micro font-bold transition-all ${
                lensType === t.key
                  ? "bg-primary-500 text-surface-950 shadow-sm"
                  : "text-th-secondary hover:text-th-text"
              }`}
            >
              {t.label}
              <span className="hidden sm:inline ml-1 font-normal opacity-70">({t.desc})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 text-micro">
          <div className="flex items-center gap-1.5 text-th-secondary">
            <span className="w-2 h-2 rounded-full bg-primary-500" />
            <span><strong className="text-th-text">{stockCount}</strong> powers in stock</span>
          </div>
          <div className="text-th-secondary">
            Total: <strong className="text-primary-500">{totalQty}</strong> pcs
          </div>
        </div>
      </div>

      {lensType === "compound" ? (
        <CompoundGrid
          quantities={quantities}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
        />
      ) : (
        <PowerRow
          quantities={quantities}
          onIncrement={handleIncrement}
          onDecrement={handleDecrement}
        />
      )}
    </div>
  );
}

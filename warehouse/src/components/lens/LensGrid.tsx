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

const TABS: { key: LensType; label: string }[] = [
  { key: "sph", label: "SPH" },
  { key: "cyl", label: "CYL" },
  { key: "compound", label: "Both" },
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

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5 w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setLensType(t.key)}
            className={`px-3 sm:px-4 py-1.5 rounded-pill text-xs font-bold transition-all active:scale-95 ${
              lensType === t.key
                ? "bg-primary-500 text-surface-950 shadow-sm"
                : "text-th-secondary active:bg-th-hover"
            }`}
          >
            {t.label}
          </button>
        ))}
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

import { useState, useCallback } from "react";
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

  const handleIncrement = useCallback(async (powerKey: string) => {
    const current = quantities[powerKey] || 0;
    const newQty = current + 1;
    onUpdate({
      ...item,
      quantities: {
        ...item.quantities,
        [lensType]: { ...quantities, [powerKey]: newQty },
      },
    });
    const res = await api.put<{ _id: string }>(`/api/warehouse/lens-stock/${item._id}/quantity`, {
      lensType,
      powerKey,
      quantity: newQty,
    });
    if (!res.success) {
      onUpdate({
        ...item,
        quantities: {
          ...item.quantities,
          [lensType]: { ...quantities },
        },
      });
      toast(res.message || "Failed to update", "error");
    }
  }, [item, lensType, quantities, onUpdate, toast]);

  const handleDecrement = useCallback(async (powerKey: string) => {
    const current = quantities[powerKey] || 0;
    if (current <= 0) return;
    const newQty = current - 1;
    const updated = { ...quantities };
    if (newQty <= 0) {
      delete updated[powerKey];
    } else {
      updated[powerKey] = newQty;
    }
    onUpdate({
      ...item,
      quantities: {
        ...item.quantities,
        [lensType]: updated,
      },
    });
    const res = await api.put<{ _id: string }>(`/api/warehouse/lens-stock/${item._id}/quantity`, {
      lensType,
      powerKey,
      quantity: newQty,
    });
    if (!res.success) {
      onUpdate({
        ...item,
        quantities: {
          ...item.quantities,
          [lensType]: { ...quantities },
        },
      });
      toast(res.message || "Failed to update", "error");
    }
  }, [item, lensType, quantities, onUpdate, toast]);

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

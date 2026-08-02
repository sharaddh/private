import { useState, useCallback } from "react";
import type { LensType, LensStockItem } from "../../types/lensStock";
import api from "../../api";
import { useToast } from "../../context";
import PowerRow from "./PowerRow";
import CompoundGrid from "./CompoundGrid";
import PlainGrid from "./PlainGrid";

interface Props {
  item: LensStockItem;
  onUpdate: (updated: LensStockItem) => void;
}

type TabKey = LensType | "plain";

const TABS: { key: TabKey; label: string }[] = [
  { key: "sph", label: "SPH" },
  { key: "cyl", label: "CYL" },
  { key: "compound", label: "Compound" },
  { key: "plain", label: "Plain" },
];

export default function LensGrid({ item, onUpdate }: Props) {
  const [lensType, setLensType] = useState<TabKey>("sph");
  const { toast } = useToast();

  const effectiveLensType: LensType = lensType === "plain" ? "sph" : lensType;
  const quantities = item.quantities?.[effectiveLensType] || {};

  const handleIncrement = useCallback(async (powerKey: string) => {
    const current = quantities[powerKey] || 0;
    const newQty = current + 1;
    onUpdate({
      ...item,
      quantities: {
        ...item.quantities,
        [effectiveLensType]: { ...quantities, [powerKey]: newQty },
      },
    });
    const res = await api.put<{ _id: string }>(`/api/warehouse/lens-stock/${item._id}/quantity`, {
      lensType: effectiveLensType,
      powerKey,
      quantity: newQty,
    });
    if (!res.success) {
      onUpdate({
        ...item,
        quantities: {
          ...item.quantities,
          [effectiveLensType]: { ...quantities },
        },
      });
      toast(res.message || "Failed to update", "error");
    }
  }, [item, effectiveLensType, quantities, onUpdate, toast]);

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
        [effectiveLensType]: updated,
      },
    });
    const res = await api.put<{ _id: string }>(`/api/warehouse/lens-stock/${item._id}/quantity`, {
      lensType: effectiveLensType,
      powerKey,
      quantity: newQty,
    });
    if (!res.success) {
      onUpdate({
        ...item,
        quantities: {
          ...item.quantities,
          [effectiveLensType]: { ...quantities },
        },
      });
      toast(res.message || "Failed to update", "error");
    }
  }, [item, effectiveLensType, quantities, onUpdate, toast]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 bg-th-elevated rounded-pill p-0.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setLensType(t.key)}
            className={`flex-1 px-2 py-2.5 rounded-pill text-small-bold transition-all active:scale-95 ${
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
      ) : lensType === "plain" ? (
        <PlainGrid
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

import { useState, useCallback } from "react";
import { lensStockService } from "../../services";
import { useToast } from "../../context/ToastContext";
import type { LensStockItem, LensStockScope, LensType } from "../../types";
import { TABS, type TabKey } from "./powers";
import PowerRow from "./PowerRow";
import CompoundGrid from "./CompoundGrid";
import PlainGrid from "./PlainGrid";

interface Props {
  item: LensStockItem;
  scope: LensStockScope;
  onUpdate: (updated: LensStockItem) => void;
}

export default function LensGrid({ item, scope, onUpdate }: Props) {
  const [lensType, setLensType] = useState<TabKey>("sph");
  const toast = useToast();

  const effectiveLensType: LensType = lensType === "plain" ? "sph" : lensType;
  const quantities = item.quantities?.[effectiveLensType] || {};

  const persist = useCallback(async (powerKey: string, newQty: number) => {
    onUpdate({
      ...item,
      quantities: {
        ...item.quantities,
        [effectiveLensType]: { ...quantities, [powerKey]: newQty },
      },
    });
    const res = await lensStockService.updateQuantity(scope, item._id, effectiveLensType, powerKey, newQty);
    if (!res.success) {
      onUpdate({
        ...item,
        quantities: {
          ...item.quantities,
          [effectiveLensType]: { ...quantities },
        },
      });
      toast.error(res.message || "Failed to update");
    }
  }, [item, effectiveLensType, quantities, scope, onUpdate, toast]);

  const handleIncrement = useCallback((powerKey: string) => {
    persist(powerKey, (quantities[powerKey] || 0) + 1);
  }, [quantities, persist]);

  const handleDecrement = useCallback((powerKey: string) => {
    const current = quantities[powerKey] || 0;
    if (current <= 0) return;
    persist(powerKey, current - 1);
  }, [quantities, persist]);

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

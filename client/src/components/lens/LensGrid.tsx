import { useCallback } from "react";
import { lensStockService } from "../../services";
import { useToast } from "../../context/ToastContext";
import type { LensStockItem, LensStockScope, LensType } from "../../types";
import PowerRow from "./PowerRow";
import CompoundGrid from "./CompoundGrid";
import PlainGrid from "./PlainGrid";
import type { TabKey } from "./powers";

interface Props {
  item: LensStockItem;
  scope: LensStockScope;
  lensType: TabKey;
  onUpdate?: (updated: LensStockItem) => void;
  onAddToCart?: (lensType: LensType, powerKey: string) => void;
  onRemoveFromCart?: (lensType: LensType, powerKey: string) => void;
  clickTitle?: string;
  cartQty?: Record<string, number>;
}

export default function LensGrid({ item, scope, lensType, onUpdate, onAddToCart, onRemoveFromCart, clickTitle, cartQty }: Props) {
  const toast = useToast();

  const effectiveLensType: LensType = lensType === "plain" ? "sph" : lensType;
  const quantities = item.quantities?.[effectiveLensType] || {};

  const persist = useCallback(async (powerKey: string, newQty: number) => {
    if (!onUpdate) return;
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

  const handleAddToCart = useCallback(
    (powerKey: string) => {
      if (onAddToCart) onAddToCart(effectiveLensType, powerKey);
    },
    [onAddToCart, effectiveLensType]
  );

  const handleRemoveFromCart = useCallback(
    (powerKey: string) => {
      if (onRemoveFromCart) onRemoveFromCart(effectiveLensType, powerKey);
    },
    [onRemoveFromCart, effectiveLensType]
  );

  const inc = onUpdate ? handleIncrement : undefined;
  const dec = onUpdate ? handleDecrement : undefined;
  const clickToAdd = Boolean(onAddToCart) && !onUpdate;

  if (lensType === "compound") {
    return (
      <CompoundGrid
        quantities={quantities}
        onIncrement={inc}
        onDecrement={dec}
        onAddToCart={onAddToCart ? handleAddToCart : undefined}
        onRemoveFromCart={onRemoveFromCart ? handleRemoveFromCart : undefined}
        clickToAdd={clickToAdd}
        clickTitle={clickTitle}
        cartQty={cartQty}
      />
    );
  }
  if (lensType === "plain") {
    return (
      <PlainGrid
        quantities={quantities}
        onIncrement={inc}
        onDecrement={dec}
        onAddToCart={onAddToCart ? handleAddToCart : undefined}
        onRemoveFromCart={onRemoveFromCart ? handleRemoveFromCart : undefined}
        clickToAdd={clickToAdd}
        clickTitle={clickTitle}
        cartQty={cartQty?.["+0.00"]}
      />
    );
  }
  return (
    <PowerRow
      quantities={quantities}
      onIncrement={inc}
      onDecrement={dec}
      onAddToCart={onAddToCart ? handleAddToCart : undefined}
      onRemoveFromCart={onRemoveFromCart ? handleRemoveFromCart : undefined}
      clickToAdd={clickToAdd}
      clickTitle={clickTitle}
      cartQty={cartQty}
    />
  );
}

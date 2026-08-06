import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { LensCartApi, LensType, ShopCartItem, ShopLensWithdrawal, ShopLensWithdrawalItemInput, WithdrawResult } from "../../types";

interface LensCartContextValue {
  items: ShopCartItem[];
  count: number;
  loading: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  addToCart: (coating: string, lensType: LensType, powerKey: string, quantity?: number) => Promise<boolean>;
  updateQty: (id: string, quantity: number) => Promise<boolean>;
  removeItem: (id: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  withdraw: (note?: string) => Promise<WithdrawResult | null>;
  getWithdrawals: () => ReturnType<LensCartApi["getWithdrawals"]>;
  updateWithdrawal: (id: string, items: ShopLensWithdrawalItemInput[]) => Promise<ShopLensWithdrawal | null>;
  deleteWithdrawal: (id: string) => Promise<boolean>;
  fogMarkEnabled: boolean;
  updateFogMark: (id: string, fogMark: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const LensCartContext = createContext<LensCartContextValue | null>(null);

export function LensCartProvider({ api, children }: { api: LensCartApi; children: React.ReactNode }) {
  const [items, setItems] = useState<ShopCartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api.getItems();
    if (res.success && res.data) {
      setItems(res.data);
    }
    setLoading(false);
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addToCart = useCallback(
    async (coating: string, lensType: LensType, powerKey: string, quantity = 1): Promise<boolean> => {
      const res = await api.addItem(coating, lensType, powerKey, quantity);
      if (res.success) {
        await refresh();
        return true;
      }
      return false;
    },
    [api, refresh]
  );

  const updateQty = useCallback(
    async (id: string, quantity: number): Promise<boolean> => {
      const res = await api.updateItem(id, quantity);
      if (res.success) {
        await refresh();
        return true;
      }
      return false;
    },
    [api, refresh]
  );

  const removeItem = useCallback(
    async (id: string): Promise<boolean> => {
      const res = await api.removeItem(id);
      if (res.success) {
        await refresh();
        return true;
      }
      return false;
    },
    [api, refresh]
  );

  const clear = useCallback(async (): Promise<boolean> => {
    const res = await api.clear();
    if (res.success) {
      await refresh();
      return true;
    }
    return false;
  }, [api, refresh]);

  const withdraw = useCallback(
    async (note?: string): Promise<WithdrawResult | null> => {
      const res = await api.withdraw(note);
      if (res.success && res.data) {
        await refresh();
        return res.data;
      }
      return null;
    },
    [api, refresh]
  );

  const getWithdrawals = useCallback(() => api.getWithdrawals(), [api]);

  const updateWithdrawal = useCallback(
    async (id: string, items: ShopLensWithdrawalItemInput[]): Promise<ShopLensWithdrawal | null> => {
      const res = await api.updateWithdrawal(id, items);
      if (res.success && res.data) return res.data;
      return null;
    },
    [api]
  );

  const deleteWithdrawal = useCallback(
    async (id: string): Promise<boolean> => {
      const res = await api.deleteWithdrawal(id);
      return res.success;
    },
    [api]
  );

  const fogMarkEnabled = Boolean(api.updateFogMark);

  const updateFogMark = useCallback(
    async (id: string, fogMark: string): Promise<boolean> => {
      if (!api.updateFogMark) return false;
      const res = await api.updateFogMark(id, fogMark);
      if (res.success) {
        await refresh();
        return true;
      }
      return false;
    },
    [api, refresh]
  );

  const value = useMemo<LensCartContextValue>(
    () => ({
      items,
      count: items.length,
      loading,
      open,
      setOpen,
      addToCart,
      updateQty,
      removeItem,
      clear,
      withdraw,
      getWithdrawals,
      updateWithdrawal,
      deleteWithdrawal,
      fogMarkEnabled,
      updateFogMark,
      refresh,
    }),
    [items, loading, open, addToCart, updateQty, removeItem, clear, withdraw, getWithdrawals, updateWithdrawal, deleteWithdrawal, fogMarkEnabled, updateFogMark, refresh]
  );

  return <LensCartContext.Provider value={value}>{children}</LensCartContext.Provider>;
}

export function useLensCart(): LensCartContextValue {
  const ctx = useContext(LensCartContext);
  if (!ctx) throw new Error("useLensCart must be used within LensCartProvider");
  return ctx;
}

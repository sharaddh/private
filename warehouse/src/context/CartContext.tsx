import { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "../api";
import { useToast } from "./ToastContext";

const STORAGE_KEY = "kmj_warehouse_cart";

export interface CartItemData {
  _id: string;
  coating: string;
  lensType: string;
  powerKey: string;
  quantity: number;
  createdAt?: string;
}

function itemKey(coating: string, lensType: string, powerKey: string) {
  return `${coating}::${lensType}::${powerKey}`;
}

function loadLocal(): CartItemData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CartItemData[];
  } catch {
    return [];
  }
}

function saveLocal(items: CartItemData[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

interface CartContextType {
  items: CartItemData[];
  count: number;
  loading: boolean;
  addToCart: (coating: string, lensType: string, powerKey: string, quantity?: number) => Promise<boolean>;
  updateQty: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  removeByDetails: (coating: string, lensType: string, powerKey: string) => Promise<void>;
  clearCart: () => Promise<void>;
  withdraw: () => Promise<{ withdrawn: number; errors: string[] } | null>;
  isInCart: (coating: string, lensType: string, powerKey: string) => boolean;
  getItemQty: (coating: string, lensType: string, powerKey: string) => number;
}

const CartContext = createContext<CartContextType | null>(null);

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export function useCartCount() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCartCount must be used within CartProvider");
  return ctx.count;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const fetchCart = useCallback(async () => {
    const res = await api.get<CartItemData[]>("/api/cart");
    if (res.success && Array.isArray(res.data)) {
      setItems(res.data);
      saveLocal(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setItems(loadLocal());
    fetchCart();
  }, [fetchCart]);

  const count = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

  const keyMap = useMemo(() => {
    const map = new Map<string, CartItemData>();
    for (const item of items) {
      map.set(itemKey(item.coating, item.lensType, item.powerKey), item);
    }
    return map;
  }, [items]);

  const addToCart = useCallback(async (coating: string, lensType: string, powerKey: string, quantity: number = 1): Promise<boolean> => {
    const res = await api.post<CartItemData>("/api/cart", { coating, lensType, powerKey, quantity });
    if (res.success && res.data) {
      setItems((prev) => {
        const key = itemKey(coating, lensType, powerKey);
        const idx = prev.findIndex((i) => itemKey(i.coating, i.lensType, i.powerKey) === key);
        let next: CartItemData[];
        if (idx >= 0) {
          next = [...prev];
          next[idx] = res.data!;
        } else {
          next = [...prev, res.data!];
        }
        saveLocal(next);
        return next;
      });
      return true;
    }
    toast(res.message || "Failed to add to cart", "error");
    return false;
  }, [toast]);

  const updateQty = useCallback(async (itemId: string, quantity: number) => {
    if (quantity < 1) {
      const item = itemsRef.current.find((i) => i._id === itemId);
      if (item) {
        setItems((prev) => {
          const next = prev.filter((i) => i._id !== itemId);
          saveLocal(next);
          return next;
        });
        api.del(`/api/cart/${itemId}`).catch(() => {
          setItems((prev) => [...prev, item]);
        });
      }
      return;
    }
    setItems((prev) => {
      const next = prev.map((i) => (i._id === itemId ? { ...i, quantity } : i));
      saveLocal(next);
      return next;
    });
    const res = await api.put(`/api/cart/${itemId}`, { quantity });
    if (!res.success) {
      setItems((prev) => {
        const next = prev.map((i) => (i._id === itemId ? { ...i, quantity: i.quantity } : i));
        saveLocal(next);
        return next;
      });
      toast(res.message || "Failed to update", "error");
    }
  }, [toast]);

  const removeItem = useCallback(async (itemId: string) => {
    const removed = itemsRef.current.find((i) => i._id === itemId);
    setItems((prev) => {
      const next = prev.filter((i) => i._id !== itemId);
      saveLocal(next);
      return next;
    });
    const res = await api.del(`/api/cart/${itemId}`);
    if (!res.success && removed) {
      setItems((prev) => {
        const next = [...prev, removed];
        saveLocal(next);
        return next;
      });
      toast(res.message || "Failed to remove", "error");
    }
  }, [toast]);

  const removeByDetails = useCallback(async (coating: string, lensType: string, powerKey: string) => {
    const key = itemKey(coating, lensType, powerKey);
    const item = keyMap.get(key);
    if (item) {
      const removed = item;
      setItems((prev) => {
        const next = prev.filter((i) => i._id !== item._id);
        saveLocal(next);
        return next;
      });
      const res = await api.del(`/api/cart/${item._id}`);
      if (!res.success) {
        setItems((prev) => {
          const next = [...prev, removed];
          saveLocal(next);
          return next;
        });
        toast(res.message || "Failed to remove", "error");
      }
    }
  }, [keyMap, toast]);

  const clearCart = useCallback(async () => {
    const prev = itemsRef.current;
    setItems([]);
    saveLocal([]);
    const res = await api.del("/api/cart");
    if (!res.success) {
      setItems(prev);
      saveLocal(prev);
      toast(res.message || "Failed to clear cart", "error");
    }
  }, [toast]);

  const withdraw = useCallback(async (): Promise<{ withdrawn: number; errors: string[] } | null> => {
    const res = await api.post<{ withdrawn: number; errors: string[] }>("/api/cart/withdraw", {});
    if (res.success && res.data) {
      setItems([]);
      saveLocal([]);
      if (res.data.errors.length > 0) {
        toast(`${res.data.withdrawn} withdrawn, ${res.data.errors.length} had errors`, "error");
      } else {
        toast(`${res.data.withdrawn} item${res.data.withdrawn !== 1 ? "s" : ""} withdrawn`, "success");
      }
      return res.data;
    }
    toast(res.message || "Failed to withdraw", "error");
    return null;
  }, [toast]);

  const isInCart = useCallback((coating: string, lensType: string, powerKey: string): boolean => {
    return keyMap.has(itemKey(coating, lensType, powerKey));
  }, [keyMap]);

  const getItemQty = useCallback((coating: string, lensType: string, powerKey: string): number => {
    const item = keyMap.get(itemKey(coating, lensType, powerKey));
    return item?.quantity || 0;
  }, [keyMap]);

  const value = useMemo<CartContextType>(() => ({
    items, count, loading, addToCart, updateQty, removeItem, removeByDetails, clearCart, withdraw, isInCart, getItemQty,
  }), [items, count, loading, addToCart, updateQty, removeItem, removeByDetails, clearCart, withdraw, isInCart, getItemQty]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

import { createContext, useContext, useState, useEffect, useCallback } from "react";
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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

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

  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  const cartKeySet = new Set(items.map((i) => itemKey(i.coating, i.lensType, i.powerKey)));

  async function addToCart(coating: string, lensType: string, powerKey: string, quantity: number = 1): Promise<boolean> {
    const res = await api.post<CartItemData>("/api/cart", { coating, lensType, powerKey, quantity });
    if (res.success) {
      await fetchCart();
      return true;
    }
    toast(res.message || "Failed to add to cart", "error");
    return false;
  }

  async function updateQty(itemId: string, quantity: number) {
    if (quantity < 1) {
      await removeItem(itemId);
      return;
    }
    const res = await api.put(`/api/cart/${itemId}`, { quantity });
    if (res.success) {
      setItems((prev) => {
        const next = prev.map((i) => (i._id === itemId ? { ...i, quantity } : i));
        saveLocal(next);
        return next;
      });
    } else {
      toast(res.message || "Failed to update", "error");
    }
  }

  async function removeItem(itemId: string) {
    const res = await api.del(`/api/cart/${itemId}`);
    if (res.success) {
      setItems((prev) => {
        const next = prev.filter((i) => i._id !== itemId);
        saveLocal(next);
        return next;
      });
    } else {
      toast(res.message || "Failed to remove", "error");
    }
  }

  async function removeByDetails(coating: string, lensType: string, powerKey: string) {
    const key = itemKey(coating, lensType, powerKey);
    const item = items.find((i) => itemKey(i.coating, i.lensType, i.powerKey) === key);
    if (item) {
      await removeItem(item._id);
    }
  }

  async function clearCart() {
    const res = await api.del("/api/cart");
    if (res.success) {
      setItems([]);
      saveLocal([]);
    } else {
      toast(res.message || "Failed to clear cart", "error");
    }
  }

  async function withdraw(): Promise<{ withdrawn: number; errors: string[] } | null> {
    const res = await api.post<{ withdrawn: number; errors: string[] }>("/api/cart/withdraw");
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
  }

  function isInCart(coating: string, lensType: string, powerKey: string): boolean {
    return cartKeySet.has(itemKey(coating, lensType, powerKey));
  }

  function getItemQty(coating: string, lensType: string, powerKey: string): number {
    const key = itemKey(coating, lensType, powerKey);
    const item = items.find((i) => itemKey(i.coating, i.lensType, i.powerKey) === key);
    return item?.quantity || 0;
  }

  return (
    <CartContext.Provider value={{ items, count, loading, addToCart, updateQty, removeItem, removeByDetails, clearCart, withdraw, isInCart, getItemQty }}>
      {children}
    </CartContext.Provider>
  );
}

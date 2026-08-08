import { useCallback, useEffect, useState } from "react";
import { useApi, useApiPost, useApiPut, useApiDelete } from "./useApi";
import { inventoryService, type InventoryListParams } from "../services";
import type { InventoryItem, InventoryFormData, PaginatedResponse } from "../types";

export function useSkuExists(sku: string, enabled: boolean) {
  const [result, setResult] = useState<{ exists: boolean; item?: InventoryItem } | null>(null);
  const [checking, setChecking] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled || !sku.trim()) {
      setResult(null);
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    inventoryService
      .checkSkuExists(sku)
      .then((res) => {
        if (cancelled) return;
        setResult(res.success ? { exists: !!res.data?.exists, item: res.data?.item } : null);
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sku, enabled]);

  return { exists: result?.exists ?? false, item: result?.item, checking };
}

export function useInventory(params?: InventoryListParams) {
  const qs = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString()}`
    : "";

  const { data, loading, error, refetch } = useApi<PaginatedResponse<InventoryItem>>(
    () => inventoryService.listFiltered(params ?? {}),
    [JSON.stringify(params)],
    { cacheKey: `/api/inventory${qs}` }
  );

  return {
    items: Array.isArray(data) ? data : data?.data ?? [],
    total: data && !Array.isArray(data) ? data.total ?? 0 : 0,
    page: data && !Array.isArray(data) ? data.page ?? 1 : 1,
    pages: data && !Array.isArray(data) ? data.pages ?? 0 : 0,
    loading,
    error,
    refetch,
  };
}

export function useInventoryItem(id: string) {
  const { data, loading, error, refetch } = useApi<InventoryItem>(
    () => inventoryService.getById<InventoryItem>(id),
    [id]
  );

  return { item: data, loading, error, refetch };
}

export function useCreateInventoryItem() {
  const { loading, error, reset } = useApiPost<InventoryItem, InventoryFormData>();

  const create = useCallback(async (data: InventoryFormData) => {
    return inventoryService.create<InventoryItem>(data);
  }, []);

  return { create, loading, error, reset };
}

export function useUpdateInventoryItem() {
  const { loading, error, reset } = useApiPut<InventoryItem, Partial<InventoryFormData>>();

  const update = useCallback(async (id: string, data: Partial<InventoryFormData>) => {
    return inventoryService.update<InventoryItem>(id, data);
  }, []);

  return { update, loading, error, reset };
}

export function useDeleteInventoryItem() {
  const { loading, error, reset } = useApiDelete();

  const remove = useCallback(async (id: string) => {
    return inventoryService.remove(id);
  }, []);

  return { remove, loading, error, reset };
}

export function useAdjustStock() {
  const { loading, error, reset } = useApiPost<InventoryItem, { quantity: number; note: string }>();

  const adjust = useCallback(async (id: string, quantity: number, note: string) => {
    return inventoryService.adjustStock(id, { quantity, note });
  }, []);

  return { adjust, loading, error, reset };
}

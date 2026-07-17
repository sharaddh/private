import { useCallback } from "react";
import { useApi, useApiPost, useApiPut, useApiDelete } from "./useApi";
import { inventoryService } from "../services";
import type { InventoryItem, InventoryFormData, PaginatedResponse, PaginationParams } from "../types";

export function useInventory(params?: PaginationParams & { category?: string; location?: string; brand?: string }) {
  const qs = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`
    : "";

  const { data, loading, error, refetch } = useApi<PaginatedResponse<InventoryItem>>(
    () => inventoryService.listFiltered(params ?? {}),
    [JSON.stringify(params)],
    { cacheKey: `/api/inventory${qs}` }
  );

  return { items: data?.data ?? [], total: data?.total ?? 0, pages: data?.pages ?? 0, loading, error, refetch };
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

import { useCallback } from "react";
import { useApi, useApiPost, useApiPut, useApiDelete } from "./useApi";
import { orderService } from "../services";
import type { Order, OrderStatus, PaginatedResponse, PaginationParams, DateRangeParams } from "../types";

export function useOrders(params?: PaginationParams & DateRangeParams & { status?: string }) {
  const qs = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`
    : "";

  const { data, loading, error, refetch } = useApi<PaginatedResponse<Order>>(
    () => orderService.listFiltered(params ?? {}),
    [JSON.stringify(params)],
    { cacheKey: `/api/orders${qs}` }
  );

  return { orders: data?.data ?? [], total: data?.total ?? 0, pages: data?.pages ?? 0, loading, error, refetch };
}

export function useOrder(id: string) {
  const { data, loading, error, refetch } = useApi<Order>(
    () => orderService.getById<Order>(id),
    [id],
    { cacheKey: `/api/orders/${id}` }
  );

  return { order: data, loading, error, refetch };
}

export function useCreateOrder() {
  const { execute, loading, error, reset } = useApiPost<Order, Partial<Order>>();

  const create = useCallback(async (data: Partial<Order>) => {
    return orderService.create<Order>(data);
  }, []);

  return { create, loading, error, reset };
}

export function useUpdateOrder() {
  const { execute, loading, error, reset } = useApiPut<Order, Partial<Order>>();

  const update = useCallback(async (id: string, data: Partial<Order>) => {
    return orderService.update<Order>(id, data);
  }, []);

  return { update, loading, error, reset };
}

export function useDeleteOrder() {
  const { execute, loading, error, reset } = useApiDelete();

  const remove = useCallback(async (id: string) => {
    return orderService.remove(id);
  }, []);

  return { remove, loading, error, reset };
}

export function useAdvanceOrderStatus() {
  const { loading, error, reset } = useApiPost<Order, { status: OrderStatus }>();

  const advance = useCallback(async (id: string, status: OrderStatus) => {
    return orderService.advanceStatus(id, status);
  }, []);

  return { advance, loading, error, reset };
}

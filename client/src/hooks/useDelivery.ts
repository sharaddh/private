import { useCallback } from "react";
import { useApi, useApiPost } from "./useApi";
import { deliveryService } from "../services";
import type { Order, PaginatedResponse, PaginationParams, DateRangeParams } from "../types";

export function useReadyDeliveries(params?: PaginationParams) {
  const { data, loading, error, refetch } = useApi<PaginatedResponse<Order>>(
    () => deliveryService.listReady(params),
    [JSON.stringify(params)]
  );

  return { orders: data?.data ?? [], total: data?.total ?? 0, loading, error, refetch };
}

export function useDeliveredOrders(params?: PaginationParams & DateRangeParams) {
  const { data, loading, error, refetch } = useApi<PaginatedResponse<Order>>(
    () => deliveryService.listDelivered(params),
    [JSON.stringify(params)]
  );

  return { orders: data?.data ?? [], total: data?.total ?? 0, loading, error, refetch };
}

export function useMarkDelivered() {
  const { loading, error, reset } = useApiPost<Order, { deliveryDate?: string; notes?: string }>();

  const deliver = useCallback(async (orderId: string, data?: { deliveryDate?: string; notes?: string }) => {
    return deliveryService.markDelivered(orderId, data);
  }, []);

  return { deliver, loading, error, reset };
}

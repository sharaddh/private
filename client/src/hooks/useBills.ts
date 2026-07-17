import { useCallback } from "react";
import { useApi, useApiPost, useApiDelete } from "./useApi";
import { billService } from "../services";
import type { Bill, BillItem, PaginatedResponse, PaginationParams, DateRangeParams } from "../types";

export function useBills(params?: PaginationParams & DateRangeParams & { status?: string }) {
  const qs = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`
    : "";

  const { data, loading, error, refetch } = useApi<PaginatedResponse<Bill>>(
    () => billService.listFiltered(params ?? {}),
    [JSON.stringify(params)],
    { cacheKey: `/api/bills${qs}` }
  );

  return { bills: data?.data ?? [], total: data?.total ?? 0, pages: data?.pages ?? 0, loading, error, refetch };
}

export function useBill(id: string) {
  const { data, loading, error, refetch } = useApi<Bill>(
    () => billService.getById<Bill>(id),
    [id],
    { cacheKey: `/api/bills/${id}` }
  );

  return { bill: data, loading, error, refetch };
}

export function useCreateBill() {
  const { execute, loading, error, reset } = useApiPost<Bill, {
    customerId: string;
    items: BillItem[];
    discount?: number;
    tax?: number;
    advancePaid?: number;
    notes?: string;
  }>();

  const create = useCallback(async (data: {
    customerId: string;
    items: BillItem[];
    discount?: number;
    tax?: number;
    advancePaid?: number;
    notes?: string;
  }) => {
    return billService.createWithItems(data);
  }, []);

  return { create, loading, error, reset };
}

export function useCancelBill() {
  const { loading, error, reset } = useApiPost<Bill>();

  const cancel = useCallback(async (id: string) => {
    return billService.cancel(id);
  }, []);

  return { cancel, loading, error, reset };
}

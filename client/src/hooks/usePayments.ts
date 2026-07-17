import { useCallback } from "react";
import { useApi, useApiPost } from "./useApi";
import { paymentService } from "../services";
import type { Payment, PaymentMode, PaginatedResponse, PaginationParams, DateRangeParams } from "../types";

export function usePayments(params?: PaginationParams & DateRangeParams & { paymentMode?: PaymentMode }) {
  const qs = params
    ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`
    : "";

  const { data, loading, error, refetch } = useApi<PaginatedResponse<Payment>>(
    () => paymentService.listFiltered(params ?? {}),
    [JSON.stringify(params)],
    { cacheKey: `/api/payments${qs}` }
  );

  return { payments: data?.data ?? [], total: data?.total ?? 0, pages: data?.pages ?? 0, loading, error, refetch };
}

export function useCreatePayment() {
  const { execute, loading, error, reset } = useApiPost<Payment, {
    customerId: string;
    amount: number;
    paymentMode: PaymentMode;
    billId?: string;
    notes?: string;
  }>();

  const create = useCallback(async (data: {
    customerId: string;
    amount: number;
    paymentMode: PaymentMode;
    billId?: string;
    notes?: string;
  }) => {
    return paymentService.create<Payment>(data);
  }, []);

  return { create, loading, error, reset };
}

export function usePaymentSummary(params?: DateRangeParams) {
  const { data, loading, error, refetch } = useApi<{
    total: number;
    byMode: { mode: string; total: number; count: number }[];
  }>(
    () => paymentService.getSummary(params),
    [JSON.stringify(params)]
  );

  return { summary: data, loading, error, refetch };
}

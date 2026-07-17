import { useCallback } from "react";
import { useApi, useApiPost, useApiPut, useApiDelete } from "./useApi";
import { customerService } from "../services";
import type { Customer, CustomerFormData, PaginatedResponse, PaginationParams } from "../types";

export function useCustomers(params?: PaginationParams) {
  const path = params
    ? `/api/customers?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString()}`
    : "/api/customers";

  const { data, loading, error, refetch } = useApi<PaginatedResponse<Customer>>(
    () => customerService.list<PaginatedResponse<Customer>>(params),
    [JSON.stringify(params)],
    { cacheKey: path }
  );

  return { customers: data?.data ?? [], total: data?.total ?? 0, loading, error, refetch };
}

export function useCustomer(id: string) {
  const { data, loading, error, refetch } = useApi<Customer>(
    () => customerService.getById<Customer>(id),
    [id],
    { cacheKey: `/api/customers/${id}` }
  );

  return { customer: data, loading, error, refetch };
}

export function useCreateCustomer() {
  const { execute, loading, error, reset } = useApiPost<Customer, CustomerFormData>();

  const create = useCallback(async (formData: CustomerFormData) => {
    const result = await customerService.create<Customer>(formData);
    return result;
  }, []);

  return { create, loading, error, reset };
}

export function useUpdateCustomer() {
  const { execute, loading, error, reset } = useApiPut<Customer, Partial<CustomerFormData>>();

  const update = useCallback(async (id: string, formData: Partial<CustomerFormData>) => {
    const result = await customerService.update<Customer>(id, formData);
    return result;
  }, []);

  return { update, loading, error, reset };
}

export function useDeleteCustomer() {
  const { execute, loading, error, reset } = useApiDelete();

  const remove = useCallback(async (id: string) => {
    const result = await customerService.remove(id);
    return result;
  }, []);

  return { remove, loading, error, reset };
}

export function useCustomerSearch(search: string) {
  const { data, loading, error } = useApi<PaginatedResponse<Customer>>(
    () => customerService.search(search),
    [search],
    { enabled: search.length >= 2 }
  );

  return { results: data?.data ?? [], loading, error };
}

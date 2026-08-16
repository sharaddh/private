import { useEffect, useState } from 'react';
import { useApi } from './useApi';
import { inventoryV2Service } from '../services';
import type { PaginatedResponse } from '../types';
import type {
  BrandSummary,
  BrandDetail,
  CountSession,
  CountSessionDetail,
  InventoryDashboard,
  InventoryMovement,
  InventoryProduct,
  InventoryVariant,
  MovementListParams,
  ProductDetail,
  ProductListParams,
  Rack,
  RackItems,
  VariantDetail,
  VariantListParams,
  WithdrawalListParams,
  WithdrawalV2,
} from '../types/inventoryV2';

function pathWithParams(base: string, params?: Record<string, unknown>): string {
  if (!params) return base;
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '');
  if (entries.length === 0) return base;
  return `${base}?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}`;
}

interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

function pagedFrom<T>(data: PaginatedResponse<T> | null | undefined): PagedResult<T> {
  const d = data as PaginatedResponse<T> | undefined;
  return {
    items: d?.data ?? [],
    total: d?.total ?? 0,
    page: d?.page ?? 1,
    pages: d?.pages ?? 0,
  };
}

export function useV2Dashboard(threshold?: number) {
  const { data, loading, error, refetch } = useApi<InventoryDashboard>(
    () => inventoryV2Service.getDashboard(threshold),
    [threshold],
    {
      cacheKey: pathWithParams(
        '/api/inventory/dashboard',
        threshold !== undefined ? { threshold } : undefined
      ),
    }
  );
  return { dashboard: data, loading, error, refetch };
}

export function useV2Brands(threshold?: number) {
  const { data, loading, error, refetch } = useApi<BrandSummary[]>(
    () => inventoryV2Service.listBrands(threshold),
    [threshold],
    {
      cacheKey: pathWithParams(
        '/api/inventory/brands',
        threshold !== undefined ? { threshold } : undefined
      ),
    }
  );
  return { brands: Array.isArray(data) ? data : [], loading, error, refetch };
}

export function useV2BrandDetail(id: string) {
  const { data, loading, error, refetch } = useApi<BrandDetail>(
    () => inventoryV2Service.getBrandSummary(id),
    [id],
    { enabled: !!id, cacheKey: id ? `/api/inventory/brands/${id}/summary` : undefined }
  );
  return { detail: data, loading, error, refetch };
}

export function useV2Products(params?: ProductListParams) {
  const path = pathWithParams('/api/inventory/products', params as Record<string, unknown>);
  const { data, loading, error, refetch } = useApi<PaginatedResponse<InventoryProduct>>(
    () => inventoryV2Service.listProducts(params),
    [JSON.stringify(params)],
    { cacheKey: path }
  );
  const p = pagedFrom(data);
  return {
    products: p.items,
    total: p.total,
    page: p.page,
    pages: p.pages,
    loading,
    error,
    refetch,
  };
}

export function useV2ProductDetail(id: string) {
  const { data, loading, error, refetch } = useApi<ProductDetail>(
    () => inventoryV2Service.getProduct(id),
    [id],
    { enabled: !!id, cacheKey: id ? `/api/inventory/products/${id}` : undefined }
  );
  return { detail: data, loading, error, refetch };
}

export function useV2Variants(params?: VariantListParams) {
  const path = pathWithParams('/api/inventory/variants', params as Record<string, unknown>);
  const { data, loading, error, refetch } = useApi<PaginatedResponse<InventoryVariant>>(
    () => inventoryV2Service.listVariants(params),
    [JSON.stringify(params)],
    { cacheKey: path }
  );
  const p = pagedFrom(data);
  return {
    variants: p.items,
    total: p.total,
    page: p.page,
    pages: p.pages,
    loading,
    error,
    refetch,
  };
}

export function useV2VariantDetail(id: string) {
  const { data, loading, error, refetch } = useApi<VariantDetail>(
    () => inventoryV2Service.getVariant(id),
    [id],
    { enabled: !!id, cacheKey: id ? `/api/inventory/variants/${id}` : undefined }
  );
  return { detail: data, loading, error, refetch };
}

export function useV2SearchVariants(query: string, enabled = true, limit = 20) {
  const [results, setResults] = useState<InventoryVariant[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = (query || '').trim();
    if (!enabled || !q) {
      setResults([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    inventoryV2Service
      .searchVariants(q, limit)
      .then((res) => {
        if (!cancelled) setResults(res.success && Array.isArray(res.data) ? res.data : []);
      })
      .catch(() => {
        if (!cancelled) setResults([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, enabled, limit]);

  return { results, loading };
}

export function useV2Racks() {
  const { data, loading, error, refetch } = useApi<Rack[]>(
    () => inventoryV2Service.listRacks(),
    [],
    { cacheKey: '/api/inventory/racks' }
  );
  return { racks: Array.isArray(data) ? data : [], loading, error, refetch };
}

export function useV2RackItems(id: string) {
  const { data, loading, error, refetch } = useApi<RackItems>(
    () => inventoryV2Service.getRackItems(id),
    [id],
    { enabled: !!id, cacheKey: id ? `/api/inventory/racks/${id}/items` : undefined }
  );
  return { detail: data, loading, error, refetch };
}

export function useV2Movements(params?: MovementListParams) {
  const path = pathWithParams('/api/inventory/movements', params as Record<string, unknown>);
  const { data, loading, error, refetch } = useApi<PaginatedResponse<InventoryMovement>>(
    () => inventoryV2Service.listMovements(params),
    [JSON.stringify(params)],
    { cacheKey: path }
  );
  const p = pagedFrom(data);
  return {
    movements: p.items,
    total: p.total,
    page: p.page,
    pages: p.pages,
    loading,
    error,
    refetch,
  };
}

export function useV2Withdrawals(params?: WithdrawalListParams) {
  const path = pathWithParams('/api/inventory/withdrawals', params as Record<string, unknown>);
  const { data, loading, error, refetch } = useApi<PaginatedResponse<WithdrawalV2>>(
    () => inventoryV2Service.listWithdrawals(params),
    [JSON.stringify(params)],
    { cacheKey: path }
  );
  const p = pagedFrom(data);
  return {
    withdrawals: p.items,
    total: p.total,
    page: p.page,
    pages: p.pages,
    loading,
    error,
    refetch,
  };
}

export function useV2CountSessions(params?: { page?: number; limit?: number }) {
  const path = pathWithParams('/api/inventory/count-sessions', params as Record<string, unknown>);
  const { data, loading, error, refetch } = useApi<PaginatedResponse<CountSession>>(
    () => inventoryV2Service.listCountSessions(params),
    [JSON.stringify(params)],
    { cacheKey: path }
  );
  const p = pagedFrom(data);
  return {
    sessions: p.items,
    total: p.total,
    page: p.page,
    pages: p.pages,
    loading,
    error,
    refetch,
  };
}

export function useV2CountSession(id: string) {
  const { data, loading, error, refetch } = useApi<CountSessionDetail>(
    () => inventoryV2Service.getCountSession(id),
    [id],
    { enabled: !!id, cacheKey: id ? `/api/inventory/count-sessions/${id}` : undefined }
  );
  return { detail: data, loading, error, refetch };
}

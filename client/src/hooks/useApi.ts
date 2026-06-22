import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";
import { useCache } from "./useCache";

interface UseApiOptions {
  cacheKey?: string;
  cacheTtl?: number;
  enabled?: boolean;
}

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T = unknown>(
  fetcher: () => Promise<{ success: boolean; data?: T; message?: string }>,
  deps: unknown[] = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  const { cacheKey, enabled = true } = options;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const cache = useCache<T>(cacheKey ?? null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher();
      if (!mountedRef.current) return;
      if (res.success && res.data !== undefined) {
        setData(res.data);
        if (cacheKey) cache.set(res.data);
      } else {
        setError(res.message || "Request failed");
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message || "Network error");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    const cached = cacheKey ? cache.get() : null;
    if (cached !== null) {
      setData(cached);
      setLoading(false);
    } else {
      fetch();
    }
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useApiGet<T = unknown>(
  path: string,
  deps: unknown[] = [],
  options: UseApiOptions = {}
): UseApiResult<T> {
  return useApi<T>(
    () => api.get(path),
    [path, ...deps],
    { cacheKey: path, ...options }
  );
}

export function useApiPost<T = unknown, B = unknown>(): {
  execute: (path: string, body: B) => Promise<{ success: boolean; data?: T; message?: string }>;
  loading: boolean;
  error: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (path: string, body: B) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post(path, body);
      if (!res.success) setError(res.message || "Request failed");
      return res;
    } catch (err) {
      const msg = (err as Error).message || "Network error";
      setError(msg);
      return { success: false, message: msg };
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error };
}

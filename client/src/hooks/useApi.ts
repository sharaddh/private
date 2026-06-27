import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";
import { useCache, getCacheSnapshot } from "./useCache";

interface UseApiOptions {
  cacheKey?: string;
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
  const initialLoadDone = useRef(false);

  const fetch = useCallback(async (isBackground = false) => {
    if (!enabled) return;
    if (!isBackground) setLoading(true);
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
      if (mountedRef.current) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    const snapshot = cacheKey ? getCacheSnapshot<T>(cacheKey) : null;
    if (snapshot?.exists && !snapshot.expired) {
      setData(snapshot.data);
      setLoading(false);
      initialLoadDone.current = true;
      fetch(true);
    } else if (snapshot?.exists && snapshot.expired) {
      setData(snapshot.data);
      setLoading(true);
      fetch();
    } else {
      fetch();
    }
    return () => { mountedRef.current = false; };
  }, [fetch]);

  const refetch = useCallback(() => {
    if (cacheKey) cache.invalidate();
    fetch();
  }, [fetch, cacheKey, cache]);

  return { data, loading, error, refetch };
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

export function useApiPost<T = any, B = any>(): {
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
      const res = await api.post<T>(path, body);
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

import { useState, useEffect, useCallback, useRef } from "react";
import api from "../api";
import { useCache, getCacheSnapshot } from "./useCache";

interface UseApiOptions {
  cacheKey?: string;
  enabled?: boolean;
  ttl?: number;
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

  const doFetch = useCallback(async (isBackground = false) => {
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
      if (mountedRef.current) setLoading(false);
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    const snapshot = cacheKey ? getCacheSnapshot<T>(cacheKey) : null;
    if (snapshot?.exists && !snapshot.expired) {
      setData(snapshot.data);
      setLoading(false);
      doFetch(true);
    } else if (snapshot?.exists && snapshot.expired) {
      setData(snapshot.data);
      setLoading(true);
      doFetch();
    } else {
      doFetch();
    }
    return () => { mountedRef.current = false; };
  }, [doFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = useCallback(() => {
    if (cacheKey) cache.invalidate();
    doFetch();
  }, [doFetch, cacheKey, cache]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch };
}

// ─── Convenience Wrappers ────────────────────────────────────────────────────

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
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (path: string, body: B) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<T>(path, body);
      if (!res.success) setError(res.message || "Request failed");
      return res;
    } catch (err) {
      const msg = (err as Error).message || "Network error";
      if (mountedRef.current) setError(msg);
      return { success: false, message: msg };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { execute, loading, error, reset };
}

export function useApiPut<T = unknown, B = unknown>(): {
  execute: (path: string, body: B) => Promise<{ success: boolean; data?: T; message?: string }>;
  loading: boolean;
  error: string | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (path: string, body: B) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.put<T>(path, body);
      if (!res.success) setError(res.message || "Request failed");
      return res;
    } catch (err) {
      const msg = (err as Error).message || "Network error";
      if (mountedRef.current) setError(msg);
      return { success: false, message: msg };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { execute, loading, error, reset };
}

export function useApiDelete<T = unknown>(): {
  execute: (path: string) => Promise<{ success: boolean; data?: T; message?: string }>;
  loading: boolean;
  error: string | null;
  reset: () => void;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const execute = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.del<T>(path);
      if (!res.success) setError(res.message || "Request failed");
      return res;
    } catch (err) {
      const msg = (err as Error).message || "Network error";
      if (mountedRef.current) setError(msg);
      return { success: false, message: msg };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { execute, loading, error, reset };
}

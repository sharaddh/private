import { useState, useEffect, useCallback, useRef } from "react";
import { getCacheSnapshot, setCache, invalidateCache } from "./useCache";

interface CachedDataResult<T> {
  data: T | null;
  loading: boolean;
  refetch: (invalidate?: boolean) => void;
}

export function useCachedData<T>(
  cacheKey: string,
  fetcher: () => Promise<{ success: boolean; data?: T }>,
  deps: unknown[] = []
): CachedDataResult<T> {
  const snapshot = getCacheSnapshot<T>(cacheKey);
  const [data, setData] = useState<T | null>(snapshot.data);
  const [loading, setLoading] = useState(!snapshot.exists);
  const mountedRef = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const doFetch = useCallback(async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const res = await fetcherRef.current();
      if (!mountedRef.current) return;
      if (res.success && res.data !== undefined) {
        setData(res.data);
        setCache(cacheKey, res.data);
      }
    } catch { /* ignore */ }
    finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [cacheKey]);

  useEffect(() => {
    mountedRef.current = true;
    const snap = getCacheSnapshot<T>(cacheKey);
    if (snap.exists) {
      setData(snap.data);
      setLoading(false);
      if (snap.expired) doFetch(true);
    } else {
      doFetch();
    }
    return () => { mountedRef.current = false; };
  }, deps);

  const refetch = useCallback((invalidate = false) => {
    if (invalidate) invalidateCache(cacheKey);
    doFetch();
  }, [cacheKey, doFetch]);

  return { data, loading, refetch };
}

import { useState, useCallback, useRef } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise: Promise<T> | null;
}

const DEFAULT_TTL = 5 * 60 * 1000;
const store = new Map<string, CacheEntry<unknown>>();

function isExpired(entry: CacheEntry<unknown>, customTtl?: number): boolean {
  return Date.now() - entry.timestamp > (customTtl ?? DEFAULT_TTL);
}

export function getCacheSnapshot<T>(key: string, customTtl?: number): { data: T | null; exists: boolean; expired: boolean } {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return { data: null, exists: false, expired: false };
  return { data: entry.data, exists: true, expired: isExpired(entry, customTtl) };
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, timestamp: Date.now(), promise: null });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function clearAllCache(): void {
  store.clear();
}

export function useCache<T>(key: string | null): {
  get: () => T | null;
  set: (data: T) => void;
  invalidate: () => void;
} {
  const [, forceRender] = useState(0);
  const keyRef = useRef(key);
  keyRef.current = key;

  const get = useCallback((): T | null => {
    const k = keyRef.current;
    if (!k) return null;
    const entry = store.get(k) as CacheEntry<T> | undefined;
    if (!entry || isExpired(entry)) {
      store.delete(k);
      return null;
    }
    return entry.data;
  }, []);

  const set = useCallback((data: T) => {
    const k = keyRef.current;
    if (!k) return;
    setCache(k, data);
    forceRender((n) => n + 1);
  }, []);

  const invalidate = useCallback(() => {
    const k = keyRef.current;
    if (!k) return;
    invalidateCache(k);
    forceRender((n) => n + 1);
  }, []);

  return { get, set, invalidate };
}

export function getCachedPromise<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing?.promise) return existing.promise;
  if (existing && !isExpired(existing)) return Promise.resolve(existing.data);

  const promise = fetcher().then((data) => {
    store.set(key, { data, timestamp: Date.now(), promise: null });
    return data;
  }).catch((err) => {
    store.delete(key);
    throw err;
  });

  store.set(key, { data: null as unknown as T, timestamp: 0, promise });
  return promise;
}

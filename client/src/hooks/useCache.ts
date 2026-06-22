import { useState, useEffect, useRef, useCallback } from "react";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise: Promise<T> | null;
}

const ttl = 5 * 60 * 1000;
const store = new Map<string, CacheEntry<unknown>>();

function isExpired(entry: CacheEntry<unknown>): boolean {
  return Date.now() - entry.timestamp > ttl;
}

export function useCache<T>(key: string | null): {
  get: () => T | null;
  set: (data: T) => void;
  invalidate: () => void;
} {
  const [, forceRender] = useState(0);

  const get = useCallback((): T | null => {
    if (!key) return null;
    const entry = store.get(key) as CacheEntry<T> | undefined;
    if (!entry || isExpired(entry)) {
      store.delete(key ?? "");
      return null;
    }
    return entry.data;
  }, [key]);

  const set = useCallback(
    (data: T) => {
      if (!key) return;
      store.set(key, { data, timestamp: Date.now(), promise: null });
      forceRender((n) => n + 1);
    },
    [key]
  );

  const invalidate = useCallback(() => {
    if (!key) return;
    store.delete(key);
    forceRender((n) => n + 1);
  }, [key]);

  useEffect(() => {
    return () => {
      if (key) store.delete(key);
    };
  }, [key]);

  return { get, set, invalidate };
}

export function getCachedPromise<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing?.promise) return existing.promise;
  if (existing && !isExpired(existing)) return Promise.resolve(existing.data);

  const promise = fetcher().then((data) => {
    store.set(key, { data, timestamp: Date.now(), promise: null });
    return data;
  });

  store.set(key, { data: null as unknown as T, timestamp: 0, promise });
  return promise;
}

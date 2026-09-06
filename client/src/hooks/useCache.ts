import { useState, useCallback, useRef } from 'react';
import { getCacheSnapshot, setCache, invalidateCache, clearAllCache } from './cacheStore';

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
    const entry = getCacheSnapshot<T>(k);
    if (!entry.exists || entry.expired) {
      invalidateCache(k);
      return null;
    }
    return entry.data;
  }, []);

  const set = useCallback(
    (data: T) => {
      const k = keyRef.current;
      if (!k) return;
      setCache(k, data);
      forceRender((n) => n + 1);
    },
    []
  );

  const invalidate = useCallback(() => {
    const k = keyRef.current;
    if (!k) return;
    invalidateCache(k);
    forceRender((n) => n + 1);
  }, []);

  return { get, set, invalidate };
}

export { getCacheSnapshot, setCache, invalidateCache, clearAllCache } from './cacheStore';
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl?: number;
  promise: Promise<T> | null;
}

const DEFAULT_TTL = 5 * 60 * 1000;
const STORAGE_KEY = '__kmj_spa_cache_v1';
const MAX_ENTRIES = 80;
const MAX_TOTAL_JSON_SIZE = 4 * 1024 * 1024;

const store = new Map<string, CacheEntry<unknown>>();

function isExpired(entry: CacheEntry<unknown>, customTtl?: number): boolean {
  const ttl = customTtl ?? entry.ttl ?? DEFAULT_TTL;
  return Date.now() - entry.timestamp > ttl;
}

function hydrate(): void {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, { data: unknown; timestamp: number }>;
    for (const [key, entry] of Object.entries(parsed)) {
      if (entry && typeof entry.timestamp === 'number') {
        store.set(key, { data: entry.data, timestamp: entry.timestamp, promise: null });
      }
    }
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}

function persist(): void {
  try {
    if (store.size > MAX_ENTRIES) {
      const sorted = [...store.entries()]
        .filter(([, e]) => !e.promise)
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      while (store.size > MAX_ENTRIES && sorted.length > 0) {
        const oldest = sorted.shift();
        if (oldest) store.delete(oldest[0]);
      }
    }

    const out: Record<string, { data: unknown; timestamp: number }> = {};
    store.forEach((entry, key) => {
      if (!entry.promise) out[key] = { data: entry.data, timestamp: entry.timestamp };
    });

    let json = JSON.stringify(out);
    if (json.length > MAX_TOTAL_JSON_SIZE) {
      const oldest = Object.keys(out).sort((a, b) => out[a]!.timestamp - out[b]!.timestamp);
      while (json.length > MAX_TOTAL_JSON_SIZE && oldest.length > 0) {
        const key = oldest.shift();
        if (!key) break;
        store.delete(key);
        delete out[key];
        json = JSON.stringify(out);
      }
    }

    if (json.length === 2) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, json);
  } catch {
    /* storage unavailable or quota exceeded — non-fatal */
  }
}

export function getCacheSnapshot<T>(
  key: string,
  customTtl?: number
): { data: T | null; exists: boolean; expired: boolean } {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) return { data: null, exists: false, expired: false };
  return { data: entry.data, exists: true, expired: isExpired(entry, customTtl) };
}

export function setCache<T>(key: string, data: T, ttl?: number): void {
  store.set(key, { data, timestamp: Date.now(), ttl, promise: null });
  persist();
}

export function invalidateCache(key: string): void {
  store.delete(key);
  persist();
}

export function clearAllCache(): void {
  store.clear();
  persist();
}

export function getCachedPromise<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing?.promise) return existing.promise;
  if (existing && !isExpired(existing)) return Promise.resolve(existing.data);

  const promise = fetcher()
    .then((data) => {
      store.set(key, { data, timestamp: Date.now(), promise: null });
      persist();
      return data;
    })
    .catch((err) => {
      store.delete(key);
      throw err;
    });

  store.set(key, { data: null as unknown as T, timestamp: 0, promise });
  return promise;
}

hydrate();
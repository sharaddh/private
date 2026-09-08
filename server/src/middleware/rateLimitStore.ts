import { MemoryStore } from "express-rate-limit";
import { RedisStore, type SendCommandFn } from "rate-limit-redis";
import { getClient, isConnected } from "../services/cache";

type IncrementResponse = { totalHits: number; resetTime: Date | undefined };

interface StoreLike {
  init?: (options: unknown) => void;
  get?: (key: string) => Promise<IncrementResponse | undefined>;
  increment: (key: string) => Promise<IncrementResponse>;
  decrement: (key: string) => Promise<void>;
  resetKey: (key: string) => Promise<void>;
  resetAll?: () => Promise<void>;
  localKeys?: boolean;
  prefix?: string;
  shutdown?: () => Promise<void>;
}

/**
 * Rate limit store that uses Redis when available (required for horizontal
 * scaling / multiple instances behind a load balancer) and falls back to an
 * in-memory store for single-instance or non-Redis deployments.
 *
 * `init` must be forwarded to the underlying store: express-rate-limit only
 * calls `store.init(options)` when the store exposes an `init` method, and
 * MemoryStore leaves its `hits` map undefined until initialized.
 */
export function createRateLimitStore(prefix: string): StoreLike {
  const memory = new MemoryStore();
  let redisStore: StoreLike | null = null;
  let initOptions: unknown = null;

  const getRedisStore = (): StoreLike | null => {
    if (redisStore) return redisStore;
    // Only use Redis when the connection actually became ready; otherwise fall
    // back to the in-memory store (Redis is optional for single-instance/dev).
    if (!isConnected()) return null;
    const client = getClient();
    if (!client) return null;
    try {
      const call = client.call.bind(client) as unknown as (
        ...args: string[]
      ) => Promise<boolean | number | string | Array<boolean | number | string>>;
      const sendCommand: SendCommandFn = (...args) => call(...args);
      redisStore = new RedisStore({ sendCommand, prefix }) as unknown as StoreLike;
      if (initOptions && redisStore.init) redisStore.init(initOptions);
    } catch {
      redisStore = null;
    }
    return redisStore;
  };

  return {
    localKeys: false,
    prefix,
    init(options) {
      initOptions = options;
      memory.init(options as never);
    },
    async increment(key) {
      const store = getRedisStore();
      if (store) return store.increment(key);
      return memory.increment(key);
    },
    async decrement(key) {
      const store = getRedisStore();
      if (store) return store.decrement(key);
      return memory.decrement(key);
    },
    async resetKey(key) {
      const store = getRedisStore();
      if (store) return store.resetKey(key);
      return memory.resetKey(key);
    },
    async resetAll() {
      const store = getRedisStore();
      if (store?.resetAll) return store.resetAll();
      return memory.resetAll?.();
    },
    async shutdown() {
      const store = getRedisStore();
      if (store?.shutdown) return store.shutdown();
      return memory.shutdown?.();
    },
  };
}

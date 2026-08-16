import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createRateLimitStore } from "./rateLimitStore";
import { getClient } from "../services/cache";

vi.mock("../services/cache", () => ({
  getClient: vi.fn(() => null),
}));

describe("createRateLimitStore", () => {
  let stores: { shutdown?: () => Promise<void> }[];

  beforeEach(() => {
    vi.mocked(getClient).mockReturnValue(null);
    stores = [];
  });

  afterEach(async () => {
    await Promise.all(stores.map((s) => s.shutdown?.()));
    vi.clearAllMocks();
  });

  function makeStore() {
    const store = createRateLimitStore("rl:test");
    stores.push(store);
    return store;
  }

  it("exposes init so express-rate-limit initializes the memory store", async () => {
    const store = makeStore();
    expect(typeof store.init).toBe("function");

    // Mirror express-rate-limit: init is only called when it exists.
    if (typeof store.init === "function") {
      store.init({ windowMs: 60000 });
    }

    const first = await store.increment("::ffff:127.0.0.1");
    expect(first.totalHits).toBe(1);

    const second = await store.increment("::ffff:127.0.0.1");
    expect(second.totalHits).toBe(2);
  });

  it("increments different keys independently", async () => {
    const store = makeStore();
    if (typeof store.init === "function") {
      store.init({ windowMs: 60000 });
    }

    await store.increment("user:1");
    await store.increment("user:1");
    const other = await store.increment("user:2");
    expect(other.totalHits).toBe(1);
  });

  it("resetKey clears the hit count for a key", async () => {
    const store = makeStore();
    if (typeof store.init === "function") {
      store.init({ windowMs: 60000 });
    }

    await store.increment("127.0.0.1");
    await store.resetKey("127.0.0.1");
    const after = await store.increment("127.0.0.1");
    expect(after.totalHits).toBe(1);
  });

  it("decrement reduces the hit count", async () => {
    const store = makeStore();
    if (typeof store.init === "function") {
      store.init({ windowMs: 60000 });
    }

    await store.increment("user:1");
    await store.increment("user:1");
    await store.decrement("user:1");
    const after = await store.increment("user:1");
    expect(after.totalHits).toBe(2);
  });
});

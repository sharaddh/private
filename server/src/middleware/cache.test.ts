import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "../types";

const { cacheGet, cacheSet, cacheDel, isConnected, recordCacheMetric } = vi.hoisted(() => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
  isConnected: vi.fn(),
  recordCacheMetric: vi.fn(),
}));

vi.mock("../services/cache", () => ({
  cacheGet,
  cacheSet,
  cacheDel,
  isConnected,
  recordCacheMetric,
}));

import { cacheRoute, invalidateCache } from "./cache";

const owner: JwtPayload = { sub: "user-1", username: "admin", role: "owner" };
const staff: JwtPayload = { sub: "user-1", username: "admin", role: "staff" };

function mockReq(method = "GET", overrides: Record<string, unknown> = {}): Request {
  return {
    method,
    headers: { "x-branch-id": "branch-1" },
    query: {},
    originalUrl: "/api/orders?limit=10&phone=9999999999",
    ...overrides,
  } as unknown as Request;
}

interface MockResponse extends Response {
  headers: Record<string, string>;
  responses: unknown[];
}

function mockRes(): MockResponse {
  const responses: unknown[] = [];
  const res: Record<string, unknown> = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    responses,
    set(name: string, value: string) {
      (res.headers as Record<string, string>)[name] = value;
      return res;
    },
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      responses.push(body);
      return res;
    },
  };
  return res as unknown as MockResponse;
}

describe("cacheRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isConnected.mockReturnValue(true);
    cacheGet.mockResolvedValue(null);
    cacheSet.mockResolvedValue(undefined);
    cacheDel.mockResolvedValue(undefined);
  });

  it("sets BYPASS and calls next for non-GET requests", async () => {
    const res = mockRes();
    const next = vi.fn();

    await cacheRoute(30)(mockReq("POST"), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers["x-cache"]).toBe("BYPASS");
    expect(recordCacheMetric).toHaveBeenCalledWith("BYPASS");
    expect(cacheGet).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("sets BYPASS when Redis is unavailable", async () => {
    isConnected.mockReturnValue(false);
    const res = mockRes();
    const next = vi.fn();

    await cacheRoute(30)(mockReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers["x-cache"]).toBe("BYPASS");
    expect(cacheGet).not.toHaveBeenCalled();
  });

  it("sets BYPASS and continues when the Redis read fails", async () => {
    cacheGet.mockRejectedValueOnce(new Error("redis down"));
    const res = mockRes();
    const next = vi.fn();

    await cacheRoute(30)(mockReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers["x-cache"]).toBe("BYPASS");
    expect(recordCacheMetric).toHaveBeenCalledWith("BYPASS");
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it("serves cached responses with HIT and no next call", async () => {
    cacheGet.mockResolvedValue({ body: { ok: true }, status: 201 });
    const res = mockRes();
    const next = vi.fn();

    await cacheRoute(30)(mockReq(), res, next);

    expect(res.headers["x-cache"]).toBe("HIT");
    expect(res.statusCode).toBe(201);
    expect(res.responses).toEqual([{ ok: true }]);
    expect(next).not.toHaveBeenCalled();
    expect(recordCacheMetric).toHaveBeenCalledWith("HIT");
    expect(recordCacheMetric).not.toHaveBeenCalledWith("HIT", expect.anything());
    expect(cacheGet).toHaveBeenCalledWith(
      "anon:none:branch-1:/api/orders?limit=10&phone=9999999999"
    );
  });

  it("sets MISS and leaves the downstream response body unchanged", async () => {
    const res = mockRes();
    const body = { orders: [1, 2, 3] };
    const next = vi.fn(() => {
      res.json(body);
    }) as unknown as NextFunction;

    await cacheRoute(30)(mockReq(), res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.headers["x-cache"]).toBe("MISS");
    expect(res.responses).toEqual([body]);
    expect(recordCacheMetric).toHaveBeenCalledWith("MISS");
    expect(cacheSet).toHaveBeenCalledWith(
      "anon:none:branch-1:/api/orders?limit=10&phone=9999999999",
      { body, status: 200 },
      30
    );
    expect(recordCacheMetric).not.toHaveBeenCalledWith("MISS", expect.anything());
  });

  it("uses the authenticated user, role, and resolved branch scope in the key", async () => {
    const res = mockRes();
    const body = { orders: [1] };
    const next = vi.fn(() => {
      res.json(body);
    }) as unknown as NextFunction;

    await cacheRoute(30)(
      mockReq("GET", { user: owner, branchId: "branch-1", headers: { "x-branch-id": "branch-2" } }),
      res,
      next
    );

    const expected = "user-1:owner:branch-1:/api/orders?limit=10&phone=9999999999";
    expect(cacheGet).toHaveBeenCalledWith(expected);
    expect(cacheSet).toHaveBeenCalledWith(expected, { body, status: 200 }, 30);
  });

  it("canonicalizes query order and drops cache-buster params", async () => {
    const res = mockRes();
    const next = vi.fn(() => {
      res.json({ orders: [] });
    }) as unknown as NextFunction;

    await cacheRoute(30)(
      mockReq("GET", {
        originalUrl:
          "/api/orders?phone=9999999999&_t=1&limit=10&nonce=abc&timestamp=2&t=3&cacheBust=4",
      }),
      res,
      next
    );

    expect(cacheGet).toHaveBeenCalledWith(
      "anon:none:branch-1:/api/orders?limit=10&phone=9999999999"
    );
  });

  it("preserves question marks inside query values", async () => {
    const res = mockRes();
    const next = vi.fn(() => {
      res.json({ orders: [] });
    }) as unknown as NextFunction;

    await cacheRoute(30)(
      mockReq("GET", { originalUrl: "/api/orders?phone=9?9&limit=10" }),
      res,
      next
    );

    expect(cacheGet).toHaveBeenCalledWith("anon:none:branch-1:/api/orders?limit=10&phone=9%3F9");
  });

  it("does not serve a branch's cached response to another branch", async () => {
    cacheGet.mockImplementation(async (key: string) =>
      key.includes(":branch-1:") ? { body: { orders: ["branch-1"] }, status: 200 } : null
    );

    const firstRes = mockRes();
    const firstNext = vi.fn();
    await cacheRoute(30)(
      mockReq("GET", { user: owner, branchId: "branch-1" }),
      firstRes,
      firstNext
    );
    expect(firstRes.headers["x-cache"]).toBe("HIT");

    const secondRes = mockRes();
    const secondNext = vi.fn(() => {
      secondRes.json({ orders: ["branch-2"] });
    }) as unknown as NextFunction;
    await cacheRoute(30)(
      mockReq("GET", { user: owner, branchId: "branch-2", headers: { "x-branch-id": "branch-2" } }),
      secondRes,
      secondNext
    );

    expect(cacheGet).toHaveBeenCalledWith(
      "user-1:owner:branch-2:/api/orders?limit=10&phone=9999999999"
    );
    expect(secondRes.headers["x-cache"]).toBe("MISS");
    expect(secondNext).toHaveBeenCalledOnce();
  });

  it("does not share a cache entry between owner and staff", async () => {
    cacheGet.mockImplementation(async (key: string) =>
      key.includes(":owner:") ? { body: { role: "owner" }, status: 200 } : null
    );

    const ownerRes = mockRes();
    await cacheRoute(30)(mockReq("GET", { user: owner, branchId: "branch-1" }), ownerRes, vi.fn());
    expect(ownerRes.headers["x-cache"]).toBe("HIT");

    const staffRes = mockRes();
    const staffNext = vi.fn(() => {
      staffRes.json({ role: "staff" });
    }) as unknown as NextFunction;
    await cacheRoute(30)(
      mockReq("GET", { user: staff, branchId: "branch-1" }),
      staffRes,
      staffNext
    );

    expect(cacheGet).toHaveBeenCalledWith(
      "user-1:staff:branch-1:/api/orders?limit=10&phone=9999999999"
    );
    expect(staffRes.headers["x-cache"]).toBe("MISS");
    expect(staffNext).toHaveBeenCalledOnce();
  });

  it("does not cache error responses", async () => {
    const res = mockRes();
    const body = { success: false, message: "Internal Server Error" };
    const next = vi.fn(() => {
      res.status(500).json(body);
    }) as unknown as NextFunction;

    await cacheRoute(30)(mockReq(), res, next);

    expect(res.responses).toEqual([body]);
    expect(cacheSet).not.toHaveBeenCalled();
  });
});

describe("invalidateCache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cacheDel.mockResolvedValue(undefined);
  });

  it("records invalidation counts without recording the pattern", async () => {
    await invalidateCache("/api/orders?phone=9999999999");

    expect(cacheDel).toHaveBeenCalledWith("/api/orders?phone=9999999999");
    expect(cacheDel).toHaveBeenCalledWith("*:/api/dashboard*");
    expect(recordCacheMetric).toHaveBeenCalledWith("INVALIDATION", "explicit");
    expect(recordCacheMetric).toHaveBeenCalledWith("INVALIDATION", "dashboard");
    for (const call of recordCacheMetric.mock.calls) {
      expect(JSON.stringify(call)).not.toContain("phone");
      expect(JSON.stringify(call)).not.toContain("9999999999");
    }
  });

  it("canonicalizes query strings so invalidation matches cached keys", async () => {
    await invalidateCache("/api/orders?phone=9999999999&_t=1&limit=10&nonce=abc");

    expect(cacheDel).toHaveBeenCalledWith("/api/orders?limit=10&phone=9999999999");
  });

  it("preserves wildcard patterns during invalidation", async () => {
    await invalidateCache("/api/inventory*?_t=1");

    expect(cacheDel).toHaveBeenCalledWith("/api/inventory*");
    expect(cacheDel).toHaveBeenCalledWith("*:/api/dashboard*");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { ctx } from "../utils/requestContext";

const { info, warn } = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn() }));

vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info,
    warn,
    error: vi.fn(),
    audit: vi.fn(),
    child: vi.fn(),
  },
}));

import { createRequestMetrics } from "./requestMetrics";

const ALLOWED_FIELDS = [
  "event",
  "route_template",
  "method",
  "status",
  "duration_ms",
  "response_bytes",
  "request_id",
  "branch_id",
  "cache_status",
  "instance_id",
].sort();

function mockReq(overrides: Record<string, unknown> = {}): Request {
  return {
    method: "GET",
    baseUrl: "/api/orders",
    route: { path: "/:id" },
    originalUrl: "/api/orders/42?phone=9999999999&token=secret",
    query: { phone: "9999999999", token: "secret" },
    headers: {
      "x-request-id": "req-123",
      authorization: "Bearer secret",
      "x-branch-id": "raw-branch",
    },
    ...overrides,
  } as unknown as Request;
}

interface MockResponse extends Response {
  emitFinish(): void;
  writes: { chunk: unknown; encoding?: unknown }[];
}

function mockRes(endWritesChunk = false): MockResponse {
  const listeners: Record<string, (() => void)[]> = {};
  const writes: { chunk: unknown; encoding?: unknown }[] = [];
  const res: Record<string, unknown> = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    writes,
    on(event: string, cb: () => void) {
      (listeners[event] ||= []).push(cb);
      return res;
    },
    emitFinish() {
      (listeners.finish || []).forEach((cb) => cb());
    },
    setHeader(name: string, value: string) {
      (res.headers as Record<string, string>)[name] = value;
      return res;
    },
    getHeader(name: string) {
      return (res.headers as Record<string, string>)[name];
    },
    write(chunk: unknown, encoding?: unknown) {
      writes.push({ chunk, encoding });
      return true;
    },
    end(chunk?: unknown, encoding?: unknown) {
      if (endWritesChunk && chunk)
        (res.write as (c: unknown, e?: unknown) => void)(chunk, encoding);
      return res;
    },
  };
  return res as unknown as MockResponse;
}

function endAndFinish(res: MockResponse, chunk?: string): void {
  (res.end as unknown as (value?: string) => void)(chunk);
  res.emitFinish();
}

function latestMetric(): Record<string, unknown> {
  const call = [...info.mock.calls].reverse().find(([message]) => message === "http.request");
  expect(call).toBeDefined();
  return call![1] as Record<string, unknown>;
}

describe("requestMetrics", () => {
  beforeEach(() => {
    info.mockClear();
    warn.mockClear();
  });

  it("emits allowlisted fields only and never raw request data", () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    createRequestMetrics()(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    res.setHeader("x-cache", "HIT");
    (res.write as unknown as (chunk: string) => boolean)("hello");
    endAndFinish(res);

    const payload = latestMetric();
    expect(Object.keys(payload).sort()).toEqual(ALLOWED_FIELDS);
    expect(payload).toMatchObject({
      event: "http.request",
      route_template: "/api/orders/:id",
      method: "GET",
      status: 200,
      duration_ms: expect.any(Number),
      response_bytes: 5,
      request_id: "req-123",
      cache_status: "HIT",
      instance_id: expect.any(String),
    });
    expect(payload.branch_id).toBeUndefined();

    const serialized = JSON.stringify(payload);
    for (const forbidden of [
      "originalUrl",
      "/api/orders/42",
      "phone",
      "9999999999",
      "token",
      "secret",
      "authorization",
      "x-branch-id",
      "raw-branch",
      "query",
      "headers",
      "body",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("uses only validated branch identifiers", () => {
    const req = mockReq({ branchId: "branch-validated" });
    const res = mockRes();

    createRequestMetrics()(req, res, vi.fn());
    endAndFinish(res);

    expect(latestMetric().branch_id).toBe("branch-validated");
    expect(JSON.stringify(latestMetric())).not.toContain("raw-branch");
  });

  it("falls back to validated request context values", () => {
    const req = mockReq({ headers: {} });
    const res = mockRes();

    ctx.run({ requestId: "ctx-request", branchId: "ctx-branch" }, () => {
      createRequestMetrics()(req, res, vi.fn());
      endAndFinish(res);
    });

    const payload = latestMetric();
    expect(payload.request_id).toBe("ctx-request");
    expect(payload.branch_id).toBe("ctx-branch");
  });

  it("accumulates write and end bytes exactly once", () => {
    const res = mockRes();

    createRequestMetrics()(mockReq(), res, vi.fn());
    (res.write as unknown as (chunk: string) => boolean)("abc");
    (res.write as unknown as (chunk: Uint8Array) => boolean)(new Uint8Array([1, 2, 3, 4]));
    endAndFinish(res, "xy");

    expect(latestMetric().response_bytes).toBe(9);
    expect(res.writes.map((entry) => entry.chunk)).toEqual(["abc", new Uint8Array([1, 2, 3, 4])]);
  });

  it("does not double count chunks forwarded by end through write", () => {
    const res = mockRes(true);

    createRequestMetrics()(mockReq(), res, vi.fn());
    endAndFinish(res, "hello");

    expect(latestMetric().response_bytes).toBe(5);
  });

  it.each([
    ["HIT", "HIT"],
    ["MISS", "MISS"],
    ["BYPASS", "BYPASS"],
    ["unexpected", "BYPASS"],
  ])("derives cache_status %s as %s", (header, expected) => {
    const res = mockRes();

    createRequestMetrics()(mockReq(), res, vi.fn());
    res.setHeader("x-cache", header);
    endAndFinish(res);

    expect(latestMetric().cache_status).toBe(expected);
  });

  it("logs slow requests with the safe route template", () => {
    const res = mockRes();

    createRequestMetrics(0)(mockReq(), res, vi.fn());
    endAndFinish(res);

    const call = warn.mock.calls.find(([message]) => message === "Slow request");
    expect(call).toBeDefined();
    expect(call![1]).toEqual({
      method: "GET",
      route_template: "/api/orders/:id",
      durationMs: expect.any(Number),
    });
    expect(JSON.stringify(call![1])).not.toContain("originalUrl");
  });
});

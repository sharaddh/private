import { describe, it, expect, vi, afterEach } from "vitest";
import { z } from "zod";
import { AppError, errorHandler } from "./errorHandler";

interface MockRes {
  status: (code: number) => MockRes;
  json: (body: unknown) => MockRes;
}

function mockRes(): MockRes {
  const res: Record<string, unknown> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as unknown as MockRes;
}

function mockReq() {
  return { originalUrl: "/api/test", method: "GET", headers: {} } as never;
}

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("responds with AppError status and message", () => {
    const res = mockRes();
    errorHandler(new AppError(404, "Not found here"), mockReq(), res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Not found here", code: "ERR_404" })
    );
  });

  it("exposes AppError details when provided", () => {
    const res = mockRes();
    errorHandler(new AppError(400, "Bad", { field: "username" }), mockReq(), res as never, vi.fn());
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, field: "username" })
    );
  });

  it("responds 500 for unknown errors and hides internals in production", () => {
    const res = mockRes();
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      errorHandler(new Error("secret stack"), mockReq(), res as never, vi.fn());
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, message: "Internal Server Error" });
    } finally {
      process.env.NODE_ENV = original;
    }
  });

  it("handles zod validation errors as 400", () => {
    const res = mockRes();
    const zodErr = z.string().email().safeParse("not-an-email").error!;
    errorHandler(zodErr as never, mockReq(), res as never, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: "Validation failed" })
    );
  });

  it("handles mongoose duplicate key errors as 409", () => {
    const res = mockRes();
    errorHandler(
      { code: 11000, keyPattern: { username: 1 } } as never,
      mockReq(),
      res as never,
      vi.fn()
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});

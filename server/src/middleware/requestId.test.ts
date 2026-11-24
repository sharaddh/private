import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { BranchRequest } from "../types";

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));

vi.mock("../db/prisma", () => ({
  prisma: { branch: { findUnique } },
}));

vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    audit: vi.fn(),
    child: vi.fn(),
  },
}));

import { requestId } from "./requestId";
import { branchScope } from "./branch";
import { getCtx } from "../utils/requestContext";

describe("requestId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the header and creates a correlated request context", () => {
    const req = { headers: {} as Record<string, string> } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    let seenRequestId: string | undefined;

    requestId(
      req,
      res,
      vi.fn(() => {
        seenRequestId = getCtx()?.requestId;
      })
    );

    expect(seenRequestId).toBeDefined();
    expect(req.headers["x-request-id"]).toBe(seenRequestId);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", seenRequestId);
  });

  it("preserves the existing trimmed header behavior", () => {
    const req = {
      headers: { "x-request-id": "  client-id  " } as Record<string, string>,
    } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;

    requestId(req, res, vi.fn());

    expect(req.headers["x-request-id"]).toBe("client-id");
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", "client-id");
  });

  it("preserves requestId when branchScope creates its context", async () => {
    findUnique.mockResolvedValue({
      id: "branch-1",
      dbName: "branch_db",
      name: "Branch One",
      isActive: true,
    });
    const req = {
      headers: { "x-branch-id": "branch-1" },
      query: {},
      user: { sub: "user-1", username: "admin", role: "owner" },
    } as unknown as BranchRequest;
    const res = { setHeader: vi.fn() } as unknown as Response;
    let captured: ReturnType<typeof getCtx> = undefined;

    await new Promise<void>((resolve, reject) => {
      requestId(req, res, () => {
        branchScope(req, res, () => {
          captured = getCtx();
          resolve();
        }).catch(reject);
      });
    });

    expect(captured).toMatchObject({
      requestId: req.headers["x-request-id"],
      branchId: "branch-1",
      branchName: "Branch One",
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "branch-1" } });
  });
});

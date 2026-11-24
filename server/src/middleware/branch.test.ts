import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Response } from "express";
import type { BranchRequest, JwtPayload } from "../types";

const { branchFindUnique, userFindUnique, verifyToken } = vi.hoisted(() => ({
  branchFindUnique: vi.fn(),
  userFindUnique: vi.fn(),
  verifyToken: vi.fn(),
}));

vi.mock("../db/prisma", () => ({
  prisma: { branch: { findUnique: branchFindUnique }, user: { findUnique: userFindUnique } },
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

vi.mock("../utils/jwt", () => ({ verifyToken }));

import { branchScope } from "./branch";
import { optionalAuth } from "./auth";
import { ctx, getCtx } from "../utils/requestContext";

const owner: JwtPayload = { sub: "user-1", username: "admin", role: "owner" };
const staff: JwtPayload = { sub: "user-2", username: "staff", role: "staff" };
const branch = { id: "branch-1", dbName: "branch_db", name: "Branch One", isActive: true };

function mockReq(user?: JwtPayload, branchId = "branch-1"): BranchRequest {
  return {
    headers: branchId ? { "x-branch-id": branchId } : {},
    query: {},
    user,
  } as unknown as BranchRequest;
}

function mockRes() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  return { res: { status, json } as unknown as Response, status, json };
}

describe("branchScope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    branchFindUnique.mockResolvedValue(branch);
    userFindUnique.mockResolvedValue({ branches: [{ id: "branch-1" }] });
  });

  it("lets an owner scope an active branch and preserves the requestId context", async () => {
    const req = mockReq(owner);
    const { res } = mockRes();
    const next = vi.fn();
    let captured: ReturnType<typeof getCtx> = undefined;

    await new Promise<void>((resolve, reject) => {
      ctx.run({ requestId: "req-1" }, () => {
        branchScope(req, res, () => {
          captured = getCtx();
          next();
          resolve();
        }).catch(reject);
      });
    });

    expect(next).toHaveBeenCalledOnce();
    expect(req.branchId).toBe("branch-1");
    expect(req.branchDb).toBe("branch_db");
    expect(req.branchName).toBe("Branch One");
    expect(captured).toMatchObject({ requestId: "req-1", branchId: "branch-1" });
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("lets staff scope a branch they are assigned to", async () => {
    userFindUnique.mockResolvedValue({ branches: [{ id: "branch-2" }, { id: "branch-1" }] });
    const req = mockReq(staff);
    const { res } = mockRes();
    const next = vi.fn();

    await branchScope(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.branchId).toBe("branch-1");
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: "user-2" },
      select: { branches: { select: { id: true } } },
    });
  });

  it("denies staff access to an unassigned branch", async () => {
    userFindUnique.mockResolvedValue({ branches: [{ id: "branch-2" }] });
    const req = mockReq(staff);
    const { res, status, json } = mockRes();
    const next = vi.fn();

    await branchScope(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ success: false, message: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
    expect(req.branchId).toBeUndefined();
  });

  it("denies roles other than owner and staff", async () => {
    const req = mockReq({ sub: "user-3", username: "manager", role: "manager" });
    const { res, status, json } = mockRes();
    const next = vi.fn();

    await branchScope(req, res, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ success: false, message: "Forbidden" });
    expect(next).not.toHaveBeenCalled();
    expect(userFindUnique).not.toHaveBeenCalled();
  });

  it("still looks up the branch but does not set scope without an authenticated user", async () => {
    const req = mockReq();
    const { res } = mockRes();
    const next = vi.fn();

    await branchScope(req, res, next);

    expect(branchFindUnique).toHaveBeenCalledWith({ where: { id: "branch-1" } });
    expect(next).toHaveBeenCalledOnce();
    expect(req.branchId).toBeUndefined();
  });

  it("does not set scope for an inactive branch", async () => {
    branchFindUnique.mockResolvedValue({ ...branch, isActive: false });
    const req = mockReq(owner);
    const { res } = mockRes();
    const next = vi.fn();

    await branchScope(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.branchId).toBeUndefined();
  });

  it("does not grant scope when optionalAuth receives an expired token", async () => {
    verifyToken.mockImplementation(() => {
      throw new Error("jwt expired");
    });
    const req = mockReq();
    req.headers.authorization = "Bearer expired";
    const { res } = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, vi.fn());
    expect(req.user).toBeUndefined();

    await branchScope(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.branchId).toBeUndefined();
  });

  it("allows scope when optionalAuth receives a valid owner token", async () => {
    verifyToken.mockReturnValue(owner);
    const req = mockReq();
    req.headers.authorization = "Bearer valid";
    const { res } = mockRes();
    const next = vi.fn();

    optionalAuth(req, res, vi.fn());
    await branchScope(req, res, next);

    expect(req.user).toEqual(owner);
    expect(req.branchId).toBe("branch-1");
    expect(next).toHaveBeenCalledOnce();
  });
});

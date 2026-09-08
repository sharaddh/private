import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import bcrypt from "bcrypt";
import { User } from "../models/user";
import { signRefresh } from "../utils/jwt";
import { loginUser, staffLogin, warehouseLogin, refreshToken, registerUser } from "./auth.service";

vi.mock("bcrypt", () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

vi.mock("../models/user", () => ({
  User: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../models/branch", () => ({
  Branch: {
    findMany: vi.fn(),
  },
}));

const ownerUser = {
  id: "user-1",
  username: "admin",
  passwordHash: "hashed",
  name: "Admin",
  mobile: "123",
  role: "owner",
  branches: [
    { id: "branch-1", name: "Govindpuri", code: "GVP", dbName: "kmj_govindpuri", isActive: true, settings: null },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("auth.service", () => {
  beforeEach(() => {
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
    vi.mocked(bcrypt.hash).mockResolvedValue("hashed" as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loginUser requires username and password", async () => {
    await expect(loginUser({ username: "", password: "" })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("loginUser rejects staff accounts", async () => {
    vi.mocked(User.findFirst).mockResolvedValue({ ...ownerUser, role: "staff" } as never);
    await expect(loginUser({ username: "staff", password: "x" })).rejects.toThrow(
      "Staff must use the staff login page"
    );
  });

  it("loginUser rejects invalid credentials", async () => {
    vi.mocked(User.findFirst).mockResolvedValue(ownerUser as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
    await expect(loginUser({ username: "admin", password: "wrong" })).rejects.toThrow(
      "Invalid credentials"
    );
  });

  it("loginUser returns user, access and refresh tokens", async () => {
    vi.mocked(User.findFirst).mockResolvedValue(ownerUser as never);
    const result = await loginUser({ username: "admin", password: "correct" });
    expect(result.user.id).toBe("user-1");
    expect(result.user.role).toBe("owner");
    expect(result.access).toBeTruthy();
    expect(result.refresh).toBeTruthy();
    // login response must carry the resolved branch so the client can scope
    // its first requests synchronously (fixes post-login "missing branch scope" 500s)
    expect(result.branchId).toBe("branch-1");
    expect(vi.mocked(User.findFirst).mock.calls[0][0]).toMatchObject({
      include: { branches: true },
    });
  });

  it("staffLogin requires a branch assignment", async () => {
    vi.mocked(User.findFirst).mockResolvedValue(
      { ...ownerUser, role: "staff", branches: [] } as never
    );
    await expect(staffLogin({ username: "staff", password: "x" })).rejects.toThrow(
      "has not been assigned to any branch"
    );
  });

  it("staffLogin returns branchId for an assigned staff member", async () => {
    vi.mocked(User.findFirst).mockResolvedValue(
      { ...ownerUser, role: "staff" } as never
    );
    const result = await staffLogin({ username: "staff", password: "correct" });
    expect(result.branchId).toBe("branch-1");
    expect(vi.mocked(User.findFirst).mock.calls[0][0]).toMatchObject({
      include: { branches: true },
    });
  });

  it("warehouseLogin only allows owners", async () => {
    vi.mocked(User.findFirst).mockResolvedValue({ ...ownerUser, role: "staff" } as never);
    await expect(warehouseLogin({ username: "staff", password: "x" })).rejects.toThrow(
      "Only owners can access the warehouse"
    );
  });

  it("refreshToken mints a new access token for an existing user", async () => {
    vi.mocked(User.findUnique).mockResolvedValue(ownerUser as never);
    const refresh = signRefresh({ sub: "user-1" });
    const { access } = await refreshToken(refresh);
    expect(access).toBeTruthy();
  });

  it("refreshToken throws for unknown users", async () => {
    vi.mocked(User.findUnique).mockResolvedValue(null as never);
    const refresh = signRefresh({ sub: "missing" });
    await expect(refreshToken(refresh)).rejects.toMatchObject({ statusCode: 404 });
  });

  it("registerUser requires owner role", async () => {
    await expect(registerUser({ username: "u", password: "p" }, "staff")).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it("registerUser rejects duplicate usernames", async () => {
    vi.mocked(User.findFirst).mockResolvedValue({ id: "existing" } as never);
    await expect(registerUser({ username: "dup", password: "p" }, "owner")).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

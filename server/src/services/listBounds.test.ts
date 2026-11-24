import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Delivery } from "../models/delivery";
import { Prescription } from "../models/prescription";
import { Visit } from "../models/visit";
import { listDeliveries } from "./delivery.service";
import { listPrescriptions } from "./prescription.service";
import { listVisits } from "./visit.service";
import { boundedListArgs, listPageParamsFromQuery } from "./listBounds";

vi.mock("../models/delivery", () => ({ Delivery: { findMany: vi.fn() } }));
vi.mock("../models/prescription", () => ({ Prescription: { findMany: vi.fn() } }));
vi.mock("../models/visit", () => ({ Visit: { findMany: vi.fn() } }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(Delivery.findMany).mockResolvedValue([] as never);
  vi.mocked(Prescription.findMany).mockResolvedValue([] as never);
  vi.mocked(Visit.findMany).mockResolvedValue([] as never);
});

describe("boundedListArgs", () => {
  it("applies safe defaults when no paging values are supplied", () => {
    expect(boundedListArgs()).toEqual({ take: 100, skip: 0 });
    expect(boundedListArgs({ limit: "", page: "", skip: "" })).toEqual({ take: 100, skip: 0 });
  });

  it("clamps limit and derives skip from an allowlisted page", () => {
    expect(boundedListArgs({ limit: "9999", page: "3" })).toEqual({ take: 200, skip: 400 });
    expect(boundedListArgs({ limit: "5", page: "0" })).toEqual({ take: 5, skip: 0 });
  });

  it("prefers an explicit skip and rejects malformed values", () => {
    expect(boundedListArgs({ limit: "4", page: "3", skip: "9" })).toEqual({ take: 4, skip: 9 });
    expect(boundedListArgs({ limit: "abc", page: "-2", skip: "oops" })).toEqual({
      take: 100,
      skip: 0,
    });
    expect(boundedListArgs({ limit: ["7"], page: ["2"] })).toEqual({ take: 7, skip: 7 });
  });

  it("allowlists only paging keys from raw query objects", () => {
    const params = listPageParamsFromQuery({
      limit: "12",
      page: "2",
      skip: "3",
      where: { role: "owner" },
      select: { id: true },
      take: "9999",
    });
    expect(params).toEqual({ limit: "12", page: "2", skip: "3" });
  });
});

describe("bounded list services", () => {
  it("bounds deliveries while preserving the status filter and includes", async () => {
    await listDeliveries("Ready", { limit: "3", page: "2", skip: "0" });
    const args = vi.mocked(Delivery.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({ status: "Ready" });
    expect(args.take).toBe(3);
    expect(args.skip).toBe(0);
    expect(args.include).toBeDefined();
  });

  it("bounds visits while preserving the customer filter", async () => {
    await listVisits("cust-1", { limit: "9999", page: "2" });
    const args = vi.mocked(Visit.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({ customerId: "cust-1" });
    expect(args.take).toBe(200);
    expect(args.skip).toBe(200);
  });

  it("bounds prescriptions with defaults when paging values are invalid", async () => {
    await listPrescriptions("cust-2", { limit: "nope", page: "nope" });
    const args = vi.mocked(Prescription.findMany).mock.calls[0]![0]!;
    expect(args.where).toEqual({ customerId: "cust-2" });
    expect(args.take).toBe(100);
    expect(args.skip).toBe(0);
  });
});

const guardedFunctions: Array<[file: string, fn: string]> = [
  ["delivery.service.ts", "listDeliveries"],
  ["visit.service.ts", "listVisits"],
  ["prescription.service.ts", "listPrescriptions"],
  ["todo.service.ts", "listTodos"],
  ["camera.service.ts", "listCameras"],
  ["branch.service.ts", "listAllBranches"],
  ["auth.service.ts", "listUsers"],
  ["cart.service.ts", "getAllWithdrawals"],
  ["shopLensCart.service.ts", "getWithdrawals"],
  ["lensStock.service.ts", "listLensStock"],
  ["fogMark.service.ts", "listFogMarks"],
  ["warehouseLensStock.service.ts", "listLensStock"],
  ["warehouseDemand.service.ts", "listDemands"],
  ["warehouseInventory.service.ts", "listInventory"],
  ["warehouseAggregate.service.ts", "getAllBranchLensStock"],
  ["inventoryProduct.service.ts", "listBrands"],
  ["inventoryProduct.service.ts", "listRacks"],
  ["inventoryProduct.service.ts", "getRackItems"],
];

function functionBody(file: string, fn: string): string {
  const source = readFileSync(join(process.cwd(), "src", "services", file), "utf8");
  const start = source.indexOf(`export async function ${fn}(`);
  if (start < 0) return "";
  const next = source.indexOf("\nexport ", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

describe("targeted list endpoints", () => {
  it.each(guardedFunctions)("%s %s is bounded", (file, fn) => {
    const body = functionBody(file, fn);
    expect(body).not.toBe("");
    expect(body).toMatch(/\btake\b/);
    expect(body).toMatch(/\bfindMany\(/);
  });
});

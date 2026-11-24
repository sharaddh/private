import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import * as deliveryController from "./deliveryController";
import * as visitController from "./visitController";
import * as warehouseDemandController from "./warehouseDemand.controller";
import * as deliveryService from "../services/delivery.service";
import * as visitService from "../services/visit.service";
import * as warehouseDemandService from "../services/warehouseDemand.service";

vi.mock("../services/delivery.service", () => ({ listDeliveries: vi.fn() }));
vi.mock("../services/visit.service", () => ({ listVisits: vi.fn() }));
vi.mock("../services/warehouseDemand.service", () => ({ listDemands: vi.fn() }));

function makeReq(query: Record<string, unknown>): Request {
  return { query } as unknown as Request;
}

function makeRes(): { res: Response; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const res = { status: vi.fn().mockReturnThis(), json } as unknown as Response;
  return { res, json };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(deliveryService.listDeliveries).mockResolvedValue([]);
  vi.mocked(visitService.listVisits).mockResolvedValue([]);
  vi.mocked(warehouseDemandService.listDemands).mockResolvedValue([]);
});

describe("list controllers", () => {
  it("passes only allowlisted paging values to delivery service", async () => {
    const req = makeReq({
      status: "Ready",
      limit: "5",
      page: "2",
      where: { role: "owner" },
      select: "id",
      take: "9999",
    });
    const { res } = makeRes();

    await deliveryController.list(req, res);

    expect(deliveryService.listDeliveries).toHaveBeenCalledWith("Ready", {
      limit: "5",
      page: "2",
      skip: undefined,
    });
  });

  it("keeps the array response shape for visit lists", async () => {
    const req = makeReq({ customerId: "cust-1", limit: "3", search: "abc" });
    const { res, json } = makeRes();

    await visitController.list(req, res);

    expect(visitService.listVisits).toHaveBeenCalledWith("cust-1", {
      limit: "3",
      page: undefined,
      skip: undefined,
    });
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });

  it("preserves the status filter while dropping raw query keys", async () => {
    const req = makeReq({ status: "open", limit: "4", where: { status: "closed" } });
    const { res } = makeRes();

    await warehouseDemandController.list(req, res);

    expect(warehouseDemandService.listDemands).toHaveBeenCalledWith("open", {
      limit: "4",
      page: undefined,
      skip: undefined,
    });
  });
});

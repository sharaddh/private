import { describe, it, expect, vi } from "vitest";
import { sendSuccess, sendCreated, sendError, sendNotFound } from "./response";

interface MockRes {
  statusCode: number;
  status: (code: number) => MockRes;
  json: (body: unknown) => MockRes;
}

function mockRes(): MockRes {
  const res: Record<string, unknown> = { statusCode: 200 };
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as unknown as MockRes;
}

describe("response", () => {
  it("sendSuccess returns success true with data", () => {
    const res = mockRes();
    sendSuccess(res as never, { id: 1 }, undefined, 200);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 1 } });
  });

  it("sendSuccess includes optional message", () => {
    const res = mockRes();
    sendSuccess(res as never, null, "All good");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null, message: "All good" });
  });

  it("sendCreated returns 201 with default message", () => {
    const res = mockRes();
    sendCreated(res as never, { id: 9 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { id: 9 },
      message: "Created successfully",
    });
  });

  it("sendError returns failure with message", () => {
    const res = mockRes();
    sendError(res as never, "boom", 400);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "boom" });
  });

  it("sendNotFound returns 404", () => {
    const res = mockRes();
    sendNotFound(res as never);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Resource not found" });
  });
});

import { describe, expect, it } from "vitest";
import { classifyError, isTransientDbError } from "./db-error";

describe("classifyError", () => {
  it.each(["P1001", "P1002", "P1008", "P1017", "P2024"])(
    "classifies %s as transient database",
    (code) => {
      const error = Object.assign(new Error("connection failed"), { code });
      expect(classifyError(error)).toEqual({
        errorCode: code,
        errorName: "Error",
        classification: "transient_db",
      });
      expect(isTransientDbError(error)).toBe(true);
    }
  );

  it("classifies PrismaClientInitializationError by name", () => {
    const error = Object.assign(new Error("cannot start client"), {
      name: "PrismaClientInitializationError",
    });
    expect(classifyError(error)).toEqual({
      errorCode: null,
      errorName: "PrismaClientInitializationError",
      classification: "transient_db",
    });
  });

  it("does not classify ordinary errors as database failures", () => {
    const error = Object.assign(new Error("boom"), {
      code: "P2002",
      name: "PrismaClientKnownRequestError",
    });
    expect(classifyError(error)).toEqual({
      errorCode: "P2002",
      errorName: "PrismaClientKnownRequestError",
      classification: "other",
    });
    expect(isTransientDbError(error)).toBe(false);
  });

  it("handles non-object errors without throwing", () => {
    expect(classifyError(null)).toEqual({
      errorCode: null,
      errorName: null,
      classification: "other",
    });
    expect(isTransientDbError("P1001")).toBe(false);
  });
});

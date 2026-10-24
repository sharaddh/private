import { describe, it, expect } from "vitest";
import { resolveSpaRoute, isAssetPath, isWarehousePath } from "./spaFallback";

const base = {
  hasClientBuild: false,
  hasWarehouseBuild: false,
  clientUrl: "https://client.example.com",
  warehouseUrl: "https://warehouse.example.com",
};

describe("isAssetPath", () => {
  it("detects asset requests", () => {
    expect(isAssetPath("/assets/js/index-abc.js")).toBe(true);
    expect(isAssetPath("/favicon.ico")).toBe(true);
    expect(isAssetPath("/dashboard")).toBe(false);
  });
});

describe("isWarehousePath", () => {
  it("detects warehouse routes", () => {
    expect(isWarehousePath("/warehouse")).toBe(true);
    expect(isWarehousePath("/warehouse/demand")).toBe(true);
    expect(isWarehousePath("/warehouseed")).toBe(false);
    expect(isWarehousePath("/")).toBe(false);
  });
});

describe("resolveSpaRoute", () => {
  it("404s unknown api routes", () => {
    expect(resolveSpaRoute({ ...base, path: "/api/nope" })).toEqual({ kind: "api-404" });
  });

  it("redirects to the client app when no build is deployed", () => {
    expect(resolveSpaRoute({ ...base, path: "/" })).toEqual({
      kind: "redirect",
      location: "https://client.example.com",
    });
  });

  it("redirects warehouse paths to the warehouse app", () => {
    expect(resolveSpaRoute({ ...base, path: "/warehouse" })).toEqual({
      kind: "redirect",
      location: "https://warehouse.example.com",
    });
    expect(resolveSpaRoute({ ...base, path: "/warehouse/demand" })).toEqual({
      kind: "redirect",
      location: "https://warehouse.example.com",
    });
  });

  it("serves the local build when available", () => {
    expect(
      resolveSpaRoute({ ...base, hasClientBuild: true, path: "/dashboard" })
    ).toEqual({ kind: "serve-client" });
    expect(
      resolveSpaRoute({ ...base, hasWarehouseBuild: true, path: "/warehouse/demand" })
    ).toEqual({ kind: "serve-warehouse" });
  });

  it("404s asset requests instead of redirecting them", () => {
    expect(resolveSpaRoute({ ...base, path: "/assets/js/index-abc.js" })).toEqual({
      kind: "asset-404",
    });
    expect(resolveSpaRoute({ ...base, path: "/warehouse/assets/js/index-abc.js" })).toEqual({
      kind: "asset-404",
    });
  });

  it("falls back to the json root when redirects are disabled", () => {
    expect(resolveSpaRoute({ ...base, clientUrl: "", warehouseUrl: "", path: "/" })).toEqual({
      kind: "api-root",
    });
  });
});

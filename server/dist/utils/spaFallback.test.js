"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const spaFallback_1 = require("./spaFallback");
const base = {
    hasClientBuild: false,
    hasWarehouseBuild: false,
    clientUrl: "https://client.example.com",
    warehouseUrl: "https://warehouse.example.com",
};
(0, vitest_1.describe)("isAssetPath", () => {
    (0, vitest_1.it)("detects asset requests", () => {
        (0, vitest_1.expect)((0, spaFallback_1.isAssetPath)("/assets/js/index-abc.js")).toBe(true);
        (0, vitest_1.expect)((0, spaFallback_1.isAssetPath)("/favicon.ico")).toBe(true);
        (0, vitest_1.expect)((0, spaFallback_1.isAssetPath)("/dashboard")).toBe(false);
    });
});
(0, vitest_1.describe)("isWarehousePath", () => {
    (0, vitest_1.it)("detects warehouse routes", () => {
        (0, vitest_1.expect)((0, spaFallback_1.isWarehousePath)("/warehouse")).toBe(true);
        (0, vitest_1.expect)((0, spaFallback_1.isWarehousePath)("/warehouse/demand")).toBe(true);
        (0, vitest_1.expect)((0, spaFallback_1.isWarehousePath)("/warehouseed")).toBe(false);
        (0, vitest_1.expect)((0, spaFallback_1.isWarehousePath)("/")).toBe(false);
    });
});
(0, vitest_1.describe)("resolveSpaRoute", () => {
    (0, vitest_1.it)("404s unknown api routes", () => {
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, path: "/api/nope" })).toEqual({ kind: "api-404" });
    });
    (0, vitest_1.it)("redirects to the client app when no build is deployed", () => {
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, path: "/" })).toEqual({
            kind: "redirect",
            location: "https://client.example.com",
        });
    });
    (0, vitest_1.it)("redirects warehouse paths to the warehouse app", () => {
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, path: "/warehouse" })).toEqual({
            kind: "redirect",
            location: "https://warehouse.example.com",
        });
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, path: "/warehouse/demand" })).toEqual({
            kind: "redirect",
            location: "https://warehouse.example.com",
        });
    });
    (0, vitest_1.it)("serves the local build when available", () => {
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, hasClientBuild: true, path: "/dashboard" })).toEqual({ kind: "serve-client" });
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, hasWarehouseBuild: true, path: "/warehouse/demand" })).toEqual({ kind: "serve-warehouse" });
    });
    (0, vitest_1.it)("404s asset requests instead of redirecting them", () => {
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, path: "/assets/js/index-abc.js" })).toEqual({
            kind: "asset-404",
        });
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, path: "/warehouse/assets/js/index-abc.js" })).toEqual({
            kind: "asset-404",
        });
    });
    (0, vitest_1.it)("falls back to the json root when redirects are disabled", () => {
        (0, vitest_1.expect)((0, spaFallback_1.resolveSpaRoute)({ ...base, clientUrl: "", warehouseUrl: "", path: "/" })).toEqual({
            kind: "api-root",
        });
    });
});
//# sourceMappingURL=spaFallback.test.js.map
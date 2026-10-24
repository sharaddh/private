"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSpaRoute = exports.isWarehousePath = exports.isAssetPath = void 0;
const node_path_1 = __importDefault(require("node:path"));
function isAssetPath(requestPath) {
    return node_path_1.default.extname(requestPath) !== "";
}
exports.isAssetPath = isAssetPath;
function isWarehousePath(requestPath) {
    return requestPath === "/warehouse" || requestPath.startsWith("/warehouse/");
}
exports.isWarehousePath = isWarehousePath;
/**
 * Decides what a non-API GET request should return.
 *
 * The API service may be deployed without the web bundles (they live on
 * separate static hosts). In that case a document request is redirected to the
 * matching app instead of returning a dead-end JSON response.
 */
function resolveSpaRoute(input) {
    const { path: requestPath, hasClientBuild, hasWarehouseBuild, clientUrl, warehouseUrl } = input;
    if (requestPath.startsWith("/api")) {
        return { kind: "api-404" };
    }
    const isAsset = isAssetPath(requestPath);
    if (isWarehousePath(requestPath)) {
        if (hasWarehouseBuild) {
            return { kind: "serve-warehouse" };
        }
        if (isAsset) {
            return { kind: "asset-404" };
        }
        if (warehouseUrl) {
            return { kind: "redirect", location: warehouseUrl };
        }
        return { kind: "asset-404" };
    }
    if (hasClientBuild) {
        return { kind: "serve-client" };
    }
    if (isAsset) {
        return { kind: "asset-404" };
    }
    if (clientUrl) {
        return { kind: "redirect", location: clientUrl };
    }
    return { kind: "api-root" };
}
exports.resolveSpaRoute = resolveSpaRoute;
//# sourceMappingURL=spaFallback.js.map
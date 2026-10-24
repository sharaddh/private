import path from "node:path";

export type SpaRouteDecision =
  | { kind: "api-404" }
  | { kind: "serve-client" }
  | { kind: "serve-warehouse" }
  | { kind: "redirect"; location: string }
  | { kind: "asset-404" }
  | { kind: "api-root" };

export interface SpaRouteInput {
  /** Request path (no query string). */
  path: string;
  hasClientBuild: boolean;
  hasWarehouseBuild: boolean;
  /** Public URL of the separately hosted client app ("" disables the fallback). */
  clientUrl: string;
  /** Public URL of the separately hosted warehouse app ("" disables the fallback). */
  warehouseUrl: string;
}

export function isAssetPath(requestPath: string): boolean {
  return path.extname(requestPath) !== "";
}

export function isWarehousePath(requestPath: string): boolean {
  return requestPath === "/warehouse" || requestPath.startsWith("/warehouse/");
}

/**
 * Decides what a non-API GET request should return.
 *
 * The API service may be deployed without the web bundles (they live on
 * separate static hosts). In that case a document request is redirected to the
 * matching app instead of returning a dead-end JSON response.
 */
export function resolveSpaRoute(input: SpaRouteInput): SpaRouteDecision {
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

export type SpaRouteDecision = {
    kind: "api-404";
} | {
    kind: "serve-client";
} | {
    kind: "serve-warehouse";
} | {
    kind: "redirect";
    location: string;
} | {
    kind: "asset-404";
} | {
    kind: "api-root";
};
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
export declare function isAssetPath(requestPath: string): boolean;
export declare function isWarehousePath(requestPath: string): boolean;
/**
 * Decides what a non-API GET request should return.
 *
 * The API service may be deployed without the web bundles (they live on
 * separate static hosts). In that case a document request is redirected to the
 * matching app instead of returning a dead-end JSON response.
 */
export declare function resolveSpaRoute(input: SpaRouteInput): SpaRouteDecision;
//# sourceMappingURL=spaFallback.d.ts.map
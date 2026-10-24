"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const pino_http_1 = require("pino-http");
const config_1 = require("./config");
const routes_1 = __importDefault(require("./routes"));
const audit_1 = require("./middleware/audit");
const errorHandler_1 = require("./middleware/errorHandler");
const requestId_1 = require("./middleware/requestId");
const rateLimitStore_1 = require("./middleware/rateLimitStore");
const verifyWebhook_1 = require("./middleware/verifyWebhook");
const whatsapp_controller_1 = require("./controllers/whatsapp.controller");
const asyncHandler_1 = require("./middleware/asyncHandler");
const jwt_1 = require("./utils/jwt");
const logger_1 = require("./utils/logger");
const spaFallback_1 = require("./utils/spaFallback");
const app = (0, express_1.default)();
app.set("trust proxy", 1);
app.set("x-powered-by", false);
app.use(requestId_1.requestId);
if (config_1.NODE_ENV !== "test") {
    app.use((0, pino_http_1.pinoHttp)({
        logger: logger_1.pinoLogger,
        genReqId: (req) => req.headers["x-request-id"],
        customLogLevel: (_req, res, err) => {
            if (err || res.statusCode >= 500)
                return "error";
            if (res.statusCode >= 400)
                return "warn";
            return "info";
        },
        customSuccessMessage: (req, res) => `${req.method} ${req.url} -> ${res.statusCode}`,
        customErrorMessage: (req, res, err) => `${req.method} ${req.url} -> ${res.statusCode}: ${err.message}`,
        autoLogging: {
            ignore: (req) => req.url?.startsWith("/api/health") || req.url?.startsWith("/api/ready"),
        },
    }));
}
app.use((_req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        if (duration > 1000) {
            logger_1.logger.warn("Slow request", {
                method: _req.method,
                url: _req.originalUrl,
                durationMs: duration,
            });
        }
    });
    next();
});
app.use((0, helmet_1.default)({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use((0, cors_1.default)({
    origin: config_1.CORS_ORIGINS,
    credentials: true,
}));
app.use((0, compression_1.default)({ level: 6, threshold: 1024 }));
app.get("/api/whatsapp/webhook", (req, res) => (0, verifyWebhook_1.handleWebhookVerification)(req, res));
app.post("/api/whatsapp/webhook", express_1.default.raw({ type: "application/json", limit: "1mb" }), (req, _res, next) => {
    req.rawBody = req.body;
    next();
}, verifyWebhook_1.verifyWebhook, (0, asyncHandler_1.asyncHandler)(whatsapp_controller_1.webhookHandler));
app.use(express_1.default.json({ limit: "25mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "25mb" }));
app.use(audit_1.audit);
const keyGenerator = (req) => {
    const header = req.headers.authorization;
    if (header?.startsWith("Bearer ")) {
        try {
            const payload = (0, jwt_1.verifyToken)(header.slice(7));
            if (payload?.sub)
                return `user:${payload.sub}`;
        }
        catch {
            // invalid/expired token - fall through to IP-based key
        }
    }
    return req.ip || "unknown";
};
// Global limit: per authenticated user, otherwise per IP. Redis-backed so the
// limit is consistent across all instances behind a load balancer.
app.use((0, express_rate_limit_1.default)({
    windowMs: config_1.RATE_LIMIT_WINDOW_MS,
    max: config_1.RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator,
    store: (0, rateLimitStore_1.createRateLimitStore)("rl:global"),
}));
// Stricter limit for auth endpoints to prevent brute-force login attempts.
app.use("/api/auth", (0, express_rate_limit_1.default)({
    windowMs: config_1.RATE_LIMIT_WINDOW_MS,
    max: config_1.AUTH_RATE_LIMIT_MAX,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip || "unknown",
    skipSuccessfulRequests: false,
    store: (0, rateLimitStore_1.createRateLimitStore)("rl:auth"),
}));
app.use("/api", routes_1.default);
app.get("/favicon.ico", (_req, res) => res.status(204).end());
function findDistPath(candidates, label) {
    logger_1.logger.info(`[DIST] Searching for ${label}...`);
    for (const p of candidates) {
        logger_1.logger.info(`[DIST]   Checking: ${p} -> ${fs_1.default.existsSync(p) ? "FOUND" : "missing"}`);
        if (fs_1.default.existsSync(p))
            return p;
    }
    logger_1.logger.warn(`[DIST] ${label} not found in any candidate path`);
    return "";
}
function isAssetRequest(reqPath) {
    return (0, spaFallback_1.isAssetPath)(reqPath);
}
function sendSpaIndex(res, indexPath) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(indexPath);
}
logger_1.logger.info(`[BOOT] __dirname=${__dirname}, cwd=${process.cwd()}, platform=${process.platform}`);
const clientDistCandidates = [
    path_1.default.resolve(__dirname, "../../client/dist"),
    path_1.default.resolve(__dirname, "../client/dist"),
    path_1.default.resolve(process.cwd(), "client/dist"),
    path_1.default.resolve(process.cwd(), "../client/dist"),
    path_1.default.resolve(process.cwd(), "../../client/dist"),
];
const distPath = findDistPath(clientDistCandidates, "client/dist");
const distIndex = distPath ? path_1.default.join(distPath, "index.html") : "";
const warehouseDistCandidates = [
    path_1.default.resolve(__dirname, "../../warehouse/dist"),
    path_1.default.resolve(__dirname, "../warehouse/dist"),
    path_1.default.resolve(process.cwd(), "warehouse/dist"),
    path_1.default.resolve(process.cwd(), "../warehouse/dist"),
    path_1.default.resolve(process.cwd(), "../../warehouse/dist"),
    path_1.default.join(__dirname, "..", "..", "warehouse", "dist"),
];
const warehouseDistPath = findDistPath(warehouseDistCandidates, "warehouse/dist");
const warehouseIndex = warehouseDistPath ? path_1.default.join(warehouseDistPath, "index.html") : "";
if (distIndex && fs_1.default.existsSync(distIndex)) {
    logger_1.logger.info(`[SERVE] Client dist: ${distPath}`);
    app.use(express_1.default.static(distPath, {
        maxAge: "1y",
        immutable: true,
        setHeaders(res, filePath) {
            if (filePath.endsWith(".html")) {
                res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            }
        },
    }));
}
else {
    logger_1.logger.warn(config_1.CLIENT_APP_URL
        ? `[SERVE] Client dist NOT found - requests will redirect to ${config_1.CLIENT_APP_URL}`
        : "[SERVE] Client dist NOT found - client app will not be served");
}
app.get(["/", "/index.html"], (req, res) => {
    if (distIndex && fs_1.default.existsSync(distIndex)) {
        sendSpaIndex(res, distIndex);
        return;
    }
    if (config_1.CLIENT_APP_URL) {
        res.redirect(302, config_1.CLIENT_APP_URL);
        return;
    }
    res.status(200).json({ success: true, message: "KMJ ERP API" });
});
app.get(["/warehouse", "/warehouse/"], (req, res) => {
    if (warehouseIndex && fs_1.default.existsSync(warehouseIndex)) {
        sendSpaIndex(res, warehouseIndex);
        return;
    }
    if (config_1.WAREHOUSE_APP_URL) {
        res.redirect(302, config_1.WAREHOUSE_APP_URL);
        return;
    }
    res.status(404).end();
});
app.get(["/warehouse/*"], (req, res) => {
    if (warehouseIndex && fs_1.default.existsSync(warehouseIndex)) {
        if (isAssetRequest(req.path)) {
            res.status(404).end();
            return;
        }
        sendSpaIndex(res, warehouseIndex);
        return;
    }
    if (!isAssetRequest(req.path) && config_1.WAREHOUSE_APP_URL) {
        res.redirect(302, config_1.WAREHOUSE_APP_URL);
        return;
    }
    res.status(404).end();
});
app.get("*", (req, res) => {
    const decision = (0, spaFallback_1.resolveSpaRoute)({
        path: req.path,
        hasClientBuild: Boolean(distIndex) && fs_1.default.existsSync(distIndex),
        hasWarehouseBuild: Boolean(warehouseIndex) && fs_1.default.existsSync(warehouseIndex),
        clientUrl: config_1.CLIENT_APP_URL,
        warehouseUrl: config_1.WAREHOUSE_APP_URL,
    });
    switch (decision.kind) {
        case "api-404":
            res.status(404).json({ success: false, message: "API route not found" });
            return;
        case "serve-client":
            sendSpaIndex(res, distIndex);
            return;
        case "serve-warehouse":
            sendSpaIndex(res, warehouseIndex);
            return;
        case "redirect":
            res.redirect(302, decision.location);
            return;
        case "asset-404":
            res.status(404).end();
            return;
        default:
            res.status(200).json({ success: true, message: "KMJ ERP API" });
    }
});
app.use(errorHandler_1.errorHandler);
exports.default = app;
// Security headers for production
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
        next();
    });
}
//# sourceMappingURL=app.js.map
import { z } from "zod";
export declare const PORT: number;
export declare const MONGO_URI: string;
export declare const DATABASE_URL: string;
export declare const JWT_SECRET: string;
export declare const JWT_ACCESS_EXPIRY: string;
export declare const JWT_REFRESH_EXPIRY: string;
export declare const REDIS_URL: string;
export declare const WAREHOUSE_DB_NAME: string;
export declare const NODE_ENV: string;
export declare const LOG_LEVEL: z.core.$InferEnumOutput<{
    error: "error";
    debug: "debug";
    info: "info";
    warn: "warn";
}>;
export declare const CORS_ORIGINS: string[];
export declare const RATE_LIMIT_WINDOW_MS: number;
export declare const RATE_LIMIT_MAX: number;
export declare const AUTH_RATE_LIMIT_MAX: number;
export declare const CLIENT_APP_URL: string;
export declare const WAREHOUSE_APP_URL: string;
export declare const ENABLE_CLUSTER: boolean;
export declare const CLUSTER_WORKERS: number;
export declare const isProduction: boolean;
//# sourceMappingURL=config.d.ts.map
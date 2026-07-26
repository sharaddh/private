const API_URL = import.meta.env.VITE_API_URL || "";

const TOKEN_KEYS = {
  ACCESS: "wh_accessToken",
  REFRESH: "wh_refreshToken",
} as const;

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

interface RequestOptions extends RequestInit {
  timeout?: number;
  retries?: number;
}

let refreshPromise: Promise<boolean> | null = null;
let cachedToken: string | null = null;
let tokenCacheTime = 0;
const TOKEN_CACHE_TTL = 2000;

function getToken(): string | null {
  const now = Date.now();
  if (cachedToken !== null && now - tokenCacheTime < TOKEN_CACHE_TTL) return cachedToken;
  try {
    cachedToken = localStorage.getItem(TOKEN_KEYS.ACCESS);
    tokenCacheTime = now;
    return cachedToken;
  } catch { return null; }
}

function invalidateTokenCache() {
  cachedToken = null;
  tokenCacheTime = 0;
}

function getRefreshToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEYS.REFRESH); } catch { return null; }
}

function buildHeaders(isJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  headers["Accept"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });
      const data = await res.json();
      if (data.success && data.data?.access) {
        try { localStorage.setItem(TOKEN_KEYS.ACCESS, data.data.access); } catch {}
        invalidateTokenCache();
        return true;
      }
      return false;
    } catch { return false; }
    finally { refreshPromise = null; }
  })();

  return refreshPromise;
}

function clearTokens(): void {
  try {
    localStorage.removeItem(TOKEN_KEYS.ACCESS);
    localStorage.removeItem(TOKEN_KEYS.REFRESH);
  } catch {}
  invalidateTokenCache();
}

const inflightRequests = new Map<string, Promise<unknown>>();

function getInflightKey(method: string, path: string): string | null {
  if (method !== "GET") return null;
  return `${method}:${path}`;
}

async function request<T = unknown>(path: string, init: RequestOptions = {}): Promise<ApiResponse<T>> {
  const { timeout = 15000, retries = 1, signal: externalSignal, ...fetchInit } = init;
  const method = (fetchInit.method || "GET").toUpperCase();
  const isLoginPath = path.includes("/auth/login");

  const inflightKey = getInflightKey(method, path);
  if (inflightKey && inflightRequests.has(inflightKey)) {
    return inflightRequests.get(inflightKey) as Promise<ApiResponse<T>>;
  }

  const controller = new AbortController();
  const combinedSignal = externalSignal
    ? AbortSignal.any([externalSignal, controller.signal])
    : controller.signal;

  const timer = setTimeout(() => controller.abort(), timeout);

  const execute = async (): Promise<ApiResponse<T>> => {
    try {
      let res = await fetch(`${API_URL}${path}`, { ...fetchInit, signal: combinedSignal });

      if (res.status === 401 && !isLoginPath) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          const newToken = getToken();
          const newHeaders: Record<string, string> = {
            ...(fetchInit.headers as Record<string, string> || {}),
            Authorization: `Bearer ${newToken}`,
          };
          res = await fetch(`${API_URL}${path}`, { ...fetchInit, headers: newHeaders, signal: combinedSignal });
        } else {
          clearTokens();
          window.location.href = "/#/login";
          return { success: false, message: "Session expired" };
        }
      }

      const text = await res.text();
      let payload: ApiResponse<T>;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { success: false, message: text || res.statusText };
      }

      if (!res.ok) {
        return { success: false, message: payload.message || res.statusText };
      }
      return payload;
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        if (retries > 0) {
          return request<T>(path, { ...init, retries: retries - 1 });
        }
        return { success: false, message: "Request timed out" };
      }
      if (retries > 0 && !(err instanceof DOMException)) {
        return request<T>(path, { ...init, retries: retries - 1 });
      }
      return { success: false, message: "Network error" };
    } finally {
      clearTimeout(timer);
    }
  };

  const promise = execute();
  if (inflightKey) {
    inflightRequests.set(inflightKey, promise);
    promise.finally(() => inflightRequests.delete(inflightKey));
  }

  return promise;
}

const api = {
  get<T = unknown>(path: string, opts?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
    return request<T>(path, { ...opts, method: "GET", headers: buildHeaders(false) });
  },
  post<T = unknown>(path: string, body: unknown, opts?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
    return request<T>(path, {
      ...opts,
      method: "POST",
      headers: buildHeaders(true),
      body: JSON.stringify(body),
    });
  },
  put<T = unknown>(path: string, body: unknown, opts?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
    return request<T>(path, {
      ...opts,
      method: "PUT",
      headers: buildHeaders(true),
      body: JSON.stringify(body),
    });
  },
  del<T = unknown>(path: string, opts?: Partial<RequestOptions>): Promise<ApiResponse<T>> {
    return request<T>(path, { ...opts, method: "DELETE", headers: buildHeaders(false) });
  },
  setToken(token: string) {
    try { localStorage.setItem(TOKEN_KEYS.ACCESS, token); } catch {}
    invalidateTokenCache();
  },
  setRefreshToken(token: string) { try { localStorage.setItem(TOKEN_KEYS.REFRESH, token); } catch {} },
  clearToken() { clearTokens(); },
};

export type { ApiResponse, RequestOptions };
export default api;

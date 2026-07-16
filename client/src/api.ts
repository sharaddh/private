const API_URL = import.meta.env.VITE_API_URL || "";

const TOKEN_KEYS = {
  ACCESS: "accessToken",
  REFRESH: "refreshToken",
} as const;

const BRANCH_KEY = "currentBranchId";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  [key: string]: any;
}

interface RequestOptions extends RequestInit {
  signal?: AbortSignal;
}

let refreshPromise: Promise<boolean> | null = null;

function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEYS.ACCESS);
  } catch {
    return null;
  }
}

function getBranchId(): string | null {
  try {
    return localStorage.getItem(BRANCH_KEY);
  } catch {
    return null;
  }
}

function buildHeaders(isJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  headers["Accept"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const branchId = getBranchId();
  if (branchId) headers["x-branch-id"] = branchId;
  return headers;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = (() => { try { return localStorage.getItem(TOKEN_KEYS.REFRESH); } catch { return null; } })();
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
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function clearTokens(): void {
  try {
    localStorage.removeItem(TOKEN_KEYS.ACCESS);
    localStorage.removeItem(TOKEN_KEYS.REFRESH);
  } catch {}
}

async function request<T = unknown>(path: string, init: RequestOptions = {}, retries = 2): Promise<ApiResponse<T>> {
  const isLoginPath = path.includes("/auth/login") || path.includes("/auth/register");

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, init);
  } catch (err) {
    if (retries > 0 && !init.signal?.aborted) {
      await new Promise((r) => setTimeout(r, 1000));
      return request<T>(path, init, retries - 1);
    }
    return { success: false, message: "Network error. Please check your connection." };
  }

  if (res.status === 401 && !isLoginPath) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      const newHeaders: Record<string, string> = {
        ...(init.headers as Record<string, string> || {}),
        Authorization: `Bearer ${newToken}`,
      };
      res = await fetch(`${API_URL}${path}`, { ...init, headers: newHeaders });
    } else {
      clearTokens();
      const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = `/login?redirect=${returnUrl}`;
      return { success: false, message: "Session expired. Please login again." };
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
    return { success: false, message: payload.message || res.statusText, data: payload.data };
  }
  return payload;
}

export function createCancelableGet<T = any>(path: string): { promise: Promise<ApiResponse<T>>; abort: () => void } {
  const controller = new AbortController();
  const promise = request<T>(path, {
    headers: buildHeaders(false),
    signal: controller.signal,
  });
  return { promise, abort: () => controller.abort() };
}

export async function get<T = unknown>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, { headers: buildHeaders(false) });
}

export async function post<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });
}

export async function put<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "PUT",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });
}

export async function del<T = unknown>(path: string): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "DELETE",
    headers: buildHeaders(false),
  });
}

export async function patch<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(path, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });
}

export function setToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEYS.ACCESS, token); } catch {}
}

export function setRefreshToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEYS.REFRESH, token); } catch {}
}

export function clearToken(): void {
  clearTokens();
}

export type { ApiResponse };
export default { get, post, put, patch, del, setToken, setRefreshToken, clearToken };

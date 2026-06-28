const API_URL = import.meta.env.VITE_API_URL || "";

const TOKEN_KEYS = {
  ACCESS: "wh_accessToken",
  REFRESH: "wh_refreshToken",
} as const;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

let refreshPromise: Promise<boolean> | null = null;

function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEYS.ACCESS); } catch { return null; }
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
}

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const isLoginPath = path.includes("/auth/login");

  let res = await fetch(`${API_URL}${path}`, init);

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
      window.location.href = "/login";
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
}

const api = {
  get<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { headers: buildHeaders(false) });
  },
  post<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: "POST",
      headers: buildHeaders(true),
      body: JSON.stringify(body),
    });
  },
  put<T = unknown>(path: string, body: unknown): Promise<ApiResponse<T>> {
    return request<T>(path, {
      method: "PUT",
      headers: buildHeaders(true),
      body: JSON.stringify(body),
    });
  },
  del<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return request<T>(path, { method: "DELETE", headers: buildHeaders(false) });
  },
  setToken(token: string) { try { localStorage.setItem(TOKEN_KEYS.ACCESS, token); } catch {} },
  setRefreshToken(token: string) { try { localStorage.setItem(TOKEN_KEYS.REFRESH, token); } catch {} },
  clearToken() { clearTokens(); },
};

export type { ApiResponse };
export default api;

const API_URL = import.meta.env.VITE_API_URL || "";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  [key: string]: unknown;
}

function getToken(): string | null {
  return localStorage.getItem("accessToken");
}

function buildHeaders(isJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (isJson) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = localStorage.getItem("refreshToken");
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh }),
    });
    const data = await res.json();
    if (data.success && data.data?.access) {
      localStorage.setItem("accessToken", data.data.access);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function clearTokens(): void {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  let res = await fetch(`${API_URL}${path}`, init);
  if (res.status === 401 && !path.includes("/auth/login") && !path.includes("/auth/register")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = localStorage.getItem("accessToken");
      const newHeaders = { ...init.headers as Record<string, string>, Authorization: `Bearer ${newToken}` };
      res = await fetch(`${API_URL}${path}`, { ...init, headers: newHeaders });
    } else {
      clearTokens();
      window.location.href = "/login";
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
    return { success: false, message: payload?.message || res.statusText, ...payload };
  }
  return payload;
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
  localStorage.setItem("accessToken", token);
}

export function setRefreshToken(token: string): void {
  localStorage.setItem("refreshToken", token);
}

export function clearToken(): void {
  clearTokens();
}

export type { ApiResponse };
export default { get, post, put, patch, del, setToken, setRefreshToken, clearToken };

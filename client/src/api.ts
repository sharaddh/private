const API_URL = import.meta.env.VITE_API_URL || "";

function getToken() {
  return localStorage.getItem("accessToken");
}

function buildHeaders(isJson = true) {
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

async function request(path: string, init: RequestInit = {}) {
  let res = await fetch(`${API_URL}${path}`, init);
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = localStorage.getItem("accessToken");
      const newHeaders = { ...init.headers as any, Authorization: `Bearer ${newToken}` };
      res = await fetch(`${API_URL}${path}`, { ...init, headers: newHeaders });
    } else {
      clearToken();
      window.location.href = "/login";
      return { success: false, message: "Session expired. Please login again." };
    }
  }
  const text = await res.text();
  let payload: any = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { success: false, message: text || res.statusText };
  }

  if (!res.ok) {
    return {
      success: false,
      message: payload?.message || res.statusText,
      ...payload,
    };
  }

  return payload;
}

export async function get(path: string) {
  return request(path, { headers: buildHeaders(false) });
}

export async function post(path: string, body: any) {
  return request(path, {
    method: "POST",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });
}

export async function put(path: string, body: any) {
  return request(path, {
    method: "PUT",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });
}

export async function del(path: string) {
  return request(path, {
    method: "DELETE",
    headers: buildHeaders(false),
  });
}

export async function patch(path: string, body: any) {
  return request(path, {
    method: "PATCH",
    headers: buildHeaders(true),
    body: JSON.stringify(body),
  });
}

export function setToken(token: string) {
  localStorage.setItem("accessToken", token);
}

export function setRefreshToken(token: string) {
  localStorage.setItem("refreshToken", token);
}

export function clearToken() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
}

export default { get, post, put, patch, del, setToken, setRefreshToken, clearToken };

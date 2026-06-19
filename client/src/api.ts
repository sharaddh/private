const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

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

async function request(path: string, init: RequestInit = {}) {
  const res = await fetch(`${API_URL}${path}`, init);
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

export function clearToken() {
  localStorage.removeItem("accessToken");
}

export default { get, post, put, patch, del, setToken, clearToken };

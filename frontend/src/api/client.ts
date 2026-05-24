import { storage } from "@/src/utils/storage";

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const API_BASE = `${BASE_URL}/api`;

export type ApiError = { detail?: string };

async function request<T>(
  path: string,
  options: { method?: string; body?: any; auth?: boolean } = {},
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await storage.secureGet("tz_token", "");
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err: ApiError = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  get: <T>(path: string, auth = true) => request<T>(path, { method: "GET", auth }),
  post: <T>(path: string, body?: any, auth = true) =>
    request<T>(path, { method: "POST", body, auth }),
  put: <T>(path: string, body?: any, auth = true) =>
    request<T>(path, { method: "PUT", body, auth }),
  delete: <T>(path: string, auth = true) => request<T>(path, { method: "DELETE", auth }),
};

export { API_BASE };

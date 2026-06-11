import { env } from "../config/env";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export async function apiRequest<T>(input: {
  path: string;
  method?: HttpMethod;
  body?: unknown;
}) {
  const url = new URL(input.path, env.apiBaseUrl);

  const headers = new Headers();
  headers.set("Accept", "application/json");

  if (input.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    method: input.method ?? "GET",
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem("cotizapp_token");
      sessionStorage.removeItem("cotizapp_user");
      window.location.href = "/login";
      throw new Error("unauthorized");
    }
    const contentType = response.headers.get("content-type") ?? "";
    const errorBody = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    const message =
      typeof errorBody === "string"
        ? errorBody
        : typeof errorBody?.error === "string"
          ? errorBody.error
          : `HTTP ${response.status}`;
    const error = new Error(message);
    (error as Error & { status?: number; data?: unknown }).status = response.status;
    (error as Error & { status?: number; data?: unknown }).data = errorBody;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiRequestBlob(input: {
  path: string;
  method?: HttpMethod;
  body?: unknown;
  accept?: string;
}) {
  const url = new URL(input.path, env.apiBaseUrl);

  const headers = new Headers();
  headers.set("Accept", input.accept ?? "application/octet-stream");

  if (input.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(url, {
    method: input.method ?? "GET",
    headers,
    body: input.body !== undefined ? JSON.stringify(input.body) : undefined
  });

  if (!response.ok) {
    if (response.status === 401) {
      sessionStorage.removeItem("cotizapp_token");
      sessionStorage.removeItem("cotizapp_user");
      window.location.href = "/login";
      throw new Error("unauthorized");
    }
    const contentType = response.headers.get("content-type") ?? "";
    const errorBody = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");
    const message =
      typeof errorBody === "string"
        ? errorBody
        : typeof errorBody?.error === "string"
          ? errorBody.error
          : `HTTP ${response.status}`;
    const error = new Error(message);
    (error as Error & { status?: number; data?: unknown }).status = response.status;
    (error as Error & { status?: number; data?: unknown }).data = errorBody;
    throw error;
  }

  const blob = await response.blob();
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const filenameMatch = contentDisposition.match(/filename="([^"]+)"/i);
  const filename = filenameMatch?.[1];

  return { blob, filename, contentType: response.headers.get("content-type") ?? "", headers: response.headers };
}

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
    const text = await response.text().catch(() => "");
    const error = new Error(text || `HTTP ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

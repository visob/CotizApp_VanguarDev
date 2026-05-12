import { apiRequest } from "./apiClient";

export async function listQuotes() {
  return apiRequest<unknown[]>({ path: "/api/quotes" });
}

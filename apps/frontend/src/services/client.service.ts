import { apiRequest } from "./apiClient";
import type { Client } from "../types";

export async function listClients() {
  return apiRequest<Client[]>({ path: "/api/clients" });
}

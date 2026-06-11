import { apiRequest } from "./apiClient";
import type { ManagedUser, UserRole } from "../types";

export async function listUsers(input?: {
  includeInactive?: boolean;
  companyId?: number | null;
}) {
  const query = new URLSearchParams();
  if (input?.includeInactive) query.set("include_inactive", "true");
  if (input?.companyId !== undefined && input.companyId !== null) {
    query.set("id_empresa", String(input.companyId));
  }
  const path = query.size ? `/api/users?${query.toString()}` : "/api/users";
  const result = await apiRequest<{ ok: true; items: ManagedUser[] }>({ path });
  return result.items;
}

export async function getUser(id: number) {
  const result = await apiRequest<{ ok: true; item: ManagedUser }>({ path: `/api/users/${id}` });
  return result.item;
}

export async function createUser(input: {
  nombre: string;
  email: string;
  password: string;
  rol: UserRole;
  id_empresa?: number;
}) {
  const result = await apiRequest<{ ok: true; item: ManagedUser }>({
    path: "/api/users",
    method: "POST",
    body: input
  });
  return result.item;
}

export async function updateUser(
  id: number,
  input: { nombre?: string; email?: string; password?: string; rol?: UserRole; id_empresa?: number | null; activo?: boolean }
) {
  const result = await apiRequest<{ ok: true; item: ManagedUser }>({
    path: `/api/users/${id}`,
    method: "PUT",
    body: input
  });
  return result.item;
}

export async function deactivateUser(id: number) {
  await apiRequest<{ ok: true }>({
    path: `/api/users/${id}/deactivate`,
    method: "PATCH"
  });
}

export async function unlockUser(id: number) {
  const result = await apiRequest<{ ok: true; item: ManagedUser }>({
    path: `/api/users/${id}/unlock`,
    method: "PATCH"
  });
  return result.item;
}

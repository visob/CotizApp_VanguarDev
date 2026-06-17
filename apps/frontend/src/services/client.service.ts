import { apiRequest } from "./apiClient";
import type { Client, ClientContact } from "../types";

export type ClientQuoteSummary = {
  id: number;
  id_cliente: number;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  moneda: string;
  total_final: string;
  estado: string;
  proxima_alerta: string | null;
  reactivacion_activa?: number | null;
  fecha_reactivacion_1?: string | null;
  fecha_reactivacion_2?: string | null;
  fecha_reactivacion_3?: string | null;
};

export type ClientDetailResult = {
  ok: true;
  item: Client;
  quotes: ClientQuoteSummary[];
  reactivations: ClientQuoteSummary[];
};

export async function listClients() {
  const result = await apiRequest<{ ok: true; items: Client[] }>({ path: "/api/clients" });
  return result.items;
}

export async function getClient(id: number) {
  const result = await apiRequest<{ ok: true; item: Client }>({ path: `/api/clients/${id}` });
  return result.item;
}

export async function getClientDetail(id: number) {
  return apiRequest<ClientDetailResult>({ path: `/api/clients/${id}` });
}

export async function createClient(input: Omit<Client, "id">) {
  const result = await apiRequest<{ ok: true; item: Client }>({
    path: "/api/clients",
    method: "POST",
    body: input
  });
  return result.item;
}

export async function updateClient(id: number, input: Omit<Client, "id">) {
  const result = await apiRequest<{ ok: true; item: Client }>({
    path: `/api/clients/${id}`,
    method: "PUT",
    body: input
  });
  return result.item;
}

export async function deleteClient(id: number) {
  await apiRequest<void>({
    path: `/api/clients/${id}`,
    method: "DELETE"
  });
}

export async function listClientContacts(id: number) {
  const result = await apiRequest<{ ok: true; items: ClientContact[] }>({
    path: `/api/clients/${id}/contacts`
  });
  return result.items;
}

export async function createClientContact(
  id: number,
  input: { fecha_contacto: string; observacion?: string | null }
) {
  const result = await apiRequest<{ ok: true; item: ClientContact }>({
    path: `/api/clients/${id}/contacts`,
    method: "POST",
    body: input
  });
  return result.item;
}

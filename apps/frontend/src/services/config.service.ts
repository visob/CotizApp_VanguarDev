import { apiRequest } from "./apiClient";
import type { CatalogOption, CatalogOptionType } from "../types";

export type ConfigItem = {
  clave: string;
  valor: string;
};

export async function getConfig(clave: string): Promise<ConfigItem | null> {
  try {
    const data = await apiRequest<ConfigItem>({ path: `/api/config/${clave}` });
    return data;
  } catch (error) {
    console.error("Error fetching config:", error);
    return null;
  }
}

export async function setConfig(clave: string, valor: string): Promise<ConfigItem> {
  const data = await apiRequest<ConfigItem>({
    path: `/api/config/${clave}`,
    method: "PUT",
    body: { valor },
  });
  return data;
}

export async function listCatalogOptions(input?: {
  tipo?: CatalogOptionType;
  includeInactive?: boolean;
}) {
  const params = new URLSearchParams();
  if (input?.tipo) params.set("tipo", input.tipo);
  if (input?.includeInactive) params.set("include_inactive", "true");
  const path = params.size ? `/api/config/catalog/options?${params.toString()}` : "/api/config/catalog/options";
  const data = await apiRequest<{ ok: true; items: CatalogOption[] }>({ path });
  return data.items;
}

export async function createCatalogOption(input: {
  tipo: CatalogOptionType;
  label: string;
  value?: string;
}) {
  const data = await apiRequest<{ ok: true; item: CatalogOption }>({
    path: "/api/config/catalog/options",
    method: "POST",
    body: input
  });
  return data.item;
}

export async function updateCatalogOption(
  id: number,
  input: { label?: string; value?: string; activo?: boolean }
) {
  const data = await apiRequest<{ ok: true; item: CatalogOption }>({
    path: `/api/config/catalog/options/${id}`,
    method: "PUT",
    body: input
  });
  return data.item;
}

export async function deactivateCatalogOption(id: number) {
  const data = await apiRequest<{ ok: true; item: CatalogOption }>({
    path: `/api/config/catalog/options/${id}/deactivate`,
    method: "PATCH"
  });
  return data.item;
}

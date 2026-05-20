import { apiRequest } from "./apiClient";

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

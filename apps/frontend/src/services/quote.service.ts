import { apiRequest, apiRequestBlob } from "./apiClient";
import type { CurrencyCode } from "../types";

export type QuoteListItem = {
  id: number;
  fecha_emision: string;
  moneda: CurrencyCode;
  total_final: string;
  estado: string;
  cliente_nombre_empresa: string;
  cliente_clasificacion: string | null;
  proxima_alerta: string | null;
};

export async function listQuotes(input?: {
  q?: string;
  estado?: string;
  from?: string;
  to?: string;
}) {
  const params = new URLSearchParams();
  if (input?.q) params.set("q", input.q);
  if (input?.estado) params.set("estado", input.estado);
  if (input?.from) params.set("from", input.from);
  if (input?.to) params.set("to", input.to);
  const qs = params.toString();
  const path = qs ? `/api/quotes?${qs}` : "/api/quotes";
  const result = await apiRequest<{ ok: true; items: QuoteListItem[] }>({ path });
  return result.items;
}

export type CreateQuoteInput = {
  id_cliente: number;
  moneda: CurrencyCode;
  estado?: string;
  fecha_emision?: string;
  fecha_vencimiento?: string;
  descuento_global?: string;
  iva_porcentaje?: string;
  tipo_cambio?: string;
  notas?: string;
  plazo_entrega?: string;
  forma_pago?: string;
  lugar_entrega?: string;
  mantenimiento_oferta?: string;
  proxima_alerta?: string;
  items: Array<{ id_producto: number; cantidad: number; descuento_porcentaje?: string }>;
  return_pdf?: boolean;
};

export type CreateQuoteResult = {
  ok: true;
  id: number;
  moneda: CurrencyCode;
  estado: string;
  subtotal: string;
  iva_porcentaje: string;
  descuento_global: string;
  total_final: string;
};

export async function createQuote(input: CreateQuoteInput) {
  return apiRequest<CreateQuoteResult>({
    path: "/api/quotes",
    method: "POST",
    body: input
  });
}

export async function downloadQuotePdf(id: number) {
  return apiRequestBlob({ path: `/api/quotes/${id}/pdf`, accept: "application/pdf" });
}

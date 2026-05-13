import { apiRequest, apiRequestBlob } from "./apiClient";
import type { CurrencyCode } from "../types";

export async function listQuotes() {
  return apiRequest<unknown[]>({ path: "/api/quotes" });
}

export type CreateQuoteInput = {
  id_cliente: number;
  moneda: CurrencyCode;
  descuento_global?: string;
  iva_porcentaje?: string;
  tipo_cambio?: string;
  items: Array<{ id_producto: number; cantidad: number }>;
  return_pdf?: boolean;
};

export type CreateQuoteResult = {
  ok: true;
  id: number;
  moneda: CurrencyCode;
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

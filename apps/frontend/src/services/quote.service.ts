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
  fecha_reactivacion_1?: string | null;
  fecha_reactivacion_2?: string | null;
  fecha_reactivacion_3?: string | null;
  reactivacion_activa?: number;
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
  descuento_porcentaje_global?: string;
  tipo_cambio?: string;
  notas?: string;
  plazo_entrega?: string;
  forma_pago?: string;
  lugar_entrega?: string;
  proxima_alerta?: string;
  fecha_reactivacion_1?: string;
  fecha_reactivacion_2?: string;
  fecha_reactivacion_3?: string;
  reactivacion_activa?: number;
  items: Array<{
    id_producto: number;
    cantidad: number;
    iva_porcentaje: string;
  }>;
  return_pdf?: boolean;
};

export type CreateQuoteResult = {
  ok: true;
  id: number;
  moneda: CurrencyCode;
  estado: string;
  subtotal: string;
  iva_porcentaje: string;
  descuento_porcentaje_global: string;
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

export type QuoteDetailItem = {
  id: number;
  id_cotizacion: number;
  id_producto: number;
  cantidad: number;
  precio_unitario_momento: string;
  iva_porcentaje: string;
  producto_nombre: string;
};

export type QuoteDetailResult = {
  ok: true;
  quote: {
    id: number;
    id_cliente: number;
    id_usuario: number;
    fecha_emision: string;
    fecha_vencimiento: string | null;
    moneda: CurrencyCode;
    tipo_cambio: string;
    subtotal: string;
    iva_porcentaje: string;
    descuento_porcentaje_global: string;
    descuento_global: string;
    total_final: string;
    estado: string;
    notas: string | null;
    plazo_entrega: string | null;
    forma_pago: string | null;
    lugar_entrega: string | null;
    proxima_alerta: string | null;
    fecha_reactivacion_1: string | null;
    fecha_reactivacion_2: string | null;
    fecha_reactivacion_3: string | null;
    reactivacion_activa: number;
  };
  items: QuoteDetailItem[];
  client: {
    id: number;
    nombre_empresa: string;
    contacto_principal: string | null;
    cuit_tax_id: string | null;
    clasificacion: string | null;
  };
};

export async function getQuote(id: number) {
  return apiRequest<QuoteDetailResult>({ path: `/api/quotes/${id}` });
}

export async function updateQuote(
  id: number,
  data: {
    estado?: string;
    proxima_alerta?: string | null;
    fecha_reactivacion_activa?: string | null;
    fecha_reactivacion_1?: string | null;
    fecha_reactivacion_2?: string | null;
    fecha_reactivacion_3?: string | null;
    reactivacion_activa?: number;
  }
) {
  return apiRequest<{ ok: true }>({
    path: `/api/quotes/${id}`,
    method: "PATCH",
    body: data
  });
}

export type QuoteReactivationAlert = QuoteListItem & {
  id_cliente: number;
  id_usuario: number;
  fecha_reactivacion_activa: string;
};

export async function listReactivationAlerts() {
  const result = await apiRequest<{ ok: true; items: QuoteReactivationAlert[] }>({
    path: "/api/quotes/reactivation-alerts"
  });
  return result.items;
}

export type QuoteTrackingEvent = {
  id: number;
  id_cotizacion: number;
  id_usuario: number | null;
  fecha_accion: string;
  tipo_accion: string;
  observaciones: string | null;
  fecha_reactivacion_programada: string | null;
  metadata: unknown;
  usuario_nombre: string | null;
  usuario_email: string | null;
};

export async function listQuoteTracking(id: number) {
  const result = await apiRequest<{ ok: true; items: QuoteTrackingEvent[] }>({ path: `/api/quotes/${id}/tracking` });
  return result.items;
}

export async function addQuoteTrackingEvent(
  id: number,
  input: { tipo_accion: string; observaciones?: string | null; metadata?: unknown }
) {
  return apiRequest<{ ok: true; id: number }>({
    path: `/api/quotes/${id}/tracking`,
    method: "POST",
    body: {
      tipo_accion: input.tipo_accion,
      observaciones: input.observaciones ?? null,
      metadata: input.metadata ?? {}
    }
  });
}

export async function addQuoteTrackingNote(id: number, input: { nota: string; metadata?: unknown }) {
  return addQuoteTrackingEvent(id, { tipo_accion: "NOTA", observaciones: input.nota, metadata: input.metadata });
}

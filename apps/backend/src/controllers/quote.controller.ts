import type { Request, Response } from "express";
import { getClientById } from "../models/client.model.js";
import { getProductById } from "../models/product.model.js";
import {
  createQuoteTransactional,
  getQuoteById,
  listQuoteItems,
  listQuotes
} from "../models/quote.model.js";
import { generateQuotePdfBuffer } from "../services/pdf.service.js";
import {
  basisPointsToPercentString,
  calculateQuoteTotalsFromLines,
  centsToMoneyString,
  parseDecimalString,
  parseMoneyToCents,
  parsePercentToBasisPoints
} from "../services/quote.service.js";

function parseId(value: unknown) {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(n) ? n : null;
}

function parseQty(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  return int > 0 ? int : null;
}

function parseIsoDateOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function parseTextOrNull(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

const allowedEstados = new Set([
  "BORRADOR",
  "EMITIDA",
  "ENVIADA",
  "POSPUESTA",
  "PEND_REACTIVACION",
  "CERRADA_PERDIDA",
  "CERRADA_GANADA"
]);

export async function listQuotesHandler(req: Request, res: Response) {
  const q = typeof req.query?.q === "string" ? req.query.q.trim() : "";
  const estado = typeof req.query?.estado === "string" ? req.query.estado.trim() : "";
  const from = typeof req.query?.from === "string" ? parseIsoDateOrNull(req.query.from) : null;
  const to = typeof req.query?.to === "string" ? parseIsoDateOrNull(req.query.to) : null;

  const items = await listQuotes({
    q: q || undefined,
    estado: estado || undefined,
    from: from || undefined,
    to: to || undefined
  });
  res.json({ ok: true, items });
}

export async function createQuoteHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const idCliente = parseId(req.body?.id_cliente);
  const moneda = req.body?.moneda === "ARS" || req.body?.moneda === "USD" ? req.body.moneda : null;
  const descuentoCents = parseMoneyToCents(req.body?.descuento_global ?? "0") ?? 0n;
  const ivaBp =
    parsePercentToBasisPoints(req.body?.iva_porcentaje ?? process.env.DEFAULT_IVA ?? "21") ?? 2100n;
  const tipoCambio = parseDecimalString(req.body?.tipo_cambio ?? "1", 6);
  const returnPdf = req.body?.return_pdf === true;
  const estadoRaw = typeof req.body?.estado === "string" ? req.body.estado.trim() : "";
  const estado = allowedEstados.has(estadoRaw) ? estadoRaw : "EMITIDA";

  const fechaEmisionIso = parseIsoDateOrNull(req.body?.fecha_emision) ?? new Date().toISOString();
  const fechaVencimientoIso = parseIsoDateOrNull(req.body?.fecha_vencimiento);
  const proximaAlertaIso = parseIsoDateOrNull(req.body?.proxima_alerta);
  const notas = parseTextOrNull(req.body?.notas);
  const plazoEntrega = parseTextOrNull(req.body?.plazo_entrega);
  const formaPago = parseTextOrNull(req.body?.forma_pago);
  const lugarEntrega = parseTextOrNull(req.body?.lugar_entrega);
  const mantenimientoOferta = parseTextOrNull(req.body?.mantenimiento_oferta);

  const items = Array.isArray(req.body?.items) ? (req.body.items as unknown[]) : [];
  const parsedItems = items
    .map((it) => {
      const idProducto = parseId((it as any)?.id_producto);
      const cantidad = parseQty((it as any)?.cantidad);
      const descuentoBp =
        parsePercentToBasisPoints((it as any)?.descuento_porcentaje ?? (it as any)?.descuento ?? "0") ?? 0n;
      return idProducto && cantidad ? { idProducto, cantidad, descuentoBp } : null;
    })
    .filter((x): x is { idProducto: number; cantidad: number; descuentoBp: bigint } => x !== null);

  if (!idCliente || !moneda || !tipoCambio) {
    res.status(400).json({ ok: false, error: "invalid_request" });
    return;
  }

  const client = await getClientById(idCliente);
  if (!client) {
    res.status(400).json({ ok: false, error: "cliente_invalido" });
    return;
  }

  const lineTotals: bigint[] = [];
  const itemsToInsert: Array<{
    idProducto: number;
    cantidad: number;
    precioUnitarioMomento: string;
    descuentoPorcentaje: string;
  }> = [];

  if (parsedItems.length === 0 && estado !== "BORRADOR") {
    res.status(400).json({ ok: false, error: "items_requeridos" });
    return;
  }

  for (const it of parsedItems) {
    const product = await getProductById(it.idProducto);
    if (!product) {
      res.status(400).json({ ok: false, error: "producto_invalido" });
      return;
    }

    const unitStr = moneda === "ARS" ? product.precio_ars : product.precio_usd;
    const unitCents = parseMoneyToCents(unitStr);
    if (unitCents === null) {
      res.status(400).json({ ok: false, error: "precio_producto_invalido" });
      return;
    }

    const grossLineTotal = unitCents * BigInt(it.cantidad);
    const discountLineCents = (grossLineTotal * it.descuentoBp + 5000n) / 10000n;
    const netLineTotal = grossLineTotal > discountLineCents ? grossLineTotal - discountLineCents : 0n;

    lineTotals.push(netLineTotal);
    itemsToInsert.push({
      idProducto: it.idProducto,
      cantidad: it.cantidad,
      precioUnitarioMomento: centsToMoneyString(unitCents),
      descuentoPorcentaje: basisPointsToPercentString(it.descuentoBp)
    });
  }

  const totals = calculateQuoteTotalsFromLines({
    lineTotalsCents: lineTotals,
    ivaBasisPoints: ivaBp,
    discountCents: descuentoCents
  });

  const quoteId = await createQuoteTransactional({
    idCliente,
    idUsuario: req.user.id,
    fechaEmisionIso,
    fechaVencimientoIso: fechaVencimientoIso ?? null,
    moneda,
    tipoCambio,
    subtotal: centsToMoneyString(totals.subtotalCents),
    ivaPorcentaje: basisPointsToPercentString(ivaBp),
    descuentoGlobal: centsToMoneyString(descuentoCents),
    totalFinal: centsToMoneyString(totals.totalFinalCents),
    estado,
    notas,
    plazoEntrega,
    formaPago,
    lugarEntrega,
    mantenimientoOferta,
    proximaAlertaIso,
    items: itemsToInsert
  });

  if (returnPdf) {
    const pdf = await generateQuotePdfBuffer(quoteId);
    res.status(201);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="cotizacion-${quoteId}.pdf"`);
    res.setHeader("X-Quote-Id", String(quoteId));
    res.setHeader("X-Quote-Moneda", moneda);
    res.setHeader("X-Quote-Items", String(itemsToInsert.length));
    res.send(pdf);
    return;
  }

  res.status(201).json({
    ok: true,
    id: quoteId,
    moneda,
    estado,
    subtotal: centsToMoneyString(totals.subtotalCents),
    iva_porcentaje: basisPointsToPercentString(ivaBp),
    descuento_global: centsToMoneyString(descuentoCents),
    total_final: centsToMoneyString(totals.totalFinalCents)
  });
}

export async function getQuotePdfHandler(req: Request, res: Response) {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const quote = await getQuoteById(id);
  if (!quote) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  const items = await listQuoteItems(id);
  const pdf = await generateQuotePdfBuffer(id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="cotizacion-${id}.pdf"`);
  res.setHeader("X-Quote-Id", String(id));
  res.setHeader("X-Quote-Moneda", quote.moneda);
  res.setHeader("X-Quote-Items", String(items.length));
  res.send(pdf);
}

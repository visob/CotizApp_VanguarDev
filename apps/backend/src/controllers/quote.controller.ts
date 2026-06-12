import type { Request, Response } from "express";
import { getActiveCatalogOptionByValue } from "../models/config.model.js";
import { getClientById } from "../models/client.model.js";
import { getProductById } from "../models/product.model.js";
import {
  createQuoteTransactional,
  getQuoteById,
  listQuoteItems,
  listQuotes,
  updateQuote
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
import { getCompanyIdForWrite, getScopedCompanyId, parseNumericId } from "../utils/request-scope.js";

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
    companyId: getScopedCompanyId(req),
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

  const companyId = getCompanyIdForWrite(req);
  if (!companyId) {
    res.status(400).json({ ok: false, error: "empresa_requerida" });
    return;
  }

  const idCliente = parseNumericId(req.body?.id_cliente);
  const moneda = req.body?.moneda === "ARS" || req.body?.moneda === "USD" ? req.body.moneda : null;
  const descuentoGlobalBp =
    parsePercentToBasisPoints(
      req.body?.descuento_porcentaje_global ?? req.body?.descuento_porcentaje ?? req.body?.descuento_global ?? "0"
    ) ?? 0n;
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

  const items = Array.isArray(req.body?.items) ? (req.body.items as unknown[]) : [];
  const itemsWithProduct = items.filter((it) => parseNumericId((it as any)?.id_producto));
  const parsedItems = items
    .map((it) => {
      const idProducto = parseNumericId((it as any)?.id_producto);
      const cantidad = parseQty((it as any)?.cantidad);
      const ivaValue = typeof (it as any)?.iva_porcentaje === "string" ? (it as any).iva_porcentaje.trim() : "";
      return idProducto && cantidad && ivaValue ? { idProducto, cantidad, ivaValue } : null;
    })
    .filter((x): x is { idProducto: number; cantidad: number; ivaValue: string } => x !== null);

  if (!idCliente || !moneda || !tipoCambio) {
    res.status(400).json({ ok: false, error: "invalid_request" });
    return;
  }

  if (descuentoGlobalBp < 0n || descuentoGlobalBp > 10000n) {
    res.status(400).json({ ok: false, error: "descuento_global_invalido" });
    return;
  }

  if (itemsWithProduct.length !== parsedItems.length) {
    res.status(400).json({ ok: false, error: "tipo_iva_requerido" });
    return;
  }

  if (formaPago) {
    const option = await getActiveCatalogOptionByValue(companyId, "forma_pago", formaPago);
    if (!option) {
      res.status(400).json({ ok: false, error: "forma_pago_invalida" });
      return;
    }
  }

  if (lugarEntrega) {
    const option = await getActiveCatalogOptionByValue(companyId, "lugar_entrega", lugarEntrega);
    if (!option) {
      res.status(400).json({ ok: false, error: "lugar_entrega_invalido" });
      return;
    }
  }

  const client = await getClientById(idCliente, companyId);
  if (!client) {
    res.status(400).json({ ok: false, error: "cliente_invalido" });
    return;
  }

  const linesForTotals: Array<{ grossSubtotalCents: bigint; ivaBasisPoints: bigint }> = [];
  const itemsToInsert: Array<{
    idProducto: number;
    cantidad: number;
    precioUnitarioMomento: string;
    ivaPorcentaje: string;
  }> = [];

  if (parsedItems.length === 0 && estado !== "BORRADOR") {
    res.status(400).json({ ok: false, error: "items_requeridos" });
    return;
  }

  for (const it of parsedItems) {
    const product = await getProductById(it.idProducto, companyId);
    if (!product) {
      res.status(400).json({ ok: false, error: "producto_invalido" });
      return;
    }

    const ivaOption = await getActiveCatalogOptionByValue(companyId, "tipo_iva", it.ivaValue);
    if (!ivaOption) {
      res.status(400).json({ ok: false, error: "tipo_iva_invalido" });
      return;
    }
    const ivaBp = parsePercentToBasisPoints(ivaOption.value);
    if (ivaBp === null) {
      res.status(400).json({ ok: false, error: "tipo_iva_invalido" });
      return;
    }

    const unitStr = moneda === "ARS" ? product.precio_ars : product.precio_usd;
    const unitCents = parseMoneyToCents(unitStr);
    if (unitCents === null) {
      res.status(400).json({ ok: false, error: "precio_producto_invalido" });
      return;
    }

    const grossLineTotal = unitCents * BigInt(it.cantidad);
    linesForTotals.push({ grossSubtotalCents: grossLineTotal, ivaBasisPoints: ivaBp });
    itemsToInsert.push({
      idProducto: it.idProducto,
      cantidad: it.cantidad,
      precioUnitarioMomento: centsToMoneyString(unitCents),
      ivaPorcentaje: basisPointsToPercentString(ivaBp)
    });
  }

  const totals = calculateQuoteTotalsFromLines({
    lines: linesForTotals,
    globalDiscountBasisPoints: descuentoGlobalBp
  });

  const effectiveIvaBp =
    totals.subtotalCents > 0n ? (totals.ivaCents * 10000n + totals.subtotalCents / 2n) / totals.subtotalCents : 0n;

  const quoteId = await createQuoteTransactional({
    idEmpresa: companyId,
    idCliente,
    idUsuario: req.user.id,
    fechaEmisionIso,
    fechaVencimientoIso: fechaVencimientoIso ?? null,
    moneda,
    tipoCambio,
    subtotal: centsToMoneyString(totals.subtotalCents),
    ivaPorcentaje: basisPointsToPercentString(effectiveIvaBp),
    descuentoPorcentajeGlobal: basisPointsToPercentString(descuentoGlobalBp),
    descuentoGlobal: centsToMoneyString(totals.discountCents),
    totalFinal: centsToMoneyString(totals.totalFinalCents),
    estado,
    notas,
    plazoEntrega,
    formaPago,
    lugarEntrega,
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
    iva_porcentaje: basisPointsToPercentString(effectiveIvaBp),
    descuento_porcentaje_global: basisPointsToPercentString(descuentoGlobalBp),
    descuento_global: centsToMoneyString(totals.discountCents),
    total_final: centsToMoneyString(totals.totalFinalCents)
  });
}

export async function getQuotePdfHandler(req: Request, res: Response) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const companyId = getScopedCompanyId(req);
  const quote = await getQuoteById(id, companyId);
  if (!quote) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  const items = await listQuoteItems(id, companyId);
  const pdf = await generateQuotePdfBuffer(id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="cotizacion-${id}.pdf"`);
  res.setHeader("X-Quote-Id", String(id));
  res.setHeader("X-Quote-Moneda", quote.moneda);
  res.setHeader("X-Quote-Items", String(items.length));
  res.send(pdf);
}

export async function getQuoteHandler(req: Request, res: Response) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const companyId = getScopedCompanyId(req);
  const quote = await getQuoteById(id, companyId);
  if (!quote) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  const items = await listQuoteItems(id, companyId);
  const client = await getClientById(Number(quote.id_cliente), companyId);

  res.json({ ok: true, quote, items, client });
}

export async function updateQuoteHandler(req: Request, res: Response) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const data: { estado?: string; proxima_alerta?: string | null } = {};

  if (req.body?.estado) {
    const estadoRaw = req.body.estado.trim();
    if (allowedEstados.has(estadoRaw)) {
      data.estado = estadoRaw;
    }
  }

  if (req.body?.proxima_alerta !== undefined) {
    data.proxima_alerta = req.body.proxima_alerta ? parseIsoDateOrNull(req.body.proxima_alerta) : null;
  }

  const success = await updateQuote(id, data, getScopedCompanyId(req));
  if (!success) {
    res.status(404).json({ ok: false, error: "not_found_or_no_changes" });
    return;
  }

  res.json({ ok: true });
}

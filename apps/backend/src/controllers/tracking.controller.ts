import type { Request, Response } from "express";
import { getQuoteById, addQuoteTrackingEvent, listQuoteTrackingEvents } from "../models/quote.model.js";
import { getScopedCompanyId, parseNumericId } from "../utils/request-scope.js";

function parseTextOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function listTrackingEvents(req: Request, res: Response) {
  const quoteId = parseNumericId(req.params.id);
  if (!quoteId) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const companyId = getScopedCompanyId(req);
  const quote = await getQuoteById(quoteId, companyId);
  if (!quote) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  let items = await listQuoteTrackingEvents(quoteId, companyId);
  const hasCreation = items.some((row) => row.tipo_accion === "CREACION");
  if (!hasCreation) {
    await addQuoteTrackingEvent({
      quoteId,
      userId: quote.id_usuario ? Number(quote.id_usuario) : null,
      actionType: "CREACION",
      actionAtIso: quote.fecha_emision ?? new Date().toISOString(),
      note: null,
      metadata: { estado: quote.estado, tipo_cambio: quote.tipo_cambio, moneda: quote.moneda }
    });
    items = await listQuoteTrackingEvents(quoteId, companyId);
  }
  res.json({
    ok: true,
    items: items.map((row) => ({
      ...row,
      id: Number(row.id),
      id_cotizacion: Number(row.id_cotizacion),
      id_usuario: row.id_usuario === null ? null : Number(row.id_usuario)
    }))
  });
}

export async function addTrackingEvent(_req: Request, res: Response) {
  const quoteId = parseNumericId(_req.params.id);
  if (!quoteId) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  if (!_req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const companyId = getScopedCompanyId(_req);
  const quote = await getQuoteById(quoteId, companyId);
  if (!quote) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  const actionTypeRaw = parseTextOrNull(_req.body?.tipo_accion) ?? "NOTA";
  const note = parseTextOrNull(_req.body?.observaciones ?? _req.body?.nota);
  const metadata = typeof _req.body?.metadata === "object" && _req.body?.metadata !== null ? _req.body.metadata : {};

  if ((actionTypeRaw === "NOTA" || actionTypeRaw === "NOTA_EDITADA") && !note) {
    res.status(400).json({ ok: false, error: "nota_requerida" });
    return;
  }

  if (actionTypeRaw === "NOTA_EDITADA") {
    const noteKey =
      typeof (metadata as any)?.noteKey === "string" ? ((metadata as any).noteKey as string).trim() : "";
    if (!noteKey) {
      res.status(400).json({ ok: false, error: "note_key_requerida" });
      return;
    }
  }

  const id = await addQuoteTrackingEvent({
    quoteId,
    userId: _req.user.id,
    actionType: actionTypeRaw,
    actionAtIso: new Date().toISOString(),
    note,
    metadata
  });

  res.status(201).json({ ok: true, id });
}

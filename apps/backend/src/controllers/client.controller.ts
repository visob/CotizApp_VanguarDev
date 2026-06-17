import type { Request, Response } from "express";
import { getActiveCatalogOptionByValue } from "../models/config.model.js";
import {
  createClientContact,
  createClient,
  deleteClient,
  findDuplicateClient,
  getClientById,
  listClientQuotes,
  listClientReactivations,
  listClientContacts,
  listClients,
  updateClient
} from "../models/client.model.js";
import { getCompanyIdForWrite, getScopedCompanyId, parseNumericId } from "../utils/request-scope.js";

const allowedClientStates = new Set(["Activo", "Pausado", "Desactivado", "Baja"]);

function isValidEmail(value: string | null) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toNullableString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function toValidIsoDateTime(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const date = new Date(trimmed);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function listClientsHandler(req: Request, res: Response) {
  const items = await listClients(getScopedCompanyId(req));
  res.json({
    ok: true,
    items: items.map((c) => ({
      ...c,
      id: Number(c.id)
    }))
  });
}

export async function getClientHandler(req: Request, res: Response) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const companyId = getScopedCompanyId(req);
  const item = await getClientById(id, companyId);
  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  const [quotes, reactivations] = await Promise.all([
    listClientQuotes(id, companyId),
    listClientReactivations(id, companyId)
  ]);

  res.json({
    ok: true,
    item: { ...item, id: Number(item.id) },
    quotes: quotes.map((quote) => ({
      ...quote,
      id: Number(quote.id),
      id_cliente: Number(quote.id_cliente)
    })),
    reactivations: reactivations.map((quote) => ({
      ...quote,
      id: Number(quote.id),
      id_cliente: Number(quote.id_cliente)
    }))
  });
}

export async function createClientHandler(req: Request, res: Response) {
  const companyId = getCompanyIdForWrite(req);
  if (!companyId) {
    res.status(400).json({ ok: false, error: "empresa_requerida" });
    return;
  }

  const nombre_empresa = toNullableString(req.body?.nombre_empresa);
  if (!nombre_empresa) {
    res.status(400).json({ ok: false, error: "nombre_empresa_required" });
    return;
  }

  const contacto_principal = toNullableString(req.body?.contacto_principal);
  const cuit_tax_id = toNullableString(req.body?.cuit_tax_id);
  if (!cuit_tax_id) {
    res.status(400).json({ ok: false, error: "cuit_tax_id_required" });
    return;
  }
  const clasificacion = toNullableString(req.body?.clasificacion);
  const email = toNullableString(req.body?.email);
  const telefono = toNullableString(req.body?.telefono);
  const direccion = toNullableString(req.body?.direccion);
  const codigo_postal = toNullableString(req.body?.codigo_postal);
  const pais = toNullableString(req.body?.pais);
  const provincia = toNullableString(req.body?.provincia);
  const estado = toNullableString(req.body?.estado) ?? "Activo";
  const ult_contacto = toNullableString(req.body?.ult_contacto);

  if (!allowedClientStates.has(estado)) {
    res.status(400).json({ ok: false, error: "estado_invalido" });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "email_invalido" });
    return;
  }

  if (clasificacion) {
    const option = await getActiveCatalogOptionByValue(companyId, "tipo_cliente", clasificacion);
    if (!option) {
      res.status(400).json({ ok: false, error: "clasificacion_invalida" });
      return;
    }
  }

  const duplicate = await findDuplicateClient(companyId, { nombre_empresa, cuit_tax_id });
  if (duplicate) {
    res.status(409).json({ ok: false, error: duplicate });
    return;
  }

  const item = await createClient(companyId, {
    nombre_empresa,
    contacto_principal,
    cuit_tax_id,
    clasificacion,
    email,
    telefono,
    direccion,
    codigo_postal,
    pais,
    provincia,
    estado,
    ult_contacto
  });

  res.status(201).json({ ok: true, item: { ...item, id: Number(item.id) } });
}

export async function updateClientHandler(req: Request, res: Response) {
  const id = parseNumericId(req.params.id);
  const companyId = getCompanyIdForWrite(req);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }
  if (!companyId) {
    res.status(400).json({ ok: false, error: "empresa_requerida" });
    return;
  }

  const nombre_empresa = toNullableString(req.body?.nombre_empresa);
  if (!nombre_empresa) {
    res.status(400).json({ ok: false, error: "nombre_empresa_required" });
    return;
  }

  const contacto_principal = toNullableString(req.body?.contacto_principal);
  const cuit_tax_id = toNullableString(req.body?.cuit_tax_id);
  if (!cuit_tax_id) {
    res.status(400).json({ ok: false, error: "cuit_tax_id_required" });
    return;
  }
  const clasificacion = toNullableString(req.body?.clasificacion);
  const email = toNullableString(req.body?.email);
  const telefono = toNullableString(req.body?.telefono);
  const direccion = toNullableString(req.body?.direccion);
  const codigo_postal = toNullableString(req.body?.codigo_postal);
  const pais = toNullableString(req.body?.pais);
  const provincia = toNullableString(req.body?.provincia);
  const estado = toNullableString(req.body?.estado) ?? "Activo";
  const ult_contacto = toNullableString(req.body?.ult_contacto);

  if (!allowedClientStates.has(estado)) {
    res.status(400).json({ ok: false, error: "estado_invalido" });
    return;
  }

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, error: "email_invalido" });
    return;
  }

  if (clasificacion) {
    const option = await getActiveCatalogOptionByValue(companyId, "tipo_cliente", clasificacion);
    if (!option) {
      res.status(400).json({ ok: false, error: "clasificacion_invalida" });
      return;
    }
  }

  const duplicate = await findDuplicateClient(companyId, { nombre_empresa, cuit_tax_id }, id);
  if (duplicate) {
    res.status(409).json({ ok: false, error: duplicate });
    return;
  }

  const item = await updateClient(id, {
    nombre_empresa,
    contacto_principal,
    cuit_tax_id,
    clasificacion,
    email,
    telefono,
    direccion,
    codigo_postal,
    pais,
    provincia,
    estado,
    ult_contacto
  }, companyId);

  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({ ok: true, item: { ...item, id: Number(item.id) } });
}

export async function deleteClientHandler(req: Request, res: Response) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const deleted = await deleteClient(id, getScopedCompanyId(req));
  if (!deleted) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.status(204).send();
}

export async function listClientContactsHandler(req: Request, res: Response) {
  const clientId = parseNumericId(req.params.id);
  if (!clientId) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const companyId = getScopedCompanyId(req);
  const client = await getClientById(clientId, companyId);
  if (!client) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  const items = await listClientContacts(clientId, companyId);
  res.json({
    ok: true,
    items: items.map((item) => ({
      ...item,
      id: Number(item.id),
      id_empresa: Number(item.id_empresa),
      id_cliente: Number(item.id_cliente),
      id_usuario: Number(item.id_usuario)
    }))
  });
}

export async function createClientContactHandler(req: Request, res: Response) {
  const clientId = parseNumericId(req.params.id);
  const companyId = getCompanyIdForWrite(req);
  if (!req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }
  if (!clientId) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }
  if (!companyId) {
    res.status(400).json({ ok: false, error: "empresa_requerida" });
    return;
  }

  const fechaContacto = toValidIsoDateTime(req.body?.fecha_contacto);
  if (!fechaContacto) {
    res.status(400).json({ ok: false, error: "fecha_contacto_invalida" });
    return;
  }

  const observacion = toNullableString(req.body?.observacion);

  const item = await createClientContact({
    companyId,
    clientId,
    userId: req.user.id,
    fechaContacto,
    observacion
  });

  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.status(201).json({
    ok: true,
    item: {
      ...item,
      id: Number(item.id),
      id_empresa: Number(item.id_empresa),
      id_cliente: Number(item.id_cliente),
      id_usuario: Number(item.id_usuario)
    }
  });
}

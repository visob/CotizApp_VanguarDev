import type { Request, Response } from "express";
import {
  createClient,
  deleteClient,
  findDuplicateClient,
  getClientById,
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

  const item = await getClientById(id, getScopedCompanyId(req));
  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({ ok: true, item: { ...item, id: Number(item.id) } });
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

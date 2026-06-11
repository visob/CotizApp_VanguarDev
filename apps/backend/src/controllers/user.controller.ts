import crypto from "node:crypto";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { getCompanyById } from "../models/company.model.js";
import {
  createUser,
  deactivateUser,
  getUserById,
  listUsers,
  unlockUser,
  updateUser
} from "../models/user.model.js";
import type { UserRole } from "../types/index.js";
import { canAssignRole, isRole, isSuperAdmin } from "../utils/access.js";
import { parseNumericId } from "../utils/request-scope.js";

const scryptAsync = promisify(crypto.scrypt);

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

function parseRole(value: unknown): UserRole | null {
  return typeof value === "string" && isRole(value) ? value : null;
}

async function validateTargetCompany(actor: NonNullable<Request["user"]>, companyId: number | null) {
  if (companyId === null) {
    return actor.rol === "SuperAdmin";
  }
  if (actor.rol === "Admin") {
    return actor.empresaId === companyId;
  }
  const company = await getCompanyById(companyId);
  return Boolean(company?.activo);
}

export async function listUsersHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const includeInactive = req.query?.include_inactive === "true";
  const companyId = isSuperAdmin(req.user)
    ? parseNumericId(req.query?.id_empresa)
    : req.user.empresaId;
  const items = await listUsers({ companyId, includeInactive });
  res.json({
    ok: true,
    items: items.map((item) => ({
      ...item,
      id: Number(item.id),
      id_empresa: item.id_empresa === null ? null : Number(item.id_empresa)
    }))
  });
}

export async function getUserHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const companyId = isSuperAdmin(req.user) ? undefined : req.user.empresaId;
  const item = await getUserById(id, companyId);
  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({
    ok: true,
    item: {
      ...item,
      id: Number(item.id),
      id_empresa: item.id_empresa === null ? null : Number(item.id_empresa)
    }
  });
}

export async function createUserHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const nombre = toNonEmptyString(req.body?.nombre);
  const email = toNonEmptyString(req.body?.email);
  const password = toNonEmptyString(req.body?.password);
  const rol = parseRole(req.body?.rol);

  if (!nombre || !email || !password || !rol) {
    res.status(400).json({ ok: false, error: "invalid_request" });
    return;
  }
  if (!canAssignRole(req.user, rol)) {
    res.status(403).json({ ok: false, error: "forbidden_role" });
    return;
  }

  const requestedCompanyId = parseNumericId(req.body?.id_empresa);
  const targetCompanyId = req.user.rol === "Admin" ? req.user.empresaId : (requestedCompanyId ?? null);

  if (rol !== "SuperAdmin" && !targetCompanyId) {
    res.status(400).json({ ok: false, error: "empresa_requerida" });
    return;
  }
  if (!(await validateTargetCompany(req.user, targetCompanyId))) {
    res.status(400).json({ ok: false, error: "empresa_invalida" });
    return;
  }

  const item = await createUser({
    empresaId: rol === "SuperAdmin" ? targetCompanyId : targetCompanyId,
    nombre,
    email: normalizeEmail(email),
    passwordHash: await hashPassword(password),
    rol
  });

  res.status(201).json({
    ok: true,
    item: {
      ...item,
      id: Number(item.id),
      id_empresa: item.id_empresa === null ? null : Number(item.id_empresa)
    }
  });
}

export async function updateUserHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const current = await getUserById(id, isSuperAdmin(req.user) ? undefined : req.user.empresaId);
  if (!current) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (req.user.rol === "Admin" && current.rol === "SuperAdmin") {
    res.status(403).json({ ok: false, error: "forbidden_target" });
    return;
  }

  const nombre = req.body?.nombre === undefined ? undefined : toNonEmptyString(req.body?.nombre);
  const email = req.body?.email === undefined ? undefined : toNonEmptyString(req.body?.email);
  const password = req.body?.password === undefined ? undefined : toNonEmptyString(req.body?.password);
  const rol = req.body?.rol === undefined ? undefined : parseRole(req.body?.rol);

  if (req.body?.nombre !== undefined && !nombre) {
    res.status(400).json({ ok: false, error: "nombre_required" });
    return;
  }
  if (req.body?.email !== undefined && !email) {
    res.status(400).json({ ok: false, error: "email_required" });
    return;
  }
  if (req.body?.rol !== undefined && !rol) {
    res.status(400).json({ ok: false, error: "rol_invalido" });
    return;
  }
  if (rol && !canAssignRole(req.user, rol)) {
    res.status(403).json({ ok: false, error: "forbidden_role" });
    return;
  }

  const requestedCompanyId =
    req.body?.id_empresa === undefined ? undefined : parseNumericId(req.body?.id_empresa);
  const targetCompanyId =
    requestedCompanyId === undefined
      ? undefined
      : req.user.rol === "Admin"
        ? req.user.empresaId
        : requestedCompanyId;

  if (targetCompanyId !== undefined && !(await validateTargetCompany(req.user, targetCompanyId))) {
    res.status(400).json({ ok: false, error: "empresa_invalida" });
    return;
  }

  if (Number(current.id) === req.user.id && req.body?.activo === false) {
    res.status(400).json({ ok: false, error: "cannot_deactivate_self" });
    return;
  }

  const item = await updateUser(
    id,
    {
      empresaId: rol === "SuperAdmin" && targetCompanyId === undefined ? null : targetCompanyId,
      nombre: nombre ?? undefined,
      email: email ? normalizeEmail(email) : undefined,
      passwordHash: password ? await hashPassword(password) : undefined,
      rol: rol ?? undefined,
      activo: typeof req.body?.activo === "boolean" ? req.body.activo : undefined
    },
    isSuperAdmin(req.user) ? undefined : req.user.empresaId
  );

  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({
    ok: true,
    item: {
      ...item,
      id: Number(item.id),
      id_empresa: item.id_empresa === null ? null : Number(item.id_empresa)
    }
  });
}

export async function deactivateUserHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }
  if (id === req.user.id) {
    res.status(400).json({ ok: false, error: "cannot_deactivate_self" });
    return;
  }

  const current = await getUserById(id, isSuperAdmin(req.user) ? undefined : req.user.empresaId);
  if (!current) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (req.user.rol === "Admin" && current.rol === "SuperAdmin") {
    res.status(403).json({ ok: false, error: "forbidden_target" });
    return;
  }

  const ok = await deactivateUser(id, isSuperAdmin(req.user) ? undefined : req.user.empresaId);
  if (!ok) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({ ok: true });
}

export async function unlockUserHandler(req: Request, res: Response) {
  if (!req.user) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return;
  }

  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const current = await getUserById(id, isSuperAdmin(req.user) ? undefined : req.user.empresaId);
  if (!current) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }
  if (req.user.rol === "Admin" && current.rol === "SuperAdmin") {
    res.status(403).json({ ok: false, error: "forbidden_target" });
    return;
  }

  const item = await unlockUser(id, isSuperAdmin(req.user) ? undefined : req.user.empresaId);
  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({
    ok: true,
    item: {
      ...item,
      id: Number(item.id),
      id_empresa: item.id_empresa === null ? null : Number(item.id_empresa)
    }
  });
}

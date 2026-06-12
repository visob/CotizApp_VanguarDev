import type { Request, Response } from "express";
import {
  createProduct,
  deleteProduct,
  findDuplicateProduct,
  getProductById,
  listProducts,
  updateProduct
} from "../models/product.model.js";
import { getCompanyIdForWrite, getScopedCompanyId, parseNumericId } from "../utils/request-scope.js";

const allowedProductStates = new Set(["Activo", "Pausado", "Desactivado"]);

function parsePrice(value: unknown) {
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(",", "."))
        : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseStock(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) {
    return null;
  }
  const int = Math.trunc(n);
  return int >= -1 ? int : null;
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export async function listProductsHandler(_req: Request, res: Response) {
  const items = await listProducts(getScopedCompanyId(_req));
  res.json({
    ok: true,
    items: items.map((p) => ({
      ...p,
      id: Number(p.id)
    }))
  });
}

export async function getProductHandler(req: Request, res: Response) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const item = await getProductById(id, getScopedCompanyId(req));
  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({ ok: true, item: { ...item, id: Number(item.id) } });
}

export async function createProductHandler(req: Request, res: Response) {
  const companyId = getCompanyIdForWrite(req);
  if (!companyId) {
    res.status(400).json({ ok: false, error: "empresa_requerida" });
    return;
  }

  const nombre = toNonEmptyString(req.body?.nombre);
  const precioArs = parsePrice(req.body?.precio_ars);
  const precioUsd = parsePrice(req.body?.precio_usd);
  const stock = parseStock(req.body?.stock);
  const sku = toNonEmptyString(req.body?.sku);
  const descripcion = toNonEmptyString(req.body?.descripcion);
  const estado = toNonEmptyString(req.body?.estado) ?? "Activo";
  const garantia = toNonEmptyString(req.body?.garantia);

  if (!nombre) {
    res.status(400).json({ ok: false, error: "nombre_required" });
    return;
  }

  if (precioArs === null || precioUsd === null) {
    res.status(400).json({ ok: false, error: "precio_ars_y_usd_requeridos" });
    return;
  }

  if (stock === null) {
    res.status(400).json({ ok: false, error: "stock_invalido" });
    return;
  }

  if (!allowedProductStates.has(estado)) {
    res.status(400).json({ ok: false, error: "estado_invalido" });
    return;
  }

  const duplicate = await findDuplicateProduct(companyId, { nombre, sku });
  if (duplicate) {
    res.status(409).json({ ok: false, error: duplicate });
    return;
  }

  const item = await createProduct(companyId, {
    nombre,
    precio_ars: String(precioArs),
    precio_usd: String(precioUsd),
    stock,
    sku,
    descripcion,
    estado,
    garantia
  });

  res.status(201).json({ ok: true, item: { ...item, id: Number(item.id) } });
}

export async function updateProductHandler(req: Request, res: Response) {
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

  const nombre = toNonEmptyString(req.body?.nombre);
  const precioArs = parsePrice(req.body?.precio_ars);
  const precioUsd = parsePrice(req.body?.precio_usd);
  const stock = parseStock(req.body?.stock);
  const sku = toNonEmptyString(req.body?.sku);
  const descripcion = toNonEmptyString(req.body?.descripcion);
  const estado = toNonEmptyString(req.body?.estado) ?? "Activo";
  const garantia = toNonEmptyString(req.body?.garantia);

  if (!nombre) {
    res.status(400).json({ ok: false, error: "nombre_required" });
    return;
  }

  if (precioArs === null || precioUsd === null) {
    res.status(400).json({ ok: false, error: "precio_ars_y_usd_requeridos" });
    return;
  }

  if (stock === null) {
    res.status(400).json({ ok: false, error: "stock_invalido" });
    return;
  }

  if (!allowedProductStates.has(estado)) {
    res.status(400).json({ ok: false, error: "estado_invalido" });
    return;
  }

  const duplicate = await findDuplicateProduct(companyId, { nombre, sku }, id);
  if (duplicate) {
    res.status(409).json({ ok: false, error: duplicate });
    return;
  }

  const item = await updateProduct(id, {
    nombre,
    precio_ars: String(precioArs),
    precio_usd: String(precioUsd),
    stock,
    sku,
    descripcion,
    estado,
    garantia
  }, companyId);

  if (!item) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.json({ ok: true, item: { ...item, id: Number(item.id) } });
}

export async function deleteProductHandler(req: Request, res: Response) {
  const id = parseNumericId(req.params.id);
  if (!id) {
    res.status(400).json({ ok: false, error: "invalid_id" });
    return;
  }

  const deleted = await deleteProduct(id, getScopedCompanyId(req));
  if (!deleted) {
    res.status(404).json({ ok: false, error: "not_found" });
    return;
  }

  res.status(204).send();
}

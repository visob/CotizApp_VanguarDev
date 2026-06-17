import { Router } from "express";
import type { Request, Response } from "express";
import * as configModel from "../models/config.model.js";
import * as productModel from "../models/product.model.js";
import { canManageUsers } from "../utils/access.js";
import { getScopedCompanyId } from "../utils/request-scope.js";

export const configRouter = Router();

function isCatalogType(value: unknown): value is configModel.CatalogOptionType {
  return (
    value === "forma_pago" ||
    value === "lugar_entrega" ||
    value === "tipo_iva" ||
    value === "tipo_cliente" ||
    value === "tipo_producto"
  );
}

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function ensureAdminCatalogAccess(req: Request, res: Response) {
  if (!req.user || !canManageUsers(req.user)) {
    res.status(403).json({ error: "forbidden" });
    return false;
  }
  return true;
}

configRouter.get("/catalog/options", async (req, res) => {
  try {
    const companyId = getScopedCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: "empresa_requerida" });
    }

    const tipo = typeof req.query?.tipo === "string" && isCatalogType(req.query.tipo) ? req.query.tipo : undefined;
    const includeInactive = req.query?.include_inactive === "true";
    const items = await configModel.listCatalogOptions({ companyId, tipo, includeInactive });
    res.json({
      ok: true,
      items: items.map((item) => ({
        ...item,
        id: Number(item.id),
        id_empresa: Number(item.id_empresa)
      }))
    });
  } catch (error) {
    console.error("GET /config/catalog/options error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

configRouter.post("/catalog/options", async (req, res) => {
  try {
    if (!ensureAdminCatalogAccess(req, res)) {
      return;
    }

    const companyId = getScopedCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: "empresa_requerida" });
    }

    const tipo = isCatalogType(req.body?.tipo) ? req.body.tipo : null;
    const label = toNonEmptyString(req.body?.label);
    const value = toNonEmptyString(req.body?.value) ?? label;

    if (!tipo || !label || !value) {
      return res.status(400).json({ error: "invalid_request" });
    }

    const item = await configModel.createCatalogOption({ companyId, tipo, label, value });
    res.status(201).json({
      ok: true,
      item: {
        ...item,
        id: Number(item.id),
        id_empresa: Number(item.id_empresa)
      }
    });
  } catch (error) {
    console.error("POST /config/catalog/options error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

configRouter.put("/catalog/options/:id", async (req, res) => {
  try {
    if (!ensureAdminCatalogAccess(req, res)) {
      return;
    }

    const companyId = getScopedCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: "empresa_requerida" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "invalid_id" });
    }

    const label = req.body?.label === undefined ? undefined : toNonEmptyString(req.body?.label);
    const value = req.body?.value === undefined ? undefined : toNonEmptyString(req.body?.value);

    if (req.body?.label !== undefined && !label) {
      return res.status(400).json({ error: "label_required" });
    }
    if (req.body?.value !== undefined && !value) {
      return res.status(400).json({ error: "value_required" });
    }

    const item = await configModel.updateCatalogOption(id, companyId, {
      label: label ?? undefined,
      value: value ?? undefined,
      activo: typeof req.body?.activo === "boolean" ? req.body.activo : undefined
    });

    if (!item) {
      return res.status(404).json({ error: "not_found" });
    }

    res.json({
      ok: true,
      item: {
        ...item,
        id: Number(item.id),
        id_empresa: Number(item.id_empresa)
      }
    });
  } catch (error) {
    console.error("PUT /config/catalog/options/:id error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

configRouter.patch("/catalog/options/:id/deactivate", async (req, res) => {
  try {
    if (!ensureAdminCatalogAccess(req, res)) {
      return;
    }

    const companyId = getScopedCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: "empresa_requerida" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "invalid_id" });
    }

    const item = await configModel.updateCatalogOption(id, companyId, { activo: false });
    if (!item) {
      return res.status(404).json({ error: "not_found" });
    }

    res.json({
      ok: true,
      item: {
        ...item,
        id: Number(item.id),
        id_empresa: Number(item.id_empresa)
      }
    });
  } catch (error) {
    console.error("PATCH /config/catalog/options/:id/deactivate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

configRouter.patch("/catalog/options/:id/activate", async (req, res) => {
  try {
    if (!ensureAdminCatalogAccess(req, res)) {
      return;
    }

    const companyId = getScopedCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: "empresa_requerida" });
    }

    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "invalid_id" });
    }

    const item = await configModel.updateCatalogOption(id, companyId, { activo: true });
    if (!item) {
      return res.status(404).json({ error: "not_found" });
    }

    res.json({
      ok: true,
      item: {
        ...item,
        id: Number(item.id),
        id_empresa: Number(item.id_empresa)
      }
    });
  } catch (error) {
    console.error("PATCH /config/catalog/options/:id/activate error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/config/:clave
configRouter.get("/:clave", async (req, res) => {
  try {
    const companyId = getScopedCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: "empresa_requerida" });
    }
    const { clave } = req.params;
    const item = await configModel.getConfig(clave, companyId);
    if (!item) {
      return res.status(404).json({ error: "Configuracion no encontrada" });
    }
    res.json(item);
  } catch (error) {
    console.error("GET /config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/config/:clave
configRouter.put("/:clave", async (req, res) => {
  try {
    const companyId = getScopedCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ error: "empresa_requerida" });
    }
    const { clave } = req.params;
    const { valor } = req.body;
    
    if (valor === undefined) {
      return res.status(400).json({ error: "Se requiere un valor" });
    }

    const rate = parseFloat(String(valor));
    if (clave === "exchange_rate" && (isNaN(rate) || rate <= 0)) {
      return res.status(400).json({ error: "La tasa de cambio debe ser un número positivo" });
    }
    
    const item = await configModel.setConfig(companyId, clave, String(valor));

    if (clave === "exchange_rate") {
      await productModel.recalcPrecioArsForCompany(companyId, rate);
    }

    res.json(item);
  } catch (error) {
    console.error("PUT /config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

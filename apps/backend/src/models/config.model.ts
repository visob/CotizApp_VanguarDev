import type { PoolClient } from "pg";
import { pool } from "../config/database.js";

export type ConfigRow = {
  id_empresa?: string | number | null;
  clave: string;
  valor: string;
};

export type CatalogOptionType = "forma_pago" | "lugar_entrega" | "tipo_iva" | "tipo_cliente" | "tipo_producto";

export type CatalogOptionRow = {
  id: string | number;
  id_empresa: string | number;
  tipo: CatalogOptionType;
  label: string;
  value: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

type Queryable = Pick<PoolClient, "query">;

export const DEFAULT_CATALOG_OPTIONS: ReadonlyArray<{
  tipo: CatalogOptionType;
  label: string;
  value: string;
}> = [
  { tipo: "forma_pago", label: "Efectivo", value: "efectivo" },
  { tipo: "lugar_entrega", label: "Deposito", value: "deposito" },
  { tipo: "tipo_iva", label: "IVA 21%", value: "21" },
  { tipo: "tipo_producto", label: "General", value: "General" },
  { tipo: "tipo_cliente", label: "Consumidor Final", value: "Consumidor Final" },
  { tipo: "tipo_cliente", label: "Cliente final", value: "Cliente final" },
  { tipo: "tipo_cliente", label: "Distribuidor", value: "Distribuidor" }
];

export async function getConfig(clave: string, companyId: number) {
  const result = await pool.query<ConfigRow>(
    "SELECT id_empresa, clave, valor FROM configuraciones WHERE id_empresa = $1 AND clave = $2 LIMIT 1",
    [companyId, clave]
  );
  return result.rows[0] ?? null;
}

export async function setConfig(companyId: number, clave: string, valor: string) {
  const result = await pool.query<ConfigRow>(
    `
      INSERT INTO configuraciones (id_empresa, clave, valor)
      VALUES ($1, $2, $3)
      ON CONFLICT (id_empresa, clave) DO UPDATE SET valor = EXCLUDED.valor
      RETURNING id_empresa, clave, valor
    `,
    [companyId, clave, valor]
  );
  return result.rows[0];
}

export async function listCatalogOptions(input: {
  companyId: number;
  tipo?: CatalogOptionType;
  includeInactive?: boolean;
}) {
  const values: unknown[] = [input.companyId];
  const where = ["id_empresa = $1"];

  if (input.tipo) {
    values.push(input.tipo);
    where.push(`tipo = $${values.length}`);
  }

  if (!input.includeInactive) {
    where.push("activo = true");
  }

  const result = await pool.query<CatalogOptionRow>(
    `
      select id, id_empresa, tipo, label, value, activo, created_at, updated_at
      from empresa_catalog_options
      where ${where.join(" and ")}
      order by tipo asc, label asc, id asc
    `,
    values
  );
  return result.rows;
}

export async function getCatalogOptionById(id: number, companyId: number) {
  const result = await pool.query<CatalogOptionRow>(
    `
      select id, id_empresa, tipo, label, value, activo, created_at, updated_at
      from empresa_catalog_options
      where id = $1 and id_empresa = $2
      limit 1
    `,
    [id, companyId]
  );
  return result.rows[0] ?? null;
}

export async function getActiveCatalogOptionByValue(
  companyId: number,
  tipo: CatalogOptionType,
  value: string
) {
  const result = await pool.query<CatalogOptionRow>(
    `
      select id, id_empresa, tipo, label, value, activo, created_at, updated_at
      from empresa_catalog_options
      where id_empresa = $1 and tipo = $2 and value = $3 and activo = true
      limit 1
    `,
    [companyId, tipo, value]
  );
  return result.rows[0] ?? null;
}

export async function createCatalogOption(input: {
  companyId: number;
  tipo: CatalogOptionType;
  label: string;
  value: string;
}) {
  const result = await pool.query<CatalogOptionRow>(
    `
      insert into empresa_catalog_options (id_empresa, tipo, label, value, activo)
      values ($1, $2, $3, $4, true)
      returning id, id_empresa, tipo, label, value, activo, created_at, updated_at
    `,
    [input.companyId, input.tipo, input.label, input.value]
  );
  return result.rows[0];
}

export async function ensureDefaultCatalogOptions(companyId: number, db: Queryable = pool) {
  for (const option of DEFAULT_CATALOG_OPTIONS) {
    await db.query(
      `
        insert into empresa_catalog_options (id_empresa, tipo, label, value, activo)
        values ($1, $2, $3, $4, true)
        on conflict (id_empresa, tipo, label)
        do update set
          value = excluded.value,
          activo = true,
          updated_at = now()
      `,
      [companyId, option.tipo, option.label, option.value]
    );
  }
}

export async function updateCatalogOption(
  id: number,
  companyId: number,
  input: { label?: string; value?: string; activo?: boolean }
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.label !== undefined) {
    updates.push(`label = $${idx++}`);
    values.push(input.label);
  }
  if (input.value !== undefined) {
    updates.push(`value = $${idx++}`);
    values.push(input.value);
  }
  if (input.activo !== undefined) {
    updates.push(`activo = $${idx++}`);
    values.push(input.activo);
  }

  updates.push("updated_at = now()");

  values.push(id);
  values.push(companyId);
  const result = await pool.query<CatalogOptionRow>(
    `
      update empresa_catalog_options
      set ${updates.join(", ")}
      where id = $${idx++} and id_empresa = $${idx}
      returning id, id_empresa, tipo, label, value, activo, created_at, updated_at
    `,
    values
  );
  return result.rows[0] ?? null;
}

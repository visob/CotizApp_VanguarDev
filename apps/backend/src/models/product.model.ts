import { pool } from "../config/database.js";

export type ProductRow = {
  id: string | number;
  id_empresa?: string | number;
  nombre: string;
  tipo_producto: string;
  precio_ars: string;
  precio_usd: string;
  sku: string | null;
  descripcion: string | null;
  estado: string;
  garantia: string | null;
};

export type ProductInput = {
  nombre: string;
  tipo_producto: string;
  precio_ars: string;
  precio_usd: string;
  sku: string | null;
  descripcion: string | null;
  estado: string;
  garantia: string | null;
};

type DuplicateProductResult = "duplicate_nombre" | "duplicate_sku" | null;

export async function listProducts(companyId?: number | null) {
  const values: unknown[] = [];
  const whereSql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `where id_empresa = $${values.length}`;
        })()
      : "";
  const result = await pool.query<ProductRow>(
    `select id, nombre, tipo_producto, precio_ars, precio_usd, sku, descripcion, estado, garantia
     from productos
     ${whereSql}
     order by id desc`,
    values
  );
  return result.rows;
}

export async function getProductById(id: number, companyId?: number | null) {
  const values: unknown[] = [id];
  const companySql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `and id_empresa = $${values.length}`;
        })()
      : "";
  const result = await pool.query<ProductRow>(
    `select id, nombre, tipo_producto, precio_ars, precio_usd, sku, descripcion, estado, garantia
     from productos
     where id = $1
     ${companySql}
     limit 1`,
    values
  );
  return result.rows[0] ?? null;
}

export async function createProduct(companyId: number, input: ProductInput) {
  const result = await pool.query<ProductRow>(
    `
      insert into productos (id_empresa, nombre, tipo_producto, precio_ars, precio_usd, sku, descripcion, estado, garantia)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning id, nombre, tipo_producto, precio_ars, precio_usd, sku, descripcion, estado, garantia
    `,
    [
      companyId,
      input.nombre,
      input.tipo_producto,
      input.precio_ars,
      input.precio_usd,
      input.sku,
      input.descripcion,
      input.estado || "Activo",
      input.garantia
    ]
  );
  return result.rows[0];
}

export async function findDuplicateProduct(
  companyId: number,
  input: Pick<ProductInput, "nombre" | "sku">,
  excludeId?: number
): Promise<DuplicateProductResult> {
  const baseValues: unknown[] = [companyId];
  const excludeSql =
    excludeId !== undefined
      ? (() => {
          baseValues.push(excludeId);
          return `and id <> $${baseValues.length}`;
        })()
      : "";

  const nameResult = await pool.query<{ id: string | number }>(
    `
      select id
      from productos
      where id_empresa = $1
        and lower(trim(nombre)) = lower(trim($${baseValues.length + 1}))
        ${excludeSql}
      limit 1
    `,
    [...baseValues, input.nombre]
  );

  if (nameResult.rows[0]) {
    return "duplicate_nombre";
  }

  if (!input.sku) {
    return null;
  }

  const skuResult = await pool.query<{ id: string | number }>(
    `
      select id
      from productos
      where id_empresa = $1
        and sku is not null
        and lower(trim(sku)) = lower(trim($${baseValues.length + 1}))
        ${excludeSql}
      limit 1
    `,
    [...baseValues, input.sku]
  );

  return skuResult.rows[0] ? "duplicate_sku" : null;
}

export async function updateProduct(id: number, input: ProductInput, companyId?: number | null) {
  const values: unknown[] = [
    id,
    input.nombre,
    input.tipo_producto,
    input.precio_ars,
    input.precio_usd,
    input.sku,
    input.descripcion,
    input.estado || "Activo",
    input.garantia
  ];
  const companySql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `and id_empresa = $${values.length}`;
        })()
      : "";
  const result = await pool.query<ProductRow>(
    `
      update productos
      set
        nombre = $2,
        tipo_producto = $3,
        precio_ars = $4,
        precio_usd = $5,
        sku = $6,
        descripcion = $7,
        estado = $8,
        garantia = $9
      where id = $1
      ${companySql}
      returning id, nombre, tipo_producto, precio_ars, precio_usd, sku, descripcion, estado, garantia
    `,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteProduct(id: number, companyId?: number | null) {
  const values: unknown[] = [id];
  const companySql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `and id_empresa = $${values.length}`;
        })()
      : "";
  const result = await pool.query<{ id: string | number }>(
    `delete from productos where id = $1 ${companySql} returning id`,
    values
  );
  return (result.rows[0]?.id ?? null) !== null;
}

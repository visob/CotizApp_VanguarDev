import { pool } from "../config/database.js";

export type ProductRow = {
  id: string | number;
  nombre: string;
  precio_ars: string;
  precio_usd: string;
  stock: number;
};

export async function listProducts() {
  const result = await pool.query<ProductRow>(
    "select id, nombre, precio_ars, precio_usd, stock from productos order by id desc"
  );
  return result.rows;
}

export async function getProductById(id: number) {
  const result = await pool.query<ProductRow>(
    "select id, nombre, precio_ars, precio_usd, stock from productos where id = $1 limit 1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createProduct(input: Omit<ProductRow, \"id\">) {
  const result = await pool.query<ProductRow>(
    `
      insert into productos (nombre, precio_ars, precio_usd, stock)
      values ($1, $2, $3, $4)
      returning id, nombre, precio_ars, precio_usd, stock
    `,
    [input.nombre, input.precio_ars, input.precio_usd, input.stock]
  );
  return result.rows[0];
}

export async function updateProduct(id: number, input: Omit<ProductRow, \"id\">) {
  const result = await pool.query<ProductRow>(
    `
      update productos
      set
        nombre = $2,
        precio_ars = $3,
        precio_usd = $4,
        stock = $5
      where id = $1
      returning id, nombre, precio_ars, precio_usd, stock
    `,
    [id, input.nombre, input.precio_ars, input.precio_usd, input.stock]
  );
  return result.rows[0] ?? null;
}

export async function deleteProduct(id: number) {
  const result = await pool.query<{ id: string | number }>(
    "delete from productos where id = $1 returning id",
    [id]
  );
  return (result.rows[0]?.id ?? null) !== null;
}

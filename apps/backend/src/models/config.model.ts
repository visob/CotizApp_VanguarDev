import { pool } from "../config/database.js";

export type ConfigRow = {
  clave: string;
  valor: string;
};

export async function getConfig(clave: string) {
  const result = await pool.query<ConfigRow>(
    "SELECT clave, valor FROM configuraciones WHERE clave = $1 LIMIT 1",
    [clave]
  );
  return result.rows[0] ?? null;
}

export async function setConfig(clave: string, valor: string) {
  const result = await pool.query<ConfigRow>(
    `
      INSERT INTO configuraciones (clave, valor)
      VALUES ($1, $2)
      ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor
      RETURNING clave, valor
    `,
    [clave, valor]
  );
  return result.rows[0];
}

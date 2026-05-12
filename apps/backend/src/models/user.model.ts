import { pool } from "../config/database.js";

export type DbUser = {
  id: string | number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: string;
};

export async function getUserByEmail(email: string) {
  const result = await pool.query<DbUser>(
    `select id, nombre, email, password_hash, rol from usuarios where email = $1 limit 1`,
    [email]
  );
  return result.rows[0] ?? null;
}

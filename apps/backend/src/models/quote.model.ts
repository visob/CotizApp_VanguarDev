import { pool } from "../config/database.js";

export async function getQuotes() {
  const result = await pool.query(
    "select id, id_cliente, id_usuario, fecha_emision, moneda, total_final, estado from cotizaciones order by id desc"
  );
  return result.rows;
}


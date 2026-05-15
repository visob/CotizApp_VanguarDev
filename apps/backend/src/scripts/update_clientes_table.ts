import { pool } from "../config/database.js";

async function main() {
  console.log("Adding new columns to clientes table...");
  try {
    await pool.query(`
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email TEXT;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono TEXT;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion TEXT;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS pais TEXT;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS provincia TEXT;
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';
      ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ult_contacto TIMESTAMPTZ;
    `);
    console.log("Columns added successfully!");
  } catch (error) {
    console.error("Error adding columns:", error);
  } finally {
    await pool.end();
  }
}

main();

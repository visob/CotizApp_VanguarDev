import { pool } from "../config/database.js";

async function main() {
  console.log("Adding new columns to productos table...");
  try {
    await pool.query(`
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku TEXT;
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion TEXT;
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';
      ALTER TABLE productos ADD COLUMN IF NOT EXISTS garantia TEXT;
    `);
    console.log("Columns added successfully!");
  } catch (error) {
    console.error("Error adding columns:", error);
  } finally {
    await pool.end();
  }
}

main();

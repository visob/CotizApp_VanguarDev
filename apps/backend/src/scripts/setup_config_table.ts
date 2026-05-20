import { pool } from "../config/database.js";

async function main() {
  console.log("Setting up configuraciones table...");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    
    // Create table
    await client.query(`
      CREATE TABLE IF NOT EXISTS configuraciones (
        clave TEXT PRIMARY KEY,
        valor TEXT NOT NULL
      );
    `);

    // Insert default exchange rate if it doesn't exist
    await client.query(`
      INSERT INTO configuraciones (clave, valor)
      VALUES ('exchange_rate', '1000')
      ON CONFLICT (clave) DO NOTHING;
    `);

    await client.query("COMMIT");
    console.log("Setup complete!");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error setting up configuraciones:", error);
  } finally {
    client.release();
    pool.end();
  }
}

main().catch(console.error);

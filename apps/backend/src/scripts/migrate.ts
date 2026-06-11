import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../config/database.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const schemaPath = path.resolve(__dirname, "../../../../db/schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");

  process.stdout.write(`Migrating DB using ${schemaPath}\n`);

  const client = await pool.connect();
  try {
    await client.query(sql);
    process.stdout.write("Migration OK\n");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(async (error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`Migration ERROR:\n${message}\n`);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});

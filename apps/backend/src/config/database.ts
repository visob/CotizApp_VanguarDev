import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const dbPort = process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined;

export const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DB_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined
    })
  : new Pool({
      host: process.env.DB_HOST ?? "localhost",
      port: dbPort,
      user: process.env.DB_USER ?? "postgres",
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME ?? "cotizapp",
      ssl:
        process.env.DB_SSL === "true"
          ? { rejectUnauthorized: false }
          : undefined
    });


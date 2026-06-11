import crypto from "node:crypto";
import { inspect, promisify } from "node:util";
import { pool } from "../config/database.js";

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

async function main() {
  const nombre = process.env.ADMIN_NAME ?? "Administrador";
  const email = process.env.ADMIN_EMAIL ?? "admin@cotizapp.local";
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  const rol = "Admin";

  const passwordHash = await hashPassword(password);

  await pool.query(
    `
      insert into usuarios (nombre, email, password_hash, rol)
      values ($1, $2, $3, $4)
      on conflict (email)
      do update set
        nombre = excluded.nombre,
        password_hash = excluded.password_hash,
        rol = excluded.rol
    `,
    [nombre, email, passwordHash, rol]
  );

  process.stdout.write(`Seed OK: usuario admin listo (${email})\n`);
  await pool.end();
}

main().catch(async (error) => {
  const message =
    error instanceof Error
      ? `${error.name}: ${error.message || "(sin mensaje)"}\n${error.stack ?? ""}`
      : inspect(error, { depth: 6, colors: false });
  process.stderr.write(`Seed ERROR:\n${message}\n`);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});


import crypto from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import { authConfig } from "../config/auth.js";
import { getUserByEmail } from "../models/user.model.js";
import type { AuthUser } from "../types/auth.js";
import type { UserRole } from "../types/index.js";

const scryptAsync = promisify(crypto.scrypt);

type LockState = {
  failedAttempts: number;
  lockUntilMs: number;
};

const lockByEmail = new Map<string, LockState>();

function nowMs() {
  return Date.now();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isRole(value: string): value is UserRole {
  return value === "Admin" || value === "Vendedor" || value === "Gerente";
}

async function verifyPassword(password: string, passwordHash: string) {
  const parts = passwordHash.split(":");
  if (parts.length !== 3 || parts[0] !== "scrypt") {
    return false;
  }

  const salt = Buffer.from(parts[1] ?? "", "hex");
  const expected = Buffer.from(parts[2] ?? "", "hex");
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer;

  if (derived.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(derived, expected);
}

function getLockState(email: string) {
  const current = lockByEmail.get(email);
  if (!current) {
    return null;
  }
  if (current.lockUntilMs > nowMs()) {
    return current;
  }
  lockByEmail.delete(email);
  return null;
}

function registerFailedAttempt(email: string) {
  const current = lockByEmail.get(email) ?? {
    failedAttempts: 0,
    lockUntilMs: 0
  };

  const failedAttempts = current.failedAttempts + 1;
  const shouldLock = failedAttempts >= authConfig.maxFailedAttempts;
  const lockUntilMs = shouldLock ? nowMs() + authConfig.lockMinutes * 60_000 : 0;

  lockByEmail.set(email, { failedAttempts, lockUntilMs });

  return {
    locked: shouldLock,
    lockUntilMs
  };
}

function clearLock(email: string) {
  lockByEmail.delete(email);
}

export type LoginResult =
  | {
      ok: true;
      token: string;
      user: AuthUser;
    }
  | {
      ok: false;
      reason: "invalid_credentials" | "locked";
      lockUntilMs?: number;
    };

export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const email = normalizeEmail(input.email);

  const lock = getLockState(email);
  if (lock) {
    return { ok: false, reason: "locked", lockUntilMs: lock.lockUntilMs };
  }

  const dbUser = await getUserByEmail(email);
  if (!dbUser) {
    registerFailedAttempt(email);
    return { ok: false, reason: "invalid_credentials" };
  }

  const role = isRole(dbUser.rol) ? dbUser.rol : "Vendedor";

  const passwordOk = await verifyPassword(input.password, dbUser.password_hash);
  if (!passwordOk) {
    const { locked, lockUntilMs } = registerFailedAttempt(email);
    if (locked) {
      return { ok: false, reason: "locked", lockUntilMs };
    }
    return { ok: false, reason: "invalid_credentials" };
  }

  clearLock(email);

  const user: AuthUser = {
    id: Number(dbUser.id),
    nombre: dbUser.nombre,
    email: dbUser.email,
    rol: role
  };
  if (!Number.isFinite(user.id)) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const token = jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      nombre: user.nombre,
      rol: user.rol
    },
    authConfig.jwtSecret,
    {
      expiresIn: authConfig.jwtExpiresIn
    }
  );

  return { ok: true, token, user };
}

export type JwtAuthPayload = {
  sub: string;
  email: string;
  nombre: string;
  rol: UserRole;
};

export function verifyAccessToken(token: string) {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, authConfig.jwtSecret);
  } catch {
    return null;
  }
  if (typeof decoded !== "object" || decoded === null) {
    return null;
  }

  const payload = decoded as Partial<JwtAuthPayload>;
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.nombre !== "string" ||
    typeof payload.rol !== "string" ||
    !isRole(payload.rol)
  ) {
    return null;
  }

  const user: AuthUser = {
    id: Number(payload.sub),
    email: payload.email,
    nombre: payload.nombre,
    rol: payload.rol
  };

  if (!Number.isFinite(user.id)) {
    return null;
  }

  return user;
}

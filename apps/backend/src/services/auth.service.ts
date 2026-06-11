import crypto from "node:crypto";
import { promisify } from "node:util";
import jwt from "jsonwebtoken";
import { authConfig } from "../config/auth.js";
import { getUserByEmail, setUserLockState } from "../models/user.model.js";
import type { AuthUser } from "../types/auth.js";
import type { UserRole } from "../types/index.js";
import { isRole } from "../utils/access.js";

const scryptAsync = promisify(crypto.scrypt);

function nowMs() {
  return Date.now();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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

function getLockUntilMs(lockUntil: string | null) {
  if (!lockUntil) {
    return null;
  }
  const ts = new Date(lockUntil).getTime();
  return Number.isFinite(ts) ? ts : null;
}

async function registerFailedAttempt(input: {
  userId: number;
  currentFailedAttempts: number;
  currentLockLevel: number;
}) {
  const failedAttempts = input.currentFailedAttempts + 1;
  if (failedAttempts < authConfig.maxFailedAttempts) {
    await setUserLockState(input.userId, {
      failedLoginAttempts: failedAttempts,
      lockUntil: null,
      lockLevel: input.currentLockLevel
    });
    return { locked: false as const };
  }

  const nextLockLevel = input.currentLockLevel + 1;
  const lockMinutes =
    authConfig.lockMinutes + Math.max(0, nextLockLevel - 1) * authConfig.lockIncrementMinutes;
  const lockUntilMs = nowMs() + lockMinutes * 60_000;
  await setUserLockState(input.userId, {
    failedLoginAttempts: 0,
    lockUntil: new Date(lockUntilMs).toISOString(),
    lockLevel: nextLockLevel
  });
  return {
    locked: true as const,
    lockUntilMs
  };
}

async function clearLock(userId: number) {
  await setUserLockState(userId, {
    failedLoginAttempts: 0,
    lockUntil: null,
    lockLevel: 0
  });
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

  const dbUser = await getUserByEmail(email);
  if (!dbUser) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const userId = Number(dbUser.id);
  if (!Number.isFinite(userId)) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const lockUntilMs = getLockUntilMs(dbUser.lock_until);
  if (lockUntilMs && lockUntilMs > nowMs()) {
    return { ok: false, reason: "locked", lockUntilMs };
  }

  if (!dbUser.activo || dbUser.empresa_activa === false) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const role = isRole(dbUser.rol) ? dbUser.rol : "Vendedor";

  const passwordOk = await verifyPassword(input.password, dbUser.password_hash);
  if (!passwordOk) {
    const { locked, lockUntilMs } = await registerFailedAttempt({
      userId,
      currentFailedAttempts: dbUser.failed_login_attempts,
      currentLockLevel: dbUser.lock_level
    });
    if (locked) {
      return { ok: false, reason: "locked", lockUntilMs };
    }
    return { ok: false, reason: "invalid_credentials" };
  }

  await clearLock(userId);

  const user: AuthUser = {
    id: userId,
    empresaId: dbUser.id_empresa === null ? null : Number(dbUser.id_empresa),
    empresaNombre: dbUser.empresa_nombre,
    nombre: dbUser.nombre,
    email: dbUser.email,
    rol: role
  };
  if (!Number.isFinite(user.id) || (user.empresaId !== null && !Number.isFinite(user.empresaId))) {
    return { ok: false, reason: "invalid_credentials" };
  }

  const token = jwt.sign(
    {
      sub: String(user.id),
      empresaId: user.empresaId,
      empresaNombre: user.empresaNombre,
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
  empresaId?: number | null;
  empresaNombre?: string | null;
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
    empresaId:
      payload.empresaId === null || payload.empresaId === undefined
        ? null
        : Number(payload.empresaId),
    empresaNombre: typeof payload.empresaNombre === "string" ? payload.empresaNombre : null,
    email: payload.email,
    nombre: payload.nombre,
    rol: payload.rol
  };

  if (!Number.isFinite(user.id) || (user.empresaId !== null && !Number.isFinite(user.empresaId))) {
    return null;
  }

  return user;
}

import type { SignOptions } from "jsonwebtoken";

export const authConfig = {
  jwtSecret: process.env.JWT_SECRET ?? "dev_secret_change_me",
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? "8h") as SignOptions["expiresIn"],
  maxFailedAttempts: Number(process.env.AUTH_MAX_FAILED_ATTEMPTS ?? 3),
  lockMinutes: Number(process.env.AUTH_LOCK_MINUTES ?? 5),
  lockIncrementMinutes: Number(process.env.AUTH_LOCK_INCREMENT_MINUTES ?? 5)
} as const;

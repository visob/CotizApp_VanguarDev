import type { AuthUser } from "../types/auth.js";
import type { UserRole } from "../types/index.js";

export function isRole(value: string): value is UserRole {
  return value === "SuperAdmin" || value === "Admin" || value === "Vendedor";
}

export function isSuperAdmin(user: AuthUser | undefined | null) {
  return user?.rol === "SuperAdmin";
}

export function canManageUsers(user: AuthUser | undefined | null) {
  return user?.rol === "SuperAdmin" || user?.rol === "Admin";
}

export function canAssignRole(actor: AuthUser, targetRole: UserRole) {
  if (actor.rol === "SuperAdmin") {
    return true;
  }
  if (actor.rol === "Admin") {
    return targetRole === "Admin" || targetRole === "Vendedor";
  }
  return false;
}

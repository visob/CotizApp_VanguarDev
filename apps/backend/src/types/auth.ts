import type { UserRole } from "./index.js";

export type AuthUser = {
  id: number;
  nombre: string;
  email: string;
  rol: UserRole;
};

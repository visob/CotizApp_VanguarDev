export type UserRole = "SuperAdmin" | "Admin" | "Vendedor";

export type CurrencyCode = "ARS" | "USD";

export interface User {
  id: number;
  empresaId: number | null;
  empresaNombre: string | null;
  nombre: string;
  email: string;
  rol: UserRole;
}

export interface Company {
  id: number;
  nombre: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ManagedUser {
  id: number;
  id_empresa: number | null;
  empresa_nombre: string | null;
  nombre: string;
  email: string;
  rol: UserRole;
  activo: boolean;
  failed_login_attempts: number;
  lock_until: string | null;
  lock_level: number;
}

export interface Client {
  id: number;
  nombre_empresa: string;
  contacto_principal?: string | null;
  cuit_tax_id?: string | null;
  clasificacion?: string | null;
  email?: string | null;
  telefono?: string | null;
  direccion?: string | null;
  codigo_postal?: string | null;
  pais?: string | null;
  provincia?: string | null;
  estado: string;
  ult_contacto?: string | null;
}

export interface Product {
  id: number;
  nombre: string;
  precio_ars: string;
  precio_usd: string;
  stock: number;
  sku?: string | null;
  descripcion?: string | null;
  estado?: string;
  garantia?: string | null;
}


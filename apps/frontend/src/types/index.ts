export type UserRole = "Admin" | "Vendedor" | "Gerente";

export type CurrencyCode = "ARS" | "USD";

export interface User {
  id: number;
  nombre: string;
  email: string;
  rol: UserRole;
}

export interface Client {
  id: number;
  nombre_empresa: string;
  contacto_principal?: string | null;
  cuit_tax_id?: string | null;
  clasificacion?: string | null;
}

export interface Product {
  id: number;
  nombre: string;
  precio_ars: string;
  precio_usd: string;
  stock: number;
}


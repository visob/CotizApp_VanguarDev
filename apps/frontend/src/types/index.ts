export type UserRole = "SuperAdmin" | "Admin" | "Vendedor";

export type CurrencyCode = "ARS" | "USD";
export type CatalogOptionType = "forma_pago" | "lugar_entrega" | "tipo_iva" | "tipo_cliente" | "tipo_producto";

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
  logo_url?: string | null;
  cuit?: string | null;
  razon_social?: string | null;
  direccion?: string | null;
  provincia?: string | null;
  codigo_postal?: string | null;
  pais?: string | null;
  telefono_contacto?: string | null;
  email?: string | null;
  website_url?: string | null;
  footer_text?: string | null;
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

export interface CatalogOption {
  id: number;
  id_empresa: number;
  tipo: CatalogOptionType;
  label: string;
  value: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
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

export interface ClientContact {
  id: number;
  id_empresa: number;
  id_cliente: number;
  id_usuario: number;
  fecha_carga: string;
  fecha_contacto: string;
  observacion?: string | null;
  usuario_nombre: string;
}

export interface DashboardNote {
  id: number;
  id_usuario: number;
  text: string;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: number;
  nombre: string;
  tipo_producto: string;
  precio_ars: string;
  precio_usd: string;
  sku?: string | null;
  descripcion?: string | null;
  estado?: string;
  garantia?: string | null;
}


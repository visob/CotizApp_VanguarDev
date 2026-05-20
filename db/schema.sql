BEGIN;

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  nombre_empresa TEXT NOT NULL,
  contacto_principal TEXT,
  cuit_tax_id TEXT,
  clasificacion TEXT
);

CREATE TABLE IF NOT EXISTS productos (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  precio_ars NUMERIC(12, 2) NOT NULL,
  precio_usd NUMERIC(12, 2) NOT NULL,
  stock INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cotizaciones (
  id BIGSERIAL PRIMARY KEY,
  id_cliente BIGINT NOT NULL REFERENCES clientes(id),
  id_usuario BIGINT NOT NULL REFERENCES usuarios(id),
  fecha_emision TIMESTAMPTZ NOT NULL,
  fecha_vencimiento TIMESTAMPTZ,
  moneda CHAR(3) NOT NULL CHECK (moneda IN ('ARS', 'USD')),
  tipo_cambio NUMERIC(18, 6) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  iva_porcentaje NUMERIC(5, 2) NOT NULL,
  descuento_global NUMERIC(12, 2) NOT NULL,
  total_final NUMERIC(12, 2) NOT NULL,
  estado TEXT NOT NULL,
  notas TEXT,
  plazo_entrega TEXT,
  forma_pago TEXT,
  lugar_entrega TEXT,
  mantenimiento_oferta TEXT,
  proxima_alerta TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS items_cotizacion (
  id BIGSERIAL PRIMARY KEY,
  id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario_momento NUMERIC(12, 2) NOT NULL,
  descuento_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS seguimiento (
  id BIGSERIAL PRIMARY KEY,
  id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  fecha_accion TIMESTAMPTZ NOT NULL,
  tipo_accion TEXT NOT NULL,
  observaciones TEXT,
  fecha_reactivacion_programada TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cotizaciones_id_cliente ON cotizaciones(id_cliente);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_id_usuario ON cotizaciones(id_usuario);
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_id_cotizacion ON items_cotizacion(id_cotizacion);
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_id_producto ON items_cotizacion(id_producto);
CREATE INDEX IF NOT EXISTS idx_seguimiento_id_cotizacion ON seguimiento(id_cotizacion);

CREATE TABLE IF NOT EXISTS configuraciones (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS plazo_entrega TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS forma_pago TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS lugar_entrega TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS mantenimiento_oferta TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS proxima_alerta TIMESTAMPTZ;

ALTER TABLE items_cotizacion ADD COLUMN IF NOT EXISTS descuento_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS pais TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS provincia TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ult_contacto TIMESTAMPTZ;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS garantia TEXT;

COMMIT;

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
  moneda CHAR(3) NOT NULL CHECK (moneda IN ('ARS', 'USD')),
  tipo_cambio NUMERIC(18, 6) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  iva_porcentaje NUMERIC(5, 2) NOT NULL,
  descuento_global NUMERIC(12, 2) NOT NULL,
  total_final NUMERIC(12, 2) NOT NULL,
  estado TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS items_cotizacion (
  id BIGSERIAL PRIMARY KEY,
  id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario_momento NUMERIC(12, 2) NOT NULL
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

COMMIT;


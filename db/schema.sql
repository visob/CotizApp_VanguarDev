BEGIN;

CREATE TABLE IF NOT EXISTS empresas (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usuarios (
  id BIGSERIAL PRIMARY KEY,
  id_empresa BIGINT REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  lock_until TIMESTAMPTZ,
  lock_level INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS clientes (
  id BIGSERIAL PRIMARY KEY,
  id_empresa BIGINT REFERENCES empresas(id),
  nombre_empresa TEXT NOT NULL,
  contacto_principal TEXT,
  cuit_tax_id TEXT,
  clasificacion TEXT
);

CREATE TABLE IF NOT EXISTS productos (
  id BIGSERIAL PRIMARY KEY,
  id_empresa BIGINT REFERENCES empresas(id),
  nombre TEXT NOT NULL,
  precio_ars NUMERIC(12, 2) NOT NULL,
  precio_usd NUMERIC(12, 2) NOT NULL,
  stock INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cotizaciones (
  id BIGSERIAL PRIMARY KEY,
  id_empresa BIGINT REFERENCES empresas(id),
  id_cliente BIGINT NOT NULL REFERENCES clientes(id),
  id_usuario BIGINT NOT NULL REFERENCES usuarios(id),
  fecha_emision TIMESTAMPTZ NOT NULL,
  fecha_vencimiento TIMESTAMPTZ,
  moneda CHAR(3) NOT NULL CHECK (moneda IN ('ARS', 'USD')),
  tipo_cambio NUMERIC(18, 6) NOT NULL,
  subtotal NUMERIC(12, 2) NOT NULL,
  iva_porcentaje NUMERIC(5, 2) NOT NULL,
  descuento_porcentaje_global NUMERIC(5, 2) NOT NULL DEFAULT 0,
  descuento_global NUMERIC(12, 2) NOT NULL,
  total_final NUMERIC(12, 2) NOT NULL,
  estado TEXT NOT NULL,
  notas TEXT,
  plazo_entrega TEXT,
  forma_pago TEXT,
  lugar_entrega TEXT,
  proxima_alerta TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS items_cotizacion (
  id BIGSERIAL PRIMARY KEY,
  id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  id_producto BIGINT NOT NULL REFERENCES productos(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario_momento NUMERIC(12, 2) NOT NULL,
  iva_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 21
);

CREATE TABLE IF NOT EXISTS seguimiento (
  id BIGSERIAL PRIMARY KEY,
  id_cotizacion BIGINT NOT NULL REFERENCES cotizaciones(id) ON DELETE CASCADE,
  fecha_accion TIMESTAMPTZ NOT NULL,
  tipo_accion TEXT NOT NULL,
  observaciones TEXT,
  fecha_reactivacion_programada TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS configuraciones (
  id BIGSERIAL PRIMARY KEY,
  id_empresa BIGINT REFERENCES empresas(id) ON DELETE CASCADE,
  clave TEXT NOT NULL,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS empresa_catalog_options (
  id BIGSERIAL PRIMARY KEY,
  id_empresa BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  label TEXT NOT NULL,
  value TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES empresas(id);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS lock_until TIMESTAMPTZ;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS lock_level INTEGER NOT NULL DEFAULT 0;

ALTER TABLE clientes ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES empresas(id);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS pais TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS provincia TEXT;
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS ult_contacto TIMESTAMPTZ;

ALTER TABLE productos ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES empresas(id);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS garantia TEXT;

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES empresas(id);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS plazo_entrega TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS forma_pago TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS lugar_entrega TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS proxima_alerta TIMESTAMPTZ;
ALTER TABLE cotizaciones DROP COLUMN IF EXISTS mantenimiento_oferta;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS descuento_porcentaje_global NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE items_cotizacion ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 21;
ALTER TABLE items_cotizacion DROP COLUMN IF EXISTS descuento_porcentaje;

ALTER TABLE configuraciones ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE configuraciones ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES empresas(id) ON DELETE CASCADE;

ALTER TABLE empresa_catalog_options ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE empresa_catalog_options ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE empresa_catalog_options ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
DECLARE
  default_empresa_id BIGINT;
BEGIN
  INSERT INTO empresas (nombre)
  SELECT 'Empresa Principal'
  WHERE NOT EXISTS (SELECT 1 FROM empresas);

  SELECT id INTO default_empresa_id
  FROM empresas
  ORDER BY id
  LIMIT 1;

  UPDATE usuarios
  SET rol = 'SuperAdmin'
  WHERE rol = 'Gerente';

  UPDATE usuarios
  SET id_empresa = default_empresa_id
  WHERE id_empresa IS NULL AND rol <> 'SuperAdmin';

  UPDATE clientes
  SET id_empresa = default_empresa_id
  WHERE id_empresa IS NULL;

  UPDATE productos
  SET id_empresa = default_empresa_id
  WHERE id_empresa IS NULL;

  UPDATE cotizaciones c
  SET id_empresa = cl.id_empresa
  FROM clientes cl
  WHERE c.id_empresa IS NULL
    AND cl.id = c.id_cliente;

  UPDATE cotizaciones
  SET id_empresa = default_empresa_id
  WHERE id_empresa IS NULL;

  UPDATE configuraciones
  SET id_empresa = default_empresa_id
  WHERE id_empresa IS NULL;
END $$;

ALTER TABLE clientes ALTER COLUMN id_empresa SET NOT NULL;
ALTER TABLE productos ALTER COLUMN id_empresa SET NOT NULL;
ALTER TABLE cotizaciones ALTER COLUMN id_empresa SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'configuraciones'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'configuraciones_pkey'
  ) THEN
    ALTER TABLE configuraciones DROP CONSTRAINT configuraciones_pkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'configuraciones'
      AND constraint_type = 'PRIMARY KEY'
      AND constraint_name = 'configuraciones_id_pkey'
  ) THEN
    ALTER TABLE configuraciones ADD CONSTRAINT configuraciones_id_pkey PRIMARY KEY (id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_configuraciones_empresa_clave
  ON configuraciones (id_empresa, clave);
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_options_empresa_tipo_label
  ON empresa_catalog_options (id_empresa, tipo, label);

CREATE INDEX IF NOT EXISTS idx_usuarios_id_empresa ON usuarios(id_empresa);
CREATE INDEX IF NOT EXISTS idx_clientes_id_empresa ON clientes(id_empresa);
CREATE INDEX IF NOT EXISTS idx_productos_id_empresa ON productos(id_empresa);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_id_empresa ON cotizaciones(id_empresa);
CREATE INDEX IF NOT EXISTS idx_catalog_options_empresa_tipo_activo
  ON empresa_catalog_options (id_empresa, tipo, activo);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_id_cliente ON cotizaciones(id_cliente);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_id_usuario ON cotizaciones(id_usuario);
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_id_cotizacion ON items_cotizacion(id_cotizacion);
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_id_producto ON items_cotizacion(id_producto);
CREATE INDEX IF NOT EXISTS idx_seguimiento_id_cotizacion ON seguimiento(id_cotizacion);

COMMIT;

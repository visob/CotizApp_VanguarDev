BEGIN;

CREATE TABLE IF NOT EXISTS empresas (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  cuit TEXT,
  razon_social TEXT,
  direccion TEXT,
  provincia TEXT,
  codigo_postal TEXT,
  pais TEXT,
  telefono_contacto TEXT,
  email TEXT,
  website_url TEXT,
  footer_text TEXT,
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
  tipo_producto TEXT NOT NULL DEFAULT 'General',
  precio_ars NUMERIC(12, 2) NOT NULL,
  precio_usd NUMERIC(12, 2) NOT NULL
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
  proxima_alerta TIMESTAMPTZ,
  fecha_reactivacion_1 TIMESTAMPTZ,
  fecha_reactivacion_2 TIMESTAMPTZ,
  fecha_reactivacion_3 TIMESTAMPTZ,
  reactivacion_activa SMALLINT NOT NULL DEFAULT 1
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
  id_usuario BIGINT REFERENCES usuarios(id),
  fecha_accion TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo_accion TEXT NOT NULL,
  observaciones TEXT,
  fecha_reactivacion_programada TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
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

CREATE TABLE IF NOT EXISTS dashboard_user_notes (
  id BIGSERIAL PRIMARY KEY,
  id_usuario BIGINT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cliente_contactos (
  id BIGSERIAL PRIMARY KEY,
  id_empresa BIGINT NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  id_cliente BIGINT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  id_usuario BIGINT NOT NULL REFERENCES usuarios(id),
  fecha_carga TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_contacto TIMESTAMPTZ NOT NULL,
  observacion TEXT
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
ALTER TABLE productos ADD COLUMN IF NOT EXISTS tipo_producto TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'Activo';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS garantia TEXT;
ALTER TABLE productos DROP COLUMN IF EXISTS stock;
UPDATE productos SET tipo_producto = 'General' WHERE tipo_producto IS NULL OR trim(tipo_producto) = '';
ALTER TABLE productos ALTER COLUMN tipo_producto SET DEFAULT 'General';
ALTER TABLE productos ALTER COLUMN tipo_producto SET NOT NULL;

ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES empresas(id);
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha_vencimiento TIMESTAMPTZ;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS notas TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS plazo_entrega TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS forma_pago TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS lugar_entrega TEXT;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS proxima_alerta TIMESTAMPTZ;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha_reactivacion_1 TIMESTAMPTZ;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha_reactivacion_2 TIMESTAMPTZ;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS fecha_reactivacion_3 TIMESTAMPTZ;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS reactivacion_activa SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE cotizaciones DROP COLUMN IF EXISTS mantenimiento_oferta;
ALTER TABLE cotizaciones ADD COLUMN IF NOT EXISTS descuento_porcentaje_global NUMERIC(5, 2) NOT NULL DEFAULT 0;

ALTER TABLE items_cotizacion ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5, 2) NOT NULL DEFAULT 21;
ALTER TABLE items_cotizacion DROP COLUMN IF EXISTS descuento_porcentaje;

ALTER TABLE seguimiento ADD COLUMN IF NOT EXISTS id_usuario BIGINT REFERENCES usuarios(id);
ALTER TABLE seguimiento ALTER COLUMN fecha_accion SET DEFAULT now();
ALTER TABLE seguimiento ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE configuraciones ADD COLUMN IF NOT EXISTS id BIGSERIAL;
ALTER TABLE configuraciones ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES empresas(id) ON DELETE CASCADE;

ALTER TABLE empresa_catalog_options ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE empresa_catalog_options ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE empresa_catalog_options ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cuit TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS razon_social TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS provincia TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS codigo_postal TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS pais TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS telefono_contacto TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS website_url TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS footer_text TEXT;

ALTER TABLE dashboard_user_notes ADD COLUMN IF NOT EXISTS completed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dashboard_user_notes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE dashboard_user_notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE cliente_contactos ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES empresas(id) ON DELETE CASCADE;
ALTER TABLE cliente_contactos ADD COLUMN IF NOT EXISTS fecha_carga TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE cliente_contactos ADD COLUMN IF NOT EXISTS observacion TEXT;

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

  UPDATE cotizaciones
  SET fecha_reactivacion_1 = proxima_alerta
  WHERE fecha_reactivacion_1 IS NULL
    AND proxima_alerta IS NOT NULL;

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

INSERT INTO empresa_catalog_options (id_empresa, tipo, label, value, activo)
SELECT e.id, defaults.tipo, defaults.label, defaults.value, true
FROM empresas e
CROSS JOIN (
  VALUES
    ('tipo_producto', 'General', 'General'),
    ('tipo_cliente', 'Consumidor Final', 'Consumidor Final'),
    ('tipo_cliente', 'Cliente final', 'Cliente final'),
    ('tipo_cliente', 'Distribuidor', 'Distribuidor')
) AS defaults(tipo, label, value)
ON CONFLICT (id_empresa, tipo, label)
DO UPDATE SET
  value = EXCLUDED.value,
  activo = true,
  updated_at = now();

CREATE INDEX IF NOT EXISTS idx_usuarios_id_empresa ON usuarios(id_empresa);
CREATE INDEX IF NOT EXISTS idx_clientes_id_empresa ON clientes(id_empresa);
CREATE INDEX IF NOT EXISTS idx_productos_id_empresa ON productos(id_empresa);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_id_empresa ON cotizaciones(id_empresa);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_reactivacion_1 ON cotizaciones(fecha_reactivacion_1);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_reactivacion_2 ON cotizaciones(fecha_reactivacion_2);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_reactivacion_3 ON cotizaciones(fecha_reactivacion_3);
CREATE INDEX IF NOT EXISTS idx_catalog_options_empresa_tipo_activo
  ON empresa_catalog_options (id_empresa, tipo, activo);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_id_cliente ON cotizaciones(id_cliente);
CREATE INDEX IF NOT EXISTS idx_seguimiento_cotizacion_fecha ON seguimiento(id_cotizacion, fecha_accion);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_id_usuario ON cotizaciones(id_usuario);
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_id_cotizacion ON items_cotizacion(id_cotizacion);
CREATE INDEX IF NOT EXISTS idx_items_cotizacion_id_producto ON items_cotizacion(id_producto);
CREATE INDEX IF NOT EXISTS idx_seguimiento_id_cotizacion ON seguimiento(id_cotizacion);
CREATE INDEX IF NOT EXISTS idx_dashboard_user_notes_id_usuario ON dashboard_user_notes(id_usuario, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cliente_contactos_id_cliente_fecha_contacto ON cliente_contactos(id_cliente, fecha_contacto DESC);
CREATE INDEX IF NOT EXISTS idx_cliente_contactos_id_empresa_fecha_contacto ON cliente_contactos(id_empresa, fecha_contacto DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_empresas_cuit_unique ON empresas(cuit) WHERE cuit IS NOT NULL;

COMMIT;

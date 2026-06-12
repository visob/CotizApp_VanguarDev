import { pool } from "../config/database.js";

export type ClientRow = {
  id: string | number;
  id_empresa?: string | number;
  nombre_empresa: string;
  contacto_principal: string | null;
  cuit_tax_id: string | null;
  clasificacion: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  pais: string | null;
  provincia: string | null;
  estado: string;
  ult_contacto: Date | string | null;
};

export type ClientInput = {
  nombre_empresa: string;
  contacto_principal: string | null;
  cuit_tax_id: string | null;
  clasificacion: string | null;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  pais: string | null;
  provincia: string | null;
  estado: string;
  ult_contacto: Date | string | null;
};

type DuplicateClientResult = "duplicate_nombre_empresa" | "duplicate_cuit_tax_id" | null;

export async function listClients(companyId?: number | null) {
  const values: unknown[] = [];
  const whereSql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `where id_empresa = $${values.length}`;
        })()
      : "";
  const result = await pool.query<ClientRow>(
    `select id, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion, email, telefono, direccion, codigo_postal, pais, provincia, estado, ult_contacto
     from clientes
     ${whereSql}
     order by id desc`,
    values
  );
  return result.rows;
}

export async function getClientById(id: number, companyId?: number | null) {
  const values: unknown[] = [id];
  const companySql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `and id_empresa = $${values.length}`;
        })()
      : "";
  const result = await pool.query<ClientRow>(
    `select id, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion, email, telefono, direccion, codigo_postal, pais, provincia, estado, ult_contacto
     from clientes
     where id = $1
     ${companySql}
     limit 1`,
    values
  );
  return result.rows[0] ?? null;
}

export async function createClient(companyId: number, input: ClientInput) {
  const result = await pool.query<ClientRow>(
    `
      insert into clientes (id_empresa, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion, email, telefono, direccion, codigo_postal, pais, provincia, estado, ult_contacto)
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      returning id, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion, email, telefono, direccion, codigo_postal, pais, provincia, estado, ult_contacto
    `,
    [
      companyId,
      input.nombre_empresa,
      input.contacto_principal,
      input.cuit_tax_id,
      input.clasificacion,
      input.email,
      input.telefono,
      input.direccion,
      input.codigo_postal,
      input.pais,
      input.provincia,
      input.estado,
      input.ult_contacto
    ]
  );
  return result.rows[0];
}

export async function findDuplicateClient(
  companyId: number,
  input: Pick<ClientInput, "nombre_empresa" | "cuit_tax_id">,
  excludeId?: number
): Promise<DuplicateClientResult> {
  const baseValues: unknown[] = [companyId];
  const excludeSql =
    excludeId !== undefined
      ? (() => {
          baseValues.push(excludeId);
          return `and id <> $${baseValues.length}`;
        })()
      : "";

  const nameResult = await pool.query<{ id: string | number }>(
    `
      select id
      from clientes
      where id_empresa = $1
        and lower(trim(nombre_empresa)) = lower(trim($${baseValues.length + 1}))
        ${excludeSql}
      limit 1
    `,
    [...baseValues, input.nombre_empresa]
  );

  if (nameResult.rows[0]) {
    return "duplicate_nombre_empresa";
  }

  if (!input.cuit_tax_id) {
    return null;
  }

  const cuitResult = await pool.query<{ id: string | number }>(
    `
      select id
      from clientes
      where id_empresa = $1
        and cuit_tax_id is not null
        and trim(cuit_tax_id) = trim($${baseValues.length + 1})
        ${excludeSql}
      limit 1
    `,
    [...baseValues, input.cuit_tax_id]
  );

  return cuitResult.rows[0] ? "duplicate_cuit_tax_id" : null;
}

export async function updateClient(id: number, input: ClientInput, companyId?: number | null) {
  const values: unknown[] = [
    id,
    input.nombre_empresa,
    input.contacto_principal,
    input.cuit_tax_id,
    input.clasificacion,
    input.email,
    input.telefono,
    input.direccion,
    input.codigo_postal,
    input.pais,
    input.provincia,
    input.estado,
    input.ult_contacto
  ];
  const companySql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `and id_empresa = $${values.length}`;
        })()
      : "";
  const result = await pool.query<ClientRow>(
    `
      update clientes
      set
        nombre_empresa = $2,
        contacto_principal = $3,
        cuit_tax_id = $4,
        clasificacion = $5,
        email = $6,
        telefono = $7,
        direccion = $8,
        codigo_postal = $9,
        pais = $10,
        provincia = $11,
        estado = $12,
        ult_contacto = $13
      where id = $1
      ${companySql}
      returning id, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion, email, telefono, direccion, codigo_postal, pais, provincia, estado, ult_contacto
    `,
    values
  );
  return result.rows[0] ?? null;
}

export async function deleteClient(id: number, companyId?: number | null) {
  const values: unknown[] = [id];
  const companySql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `and id_empresa = $${values.length}`;
        })()
      : "";
  const result = await pool.query<{ id: string | number }>(
    `delete from clientes where id = $1 ${companySql} returning id`,
    values
  );
  return (result.rows[0]?.id ?? null) !== null;
}

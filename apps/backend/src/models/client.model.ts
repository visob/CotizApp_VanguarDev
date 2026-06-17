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

export type ClientContactRow = {
  id: string | number;
  id_empresa: string | number;
  id_cliente: string | number;
  id_usuario: string | number;
  fecha_carga: Date | string;
  fecha_contacto: Date | string;
  observacion: string | null;
  usuario_nombre: string;
};

export type ClientQuoteSummaryRow = {
  id: string | number;
  id_cliente: string | number;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  moneda: string;
  total_final: string;
  estado: string;
  proxima_alerta: string | null;
  reactivacion_activa: number | null;
  fecha_reactivacion_1: string | null;
  fecha_reactivacion_2: string | null;
  fecha_reactivacion_3: string | null;
};

type DuplicateClientResult = "duplicate_nombre_empresa" | "duplicate_cuit_tax_id" | null;

function activeReactivationSql(alias: string) {
  return `
    coalesce(
      case ${alias}.reactivacion_activa
        when 1 then ${alias}.fecha_reactivacion_1
        when 2 then ${alias}.fecha_reactivacion_2
        when 3 then ${alias}.fecha_reactivacion_3
        else null
      end,
      ${alias}.proxima_alerta,
      (
        select min(s.fecha_reactivacion_programada)
        from seguimiento s
        where s.id_cotizacion = ${alias}.id and s.fecha_reactivacion_programada is not null
      )
    )
  `;
}

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

export async function listClientContacts(clientId: number, companyId?: number | null) {
  const values: unknown[] = [clientId];
  const companySql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `and cc.id_empresa = $${values.length}`;
        })()
      : "";

  const result = await pool.query<ClientContactRow>(
    `
      select
        cc.id,
        cc.id_empresa,
        cc.id_cliente,
        cc.id_usuario,
        cc.fecha_carga,
        cc.fecha_contacto,
        cc.observacion,
        u.nombre as usuario_nombre
      from cliente_contactos cc
      join usuarios u on u.id = cc.id_usuario
      where cc.id_cliente = $1
        ${companySql}
      order by cc.fecha_contacto desc, cc.id desc
    `,
    values
  );

  return result.rows;
}

export async function listClientQuotes(clientId: number, companyId?: number | null) {
  const values: unknown[] = [clientId];
  const companySql =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `and c.id_empresa = $${values.length}`;
        })()
      : "";

  const result = await pool.query<ClientQuoteSummaryRow>(
    `
      select
        c.id,
        c.id_cliente,
        c.fecha_emision,
        c.fecha_vencimiento,
        c.moneda,
        c.total_final,
        c.estado,
        ${activeReactivationSql("c")} as proxima_alerta,
        c.reactivacion_activa,
        c.fecha_reactivacion_1,
        c.fecha_reactivacion_2,
        c.fecha_reactivacion_3
      from cotizaciones c
      where c.id_cliente = $1
        ${companySql}
      order by c.fecha_emision desc, c.id desc
    `,
    values
  );

  return result.rows;
}

export async function listClientReactivations(clientId: number, companyId?: number | null) {
  const values: unknown[] = [clientId];
  const where = [
    `c.id_cliente = $1`,
    `c.estado not in ('CERRADA_GANADA', 'CERRADA_PERDIDA')`,
    `${activeReactivationSql("c")} is not null`
  ];

  if (companyId !== undefined && companyId !== null) {
    values.push(companyId);
    where.push(`c.id_empresa = $${values.length}`);
  }

  const result = await pool.query<ClientQuoteSummaryRow>(
    `
      select
        c.id,
        c.id_cliente,
        c.fecha_emision,
        c.fecha_vencimiento,
        c.moneda,
        c.total_final,
        c.estado,
        ${activeReactivationSql("c")} as proxima_alerta,
        c.reactivacion_activa,
        c.fecha_reactivacion_1,
        c.fecha_reactivacion_2,
        c.fecha_reactivacion_3
      from cotizaciones c
      where ${where.join(" and ")}
      order by ${activeReactivationSql("c")} asc, c.id desc
    `,
    values
  );

  return result.rows;
}

export async function createClientContact(input: {
  companyId: number;
  clientId: number;
  userId: number;
  fechaContacto: string;
  observacion: string | null;
}) {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const clientResult = await client.query<{ id: string | number }>(
      `
        select id
        from clientes
        where id = $1 and id_empresa = $2
        limit 1
      `,
      [input.clientId, input.companyId]
    );

    if (!clientResult.rows[0]) {
      await client.query("rollback");
      return null;
    }

    const insertResult = await client.query<ClientContactRow>(
      `
        insert into cliente_contactos (id_empresa, id_cliente, id_usuario, fecha_contacto, observacion)
        values ($1, $2, $3, $4::timestamptz, $5)
        returning
          id,
          id_empresa,
          id_cliente,
          id_usuario,
          fecha_carga,
          fecha_contacto,
          observacion,
          (select nombre from usuarios where id = $3) as usuario_nombre
      `,
      [input.companyId, input.clientId, input.userId, input.fechaContacto, input.observacion]
    );

    await client.query(
      `
        update clientes
        set ult_contacto = case
          when ult_contacto is null or ult_contacto < $3::timestamptz then $3::timestamptz
          else ult_contacto
        end
        where id = $1 and id_empresa = $2
      `,
      [input.clientId, input.companyId, input.fechaContacto]
    );

    await client.query("commit");
    return insertResult.rows[0];
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

import { pool } from "../config/database.js";

export type ClientRow = {
  id: string | number;
  nombre_empresa: string;
  contacto_principal: string | null;
  cuit_tax_id: string | null;
  clasificacion: string | null;
};

export async function listClients() {
  const result = await pool.query<ClientRow>(
    "select id, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion from clientes order by id desc"
  );
  return result.rows;
}

export async function getClientById(id: number) {
  const result = await pool.query<ClientRow>(
    "select id, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion from clientes where id = $1 limit 1",
    [id]
  );
  return result.rows[0] ?? null;
}

export async function createClient(input: Omit<ClientRow, "id">) {
  const result = await pool.query<ClientRow>(
    `
      insert into clientes (nombre_empresa, contacto_principal, cuit_tax_id, clasificacion)
      values ($1, $2, $3, $4)
      returning id, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion
    `,
    [input.nombre_empresa, input.contacto_principal, input.cuit_tax_id, input.clasificacion]
  );
  return result.rows[0];
}

export async function updateClient(id: number, input: Omit<ClientRow, "id">) {
  const result = await pool.query<ClientRow>(
    `
      update clientes
      set
        nombre_empresa = $2,
        contacto_principal = $3,
        cuit_tax_id = $4,
        clasificacion = $5
      where id = $1
      returning id, nombre_empresa, contacto_principal, cuit_tax_id, clasificacion
    `,
    [id, input.nombre_empresa, input.contacto_principal, input.cuit_tax_id, input.clasificacion]
  );
  return result.rows[0] ?? null;
}

export async function deleteClient(id: number) {
  const result = await pool.query<{ id: string | number }>(
    "delete from clientes where id = $1 returning id",
    [id]
  );
  return (result.rows[0]?.id ?? null) !== null;
}

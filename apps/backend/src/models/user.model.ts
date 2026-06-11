import { pool } from "../config/database.js";

export type DbUser = {
  id: string | number;
  id_empresa: string | number | null;
  empresa_nombre: string | null;
  empresa_activa: boolean | null;
  nombre: string;
  email: string;
  password_hash: string;
  rol: string;
  activo: boolean;
  failed_login_attempts: number;
  lock_until: string | null;
  lock_level: number;
};

export async function getUserByEmail(email: string) {
  const result = await pool.query<DbUser>(
    `
      select
        u.id,
        u.id_empresa,
        e.nombre as empresa_nombre,
        e.activo as empresa_activa,
        u.nombre,
        u.email,
        u.password_hash,
        u.rol,
        u.activo,
        u.failed_login_attempts,
        u.lock_until,
        u.lock_level
      from usuarios u
      left join empresas e on e.id = u.id_empresa
      where lower(u.email) = lower($1)
      limit 1
    `,
    [email]
  );
  return result.rows[0] ?? null;
}

export type UserRow = Omit<DbUser, "password_hash" | "empresa_activa">;

export async function listUsers(input?: { companyId?: number | null; includeInactive?: boolean }) {
  const values: unknown[] = [];
  const where: string[] = [];

  if (input?.companyId !== undefined && input.companyId !== null) {
    values.push(input.companyId);
    where.push(`u.id_empresa = $${values.length}`);
  }

  if (!input?.includeInactive) {
    where.push("u.activo = true");
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const result = await pool.query<UserRow>(
    `
      select
        u.id,
        u.id_empresa,
        e.nombre as empresa_nombre,
        u.nombre,
        u.email,
        u.rol,
        u.activo,
        u.failed_login_attempts,
        u.lock_until,
        u.lock_level
      from usuarios u
      left join empresas e on e.id = u.id_empresa
      ${whereSql}
      order by u.id desc
    `,
    values
  );
  return result.rows;
}

export async function getUserById(id: number, companyId?: number | null) {
  const values: unknown[] = [id];
  let companySql = "";
  if (companyId !== undefined && companyId !== null) {
    values.push(companyId);
    companySql = `and u.id_empresa = $${values.length}`;
  }

  const result = await pool.query<UserRow>(
    `
      select
        u.id,
        u.id_empresa,
        e.nombre as empresa_nombre,
        u.nombre,
        u.email,
        u.rol,
        u.activo,
        u.failed_login_attempts,
        u.lock_until,
        u.lock_level
      from usuarios u
      left join empresas e on e.id = u.id_empresa
      where u.id = $1
      ${companySql}
      limit 1
    `,
    values
  );
  return result.rows[0] ?? null;
}

export async function createUser(input: {
  empresaId: number | null;
  nombre: string;
  email: string;
  passwordHash: string;
  rol: string;
  activo?: boolean;
}) {
  const result = await pool.query<UserRow>(
    `
      insert into usuarios (id_empresa, nombre, email, password_hash, rol, activo, failed_login_attempts, lock_until, lock_level)
      values ($1, $2, lower($3), $4, $5, $6, 0, null, 0)
      returning
        id,
        id_empresa,
        (select e.nombre from empresas e where e.id = usuarios.id_empresa) as empresa_nombre,
        nombre,
        email,
        rol,
        activo,
        failed_login_attempts,
        lock_until,
        lock_level
    `,
    [input.empresaId, input.nombre, input.email, input.passwordHash, input.rol, input.activo ?? true]
  );
  return result.rows[0];
}

export async function updateUser(
  id: number,
  input: {
    empresaId?: number | null;
    nombre?: string;
    email?: string;
    passwordHash?: string;
    rol?: string;
    activo?: boolean;
    failedLoginAttempts?: number;
    lockUntil?: string | null;
    lockLevel?: number;
  },
  companyId?: number | null
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (input.empresaId !== undefined) {
    updates.push(`id_empresa = $${idx++}`);
    values.push(input.empresaId);
  }
  if (input.nombre !== undefined) {
    updates.push(`nombre = $${idx++}`);
    values.push(input.nombre);
  }
  if (input.email !== undefined) {
    updates.push(`email = lower($${idx++})`);
    values.push(input.email);
  }
  if (input.passwordHash !== undefined) {
    updates.push(`password_hash = $${idx++}`);
    values.push(input.passwordHash);
  }
  if (input.rol !== undefined) {
    updates.push(`rol = $${idx++}`);
    values.push(input.rol);
  }
  if (input.activo !== undefined) {
    updates.push(`activo = $${idx++}`);
    values.push(input.activo);
  }
  if (input.failedLoginAttempts !== undefined) {
    updates.push(`failed_login_attempts = $${idx++}`);
    values.push(input.failedLoginAttempts);
  }
  if (input.lockUntil !== undefined) {
    updates.push(`lock_until = $${idx++}`);
    values.push(input.lockUntil);
  }
  if (input.lockLevel !== undefined) {
    updates.push(`lock_level = $${idx++}`);
    values.push(input.lockLevel);
  }

  if (updates.length === 0) {
    return getUserById(id, companyId);
  }

  values.push(id);
  let whereSql = `where id = $${idx++}`;
  if (companyId !== undefined && companyId !== null) {
    values.push(companyId);
    whereSql += ` and id_empresa = $${idx++}`;
  }

  const result = await pool.query<UserRow>(
    `
      update usuarios
      set ${updates.join(", ")}
      ${whereSql}
      returning
        id,
        id_empresa,
        (select e.nombre from empresas e where e.id = usuarios.id_empresa) as empresa_nombre,
        nombre,
        email,
        rol,
        activo,
        failed_login_attempts,
        lock_until,
        lock_level
    `,
    values
  );
  return result.rows[0] ?? null;
}

export async function deactivateUser(id: number, companyId?: number | null) {
  const values: unknown[] = [id];
  let whereSql = "where id = $1";
  if (companyId !== undefined && companyId !== null) {
    values.push(companyId);
    whereSql += ` and id_empresa = $${values.length}`;
  }

  const result = await pool.query<{ id: string | number }>(
    `update usuarios set activo = false ${whereSql} returning id`,
    values
  );
  return (result.rows[0]?.id ?? null) !== null;
}

export async function setUserLockState(
  id: number,
  input: { failedLoginAttempts: number; lockUntil: string | null; lockLevel: number },
  companyId?: number | null
) {
  return updateUser(
    id,
    {
      failedLoginAttempts: input.failedLoginAttempts,
      lockUntil: input.lockUntil,
      lockLevel: input.lockLevel
    },
    companyId
  );
}

export async function unlockUser(id: number, companyId?: number | null) {
  const item = await updateUser(
    id,
    {
      failedLoginAttempts: 0,
      lockUntil: null,
      lockLevel: 0
    },
    companyId
  );
  return item;
}

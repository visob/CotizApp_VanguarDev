import { pool } from "../config/database.js";

export type QuoteRow = {
  id: string | number;
  id_cliente: string | number;
  id_usuario: string | number;
  fecha_emision: string;
  fecha_vencimiento?: string | null;
  moneda: string;
  tipo_cambio: string;
  subtotal: string;
  iva_porcentaje: string;
  descuento_porcentaje_global?: string;
  descuento_global: string;
  total_final: string;
  estado: string;
  notas?: string | null;
  plazo_entrega?: string | null;
  forma_pago?: string | null;
  lugar_entrega?: string | null;
  proxima_alerta?: string | null;
  fecha_reactivacion_1?: string | null;
  fecha_reactivacion_2?: string | null;
  fecha_reactivacion_3?: string | null;
  reactivacion_activa?: number;
};

export type QuoteItemRow = {
  id: string | number;
  id_cotizacion: string | number;
  id_producto: string | number;
  cantidad: number;
  precio_unitario_momento: string;
  iva_porcentaje?: string;
  producto_nombre: string;
};

export type QuoteListRow = {
  id: string | number;
  fecha_emision: string;
  moneda: string;
  total_final: string;
  estado: string;
  cliente_nombre_empresa: string;
  cliente_clasificacion: string | null;
  proxima_alerta: string | null;
  reactivacion_activa?: number;
  fecha_reactivacion_1?: string | null;
  fecha_reactivacion_2?: string | null;
  fecha_reactivacion_3?: string | null;
};

export type QuoteReactivationAlertRow = QuoteListRow & {
  id_cliente: string | number;
  id_usuario: string | number;
  fecha_reactivacion_activa: string;
};

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

export type QuoteTrackingRow = {
  id: string | number;
  id_cotizacion: string | number;
  id_usuario: string | number | null;
  fecha_accion: string;
  tipo_accion: string;
  observaciones: string | null;
  fecha_reactivacion_programada: string | null;
  metadata: unknown;
  usuario_nombre: string | null;
  usuario_email: string | null;
};

export async function listQuotes(input?: {
  companyId?: number | null;
  q?: string;
  estado?: string;
  from?: string;
  to?: string;
}) {
  const where: string[] = [];
  const values: unknown[] = [];

  if (input?.companyId !== undefined && input.companyId !== null) {
    values.push(input.companyId);
    where.push(`c.id_empresa = $${values.length}`);
  }

  if (input?.estado) {
    values.push(input.estado);
    where.push(`c.estado = $${values.length}`);
  }

  if (input?.from) {
    values.push(input.from);
    where.push(`c.fecha_emision >= $${values.length}::timestamptz`);
  }

  if (input?.to) {
    values.push(input.to);
    where.push(`c.fecha_emision <= $${values.length}::timestamptz`);
  }

  if (input?.q) {
    values.push(`%${input.q}%`);
    const idx = values.length;
    where.push(`(cl.nombre_empresa ilike $${idx} or cast(c.id as text) ilike $${idx})`);
  }

  const whereSql = where.length ? `where ${where.join(" and ")}` : "";

  const result = await pool.query<QuoteListRow>(
    `
      select
        c.id,
        c.fecha_emision,
        c.moneda,
        c.total_final,
        c.estado,
        cl.nombre_empresa as cliente_nombre_empresa,
        cl.clasificacion as cliente_clasificacion,
        ${activeReactivationSql("c")} as proxima_alerta,
        c.reactivacion_activa,
        c.fecha_reactivacion_1,
        c.fecha_reactivacion_2,
        c.fecha_reactivacion_3
      from cotizaciones c
      join clientes cl on cl.id = c.id_cliente
      ${whereSql}
      order by c.id desc
    `,
    values
  );
  return result.rows;
}

export async function getQuoteById(id: number, companyId?: number | null) {
  const values: unknown[] = [id];
  let companySql = "";
  if (companyId !== undefined && companyId !== null) {
    values.push(companyId);
    companySql = `and id_empresa = $${values.length}`;
  }
  const result = await pool.query<QuoteRow>(
    `
      select c.id, c.id_cliente, c.id_usuario, c.fecha_emision, c.fecha_vencimiento, c.moneda, c.tipo_cambio, c.subtotal, c.iva_porcentaje,
             c.descuento_porcentaje_global, c.descuento_global, c.total_final, c.estado, c.notas, c.plazo_entrega, c.forma_pago, c.lugar_entrega,
             ${activeReactivationSql("c")} as proxima_alerta,
             c.fecha_reactivacion_1, c.fecha_reactivacion_2, c.fecha_reactivacion_3, c.reactivacion_activa
      from cotizaciones c
      where c.id = $1
      ${companySql}
      limit 1
    `,
    values
  );
  return result.rows[0] ?? null;
}

export async function listReactivationAlerts(companyId?: number | null) {
  const values: unknown[] = [];
  const where: string[] = [
    `c.estado not in ('CERRADA_GANADA', 'CERRADA_PERDIDA')`,
    `${activeReactivationSql("c")} is not null`,
    `${activeReactivationSql("c")} <= now()`
  ];

  if (companyId !== undefined && companyId !== null) {
    values.push(companyId);
    where.push(`c.id_empresa = $${values.length}`);
  }

  const result = await pool.query<QuoteReactivationAlertRow>(
    `
      select
        c.id,
        c.id_cliente,
        c.id_usuario,
        c.fecha_emision,
        c.moneda,
        c.total_final,
        c.estado,
        cl.nombre_empresa as cliente_nombre_empresa,
        cl.clasificacion as cliente_clasificacion,
        ${activeReactivationSql("c")} as proxima_alerta,
        ${activeReactivationSql("c")} as fecha_reactivacion_activa,
        c.reactivacion_activa,
        c.fecha_reactivacion_1,
        c.fecha_reactivacion_2,
        c.fecha_reactivacion_3
      from cotizaciones c
      join clientes cl on cl.id = c.id_cliente
      where ${where.join(" and ")}
      order by ${activeReactivationSql("c")} asc, c.id desc
    `,
    values
  );
  return result.rows;
}

export async function listQuoteItems(quoteId: number, companyId?: number | null) {
  const values: unknown[] = [quoteId];
  const companyJoin =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `join cotizaciones c on c.id = i.id_cotizacion and c.id_empresa = $${values.length}`;
        })()
      : "join cotizaciones c on c.id = i.id_cotizacion";
  const result = await pool.query<QuoteItemRow>(
    `
      select i.id, i.id_cotizacion, i.id_producto, i.cantidad, i.precio_unitario_momento,
             i.iva_porcentaje,
             p.nombre as producto_nombre
      from items_cotizacion i
      ${companyJoin}
      join productos p on p.id = i.id_producto
      where i.id_cotizacion = $1
      order by i.id asc
    `,
    values
  );
  return result.rows;
}

export async function listQuoteTrackingEvents(quoteId: number, companyId?: number | null) {
  const values: unknown[] = [quoteId];
  const companyJoin =
    companyId !== undefined && companyId !== null
      ? (() => {
          values.push(companyId);
          return `join cotizaciones c on c.id = s.id_cotizacion and c.id_empresa = $${values.length}`;
        })()
      : "join cotizaciones c on c.id = s.id_cotizacion";

  const result = await pool.query<QuoteTrackingRow>(
    `
      select
        s.id,
        s.id_cotizacion,
        s.id_usuario,
        s.fecha_accion,
        s.tipo_accion,
        s.observaciones,
        s.fecha_reactivacion_programada,
        s.metadata,
        u.nombre as usuario_nombre,
        u.email as usuario_email
      from seguimiento s
      ${companyJoin}
      left join usuarios u on u.id = s.id_usuario
      where s.id_cotizacion = $1
      order by s.fecha_accion desc, s.id desc
    `,
    values
  );
  return result.rows;
}

export async function addQuoteTrackingEvent(input: {
  quoteId: number;
  userId: number | null;
  actionType: string;
  actionAtIso?: string | null;
  note: string | null;
  scheduledAtIso?: string | null;
  metadata?: unknown;
}) {
  const result = await pool.query<{ id: string | number }>(
    `
      insert into seguimiento
        (id_cotizacion, id_usuario, fecha_accion, tipo_accion, observaciones, fecha_reactivacion_programada, metadata)
      values
        ($1, $2, coalesce($3::timestamptz, now()), $4, $5, $6, $7::jsonb)
      returning id
    `,
    [
      input.quoteId,
      input.userId,
      input.actionAtIso ?? null,
      input.actionType,
      input.note,
      input.scheduledAtIso ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
  return Number(result.rows[0]?.id);
}

export type CreateQuoteInput = {
  idEmpresa: number;
  idCliente: number;
  idUsuario: number;
  fechaEmisionIso: string;
  fechaVencimientoIso: string | null;
  moneda: "ARS" | "USD";
  tipoCambio: string;
  subtotal: string;
  ivaPorcentaje: string;
  descuentoPorcentajeGlobal: string;
  descuentoGlobal: string;
  totalFinal: string;
  estado: string;
  notas: string | null;
  plazoEntrega: string | null;
  formaPago: string | null;
  lugarEntrega: string | null;
  proximaAlertaIso: string | null;
  fechaReactivacion1Iso?: string | null;
  fechaReactivacion2Iso?: string | null;
  fechaReactivacion3Iso?: string | null;
  reactivacionActiva?: 1 | 2 | 3;
  items: Array<{
    idProducto: number;
    cantidad: number;
    precioUnitarioMomento: string;
    ivaPorcentaje: string;
  }>;
};

export async function createQuoteTransactional(input: CreateQuoteInput) {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const quoteResult = await client.query<{ id: string | number }>(
      `
        insert into cotizaciones
          (id_empresa, id_cliente, id_usuario, fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva_porcentaje, descuento_porcentaje_global, descuento_global, total_final, estado,
           notas, plazo_entrega, forma_pago, lugar_entrega, proxima_alerta, fecha_reactivacion_1, fecha_reactivacion_2, fecha_reactivacion_3, reactivacion_activa)
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        returning id
      `,
      [
        input.idEmpresa,
        input.idCliente,
        input.idUsuario,
        input.fechaEmisionIso,
        input.fechaVencimientoIso,
        input.moneda,
        input.tipoCambio,
        input.subtotal,
        input.ivaPorcentaje,
        input.descuentoPorcentajeGlobal,
        input.descuentoGlobal,
        input.totalFinal,
        input.estado,
        input.notas,
        input.plazoEntrega,
        input.formaPago,
        input.lugarEntrega,
        input.proximaAlertaIso,
        input.fechaReactivacion1Iso ?? null,
        input.fechaReactivacion2Iso ?? null,
        input.fechaReactivacion3Iso ?? null,
        input.reactivacionActiva ?? 1
      ]
    );

    const quoteId = Number(quoteResult.rows[0]?.id);
    if (!Number.isFinite(quoteId)) {
      throw new Error("quote_insert_failed");
    }

    for (const item of input.items) {
      await client.query(
        `
          insert into items_cotizacion (id_cotizacion, id_producto, cantidad, precio_unitario_momento, iva_porcentaje)
          values ($1, $2, $3, $4, $5)
        `,
        [
          quoteId,
          item.idProducto,
          item.cantidad,
          item.precioUnitarioMomento,
          item.ivaPorcentaje
        ]
      );
    }

    await client.query("commit");
    return quoteId;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function updateQuote(
  id: number,
  data: {
    estado?: string;
    proxima_alerta?: string | null;
    fecha_reactivacion_1?: string | null;
    fecha_reactivacion_2?: string | null;
    fecha_reactivacion_3?: string | null;
    reactivacion_activa?: number;
  },
  companyId?: number | null
) {
  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (data.estado !== undefined) {
    updates.push(`estado = $${idx++}`);
    values.push(data.estado);
  }

  if (data.proxima_alerta !== undefined) {
    updates.push(`proxima_alerta = $${idx++}`);
    values.push(data.proxima_alerta);
  }

  if (data.fecha_reactivacion_1 !== undefined) {
    updates.push(`fecha_reactivacion_1 = $${idx++}`);
    values.push(data.fecha_reactivacion_1);
  }

  if (data.fecha_reactivacion_2 !== undefined) {
    updates.push(`fecha_reactivacion_2 = $${idx++}`);
    values.push(data.fecha_reactivacion_2);
  }

  if (data.fecha_reactivacion_3 !== undefined) {
    updates.push(`fecha_reactivacion_3 = $${idx++}`);
    values.push(data.fecha_reactivacion_3);
  }

  if (data.reactivacion_activa !== undefined) {
    updates.push(`reactivacion_activa = $${idx++}`);
    values.push(data.reactivacion_activa);
  }

  if (updates.length === 0) return true;

  values.push(id);
  let whereSql = `where id = $${idx++}`;
  if (companyId !== undefined && companyId !== null) {
    values.push(companyId);
    whereSql += ` and id_empresa = $${idx++}`;
  }
  const result = await pool.query(`update cotizaciones set ${updates.join(", ")} ${whereSql}`, values);

  return result.rowCount ? result.rowCount > 0 : false;
}

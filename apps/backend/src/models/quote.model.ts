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
  descuento_global: string;
  total_final: string;
  estado: string;
  notas?: string | null;
  plazo_entrega?: string | null;
  forma_pago?: string | null;
  lugar_entrega?: string | null;
  mantenimiento_oferta?: string | null;
  proxima_alerta?: string | null;
};

export type QuoteItemRow = {
  id: string | number;
  id_cotizacion: string | number;
  id_producto: string | number;
  cantidad: number;
  precio_unitario_momento: string;
  descuento_porcentaje?: string;
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
        coalesce(
          c.proxima_alerta,
          (
            select min(s.fecha_reactivacion_programada)
            from seguimiento s
            where s.id_cotizacion = c.id and s.fecha_reactivacion_programada is not null
          )
        ) as proxima_alerta
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
      select id, id_cliente, id_usuario, fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva_porcentaje,
             descuento_global, total_final, estado, notas, plazo_entrega, forma_pago, lugar_entrega, mantenimiento_oferta, proxima_alerta
      from cotizaciones
      where id = $1
      ${companySql}
      limit 1
    `,
    values
  );
  return result.rows[0] ?? null;
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
      select i.id, i.id_cotizacion, i.id_producto, i.cantidad, i.precio_unitario_momento, i.descuento_porcentaje,
             i.iva_porcentaje,
             p.nombre as producto_nombre
      from items_cotizacion i
      ${companyJoin}
      join productos p on p.id = i.id_producto
      where i.id_cotizacion = $1
      order by i.id asc
    `,
    [quoteId]
  );
  return result.rows;
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
  descuentoGlobal: string;
  totalFinal: string;
  estado: string;
  notas: string | null;
  plazoEntrega: string | null;
  formaPago: string | null;
  lugarEntrega: string | null;
  mantenimientoOferta: string | null;
  proximaAlertaIso: string | null;
  items: Array<{
    idProducto: number;
    cantidad: number;
    precioUnitarioMomento: string;
    descuentoPorcentaje: string;
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
          (id_empresa, id_cliente, id_usuario, fecha_emision, fecha_vencimiento, moneda, tipo_cambio, subtotal, iva_porcentaje, descuento_global, total_final, estado,
           notas, plazo_entrega, forma_pago, lugar_entrega, mantenimiento_oferta, proxima_alerta)
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
        input.descuentoGlobal,
        input.totalFinal,
        input.estado,
        input.notas,
        input.plazoEntrega,
        input.formaPago,
        input.lugarEntrega,
        input.mantenimientoOferta,
        input.proximaAlertaIso
      ]
    );

    const quoteId = Number(quoteResult.rows[0]?.id);
    if (!Number.isFinite(quoteId)) {
      throw new Error("quote_insert_failed");
    }

    for (const item of input.items) {
      await client.query(
        `
          insert into items_cotizacion (id_cotizacion, id_producto, cantidad, precio_unitario_momento, descuento_porcentaje, iva_porcentaje)
          values ($1, $2, $3, $4, $5, $6)
        `,
        [
          quoteId,
          item.idProducto,
          item.cantidad,
          item.precioUnitarioMomento,
          item.descuentoPorcentaje,
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
  data: { estado?: string; proxima_alerta?: string | null },
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

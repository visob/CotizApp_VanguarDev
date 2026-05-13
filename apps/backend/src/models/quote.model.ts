import { pool } from "../config/database.js";

export type QuoteRow = {
  id: string | number;
  id_cliente: string | number;
  id_usuario: string | number;
  fecha_emision: string;
  moneda: string;
  tipo_cambio: string;
  subtotal: string;
  iva_porcentaje: string;
  descuento_global: string;
  total_final: string;
  estado: string;
};

export type QuoteItemRow = {
  id: string | number;
  id_cotizacion: string | number;
  id_producto: string | number;
  cantidad: number;
  precio_unitario_momento: string;
  producto_nombre: string;
};

export async function listQuotes() {
  const result = await pool.query<QuoteRow>(
    `
      select id, id_cliente, id_usuario, fecha_emision, moneda, tipo_cambio, subtotal, iva_porcentaje,
             descuento_global, total_final, estado
      from cotizaciones
      order by id desc
    `
  );
  return result.rows;
}

export async function getQuoteById(id: number) {
  const result = await pool.query<QuoteRow>(
    `
      select id, id_cliente, id_usuario, fecha_emision, moneda, tipo_cambio, subtotal, iva_porcentaje,
             descuento_global, total_final, estado
      from cotizaciones
      where id = $1
      limit 1
    `,
    [id]
  );
  return result.rows[0] ?? null;
}

export async function listQuoteItems(quoteId: number) {
  const result = await pool.query<QuoteItemRow>(
    `
      select i.id, i.id_cotizacion, i.id_producto, i.cantidad, i.precio_unitario_momento,
             p.nombre as producto_nombre
      from items_cotizacion i
      join productos p on p.id = i.id_producto
      where i.id_cotizacion = $1
      order by i.id asc
    `,
    [quoteId]
  );
  return result.rows;
}

export type CreateQuoteInput = {
  idCliente: number;
  idUsuario: number;
  fechaEmisionIso: string;
  moneda: "ARS" | "USD";
  tipoCambio: string;
  subtotal: string;
  ivaPorcentaje: string;
  descuentoGlobal: string;
  totalFinal: string;
  estado: string;
  items: Array<{
    idProducto: number;
    cantidad: number;
    precioUnitarioMomento: string;
  }>;
};

export async function createQuoteTransactional(input: CreateQuoteInput) {
  const client = await pool.connect();
  try {
    await client.query("begin");

    const quoteResult = await client.query<{ id: string | number }>(
      `
        insert into cotizaciones
          (id_cliente, id_usuario, fecha_emision, moneda, tipo_cambio, subtotal, iva_porcentaje, descuento_global, total_final, estado)
        values
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        returning id
      `,
      [
        input.idCliente,
        input.idUsuario,
        input.fechaEmisionIso,
        input.moneda,
        input.tipoCambio,
        input.subtotal,
        input.ivaPorcentaje,
        input.descuentoGlobal,
        input.totalFinal,
        input.estado
      ]
    );

    const quoteId = Number(quoteResult.rows[0]?.id);
    if (!Number.isFinite(quoteId)) {
      throw new Error("quote_insert_failed");
    }

    for (const item of input.items) {
      await client.query(
        `
          insert into items_cotizacion (id_cotizacion, id_producto, cantidad, precio_unitario_momento)
          values ($1, $2, $3, $4)
        `,
        [quoteId, item.idProducto, item.cantidad, item.precioUnitarioMomento]
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

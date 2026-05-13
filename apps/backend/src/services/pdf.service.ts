import PDFDocument from "pdfkit";
import { pool } from "../config/database.js";
import {
  calcIvaCents,
  centsToMoneyString,
  parseMoneyToCents,
  parsePercentToBasisPoints
} from "./quote.service.js";

type PdfRow = {
  id: string | number;
  fecha_emision: string;
  moneda: string;
  tipo_cambio: string;
  subtotal: string;
  iva_porcentaje: string;
  descuento_global: string;
  total_final: string;
  estado: string;
  cliente_nombre_empresa: string;
  cliente_contacto_principal: string | null;
  cliente_cuit_tax_id: string | null;
  usuario_nombre: string;
  usuario_email: string;
  item_cantidad: number;
  item_precio_unitario_momento: string;
  item_descuento_porcentaje: string;
  producto_nombre: string;
};

export async function generateQuotePdfBuffer(quoteId: number) {
  const result = await pool.query<PdfRow>(
    `
      select
        c.id,
        c.fecha_emision,
        c.moneda,
        c.tipo_cambio,
        c.subtotal,
        c.iva_porcentaje,
        c.descuento_global,
        c.total_final,
        c.estado,
        cl.nombre_empresa as cliente_nombre_empresa,
        cl.contacto_principal as cliente_contacto_principal,
        cl.cuit_tax_id as cliente_cuit_tax_id,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        i.cantidad as item_cantidad,
        i.precio_unitario_momento as item_precio_unitario_momento,
        i.descuento_porcentaje as item_descuento_porcentaje,
        p.nombre as producto_nombre
      from cotizaciones c
      join clientes cl on cl.id = c.id_cliente
      join usuarios u on u.id = c.id_usuario
      join items_cotizacion i on i.id_cotizacion = c.id
      join productos p on p.id = i.id_producto
      where c.id = $1
      order by i.id asc
    `,
    [quoteId]
  );

  const rows = result.rows;
  if (rows.length === 0) {
    throw new Error("quote_not_found");
  }

  const header = rows[0]!;
  const subtotalCents = parseMoneyToCents(header.subtotal) ?? 0n;
  const ivaBp = parsePercentToBasisPoints(header.iva_porcentaje) ?? 0n;
  const ivaCents = calcIvaCents(subtotalCents, ivaBp);
  const descuentoCents = parseMoneyToCents(header.descuento_global) ?? 0n;
  const totalFinalCents = parseMoneyToCents(header.total_final) ?? 0n;

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer | Uint8Array) =>
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  );

  const endPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fontSize(18).text("Cotización", { align: "left" });
  doc.moveDown(0.5);

  doc.fontSize(10);
  doc.text(`N°: ${header.id}`);
  doc.text(`Fecha: ${new Date(header.fecha_emision).toLocaleString("es-AR")}`);
  doc.text(`Moneda: ${header.moneda}`);
  doc.text(`Tipo de cambio: ${header.tipo_cambio}`);
  doc.text(`Estado: ${header.estado}`);
  doc.moveDown(0.7);

  doc.fontSize(12).text("Cliente", { underline: true });
  doc.fontSize(10);
  doc.text(header.cliente_nombre_empresa);
  if (header.cliente_contacto_principal) doc.text(`Contacto: ${header.cliente_contacto_principal}`);
  if (header.cliente_cuit_tax_id) doc.text(`CUIT: ${header.cliente_cuit_tax_id}`);
  doc.moveDown(0.7);

  doc.fontSize(12).text("Vendedor", { underline: true });
  doc.fontSize(10).text(`${header.usuario_nombre} (${header.usuario_email})`);
  doc.moveDown(0.8);

  const startX = doc.x;
  const tableTop = doc.y;

  const colDesc = startX;
  const colQty = startX + 270;
  const colUnit = startX + 330;
  const colTotal = startX + 430;

  doc.fontSize(10).text("Descripción", colDesc, tableTop);
  doc.text("Cant.", colQty, tableTop);
  doc.text("Unit.", colUnit, tableTop);
  doc.text("Total", colTotal, tableTop);
  doc.moveTo(startX, tableTop + 14).lineTo(startX + 500, tableTop + 14).strokeColor("#cccccc").stroke();

  let y = tableTop + 22;
  doc.fillColor("#111111");

  for (const r of rows) {
    const unitCents = parseMoneyToCents(r.item_precio_unitario_momento) ?? 0n;
    const grossLineCents = unitCents * BigInt(r.item_cantidad);
    const discountBp = parsePercentToBasisPoints(r.item_descuento_porcentaje) ?? 0n;
    const discountCentsLine = (grossLineCents * discountBp + 5000n) / 10000n;
    const lineTotalCents = grossLineCents > discountCentsLine ? grossLineCents - discountCentsLine : 0n;
    const lineTotal = centsToMoneyString(lineTotalCents);
    const desc =
      r.item_descuento_porcentaje && r.item_descuento_porcentaje !== "0" && r.item_descuento_porcentaje !== "0.00"
        ? `${r.producto_nombre} (Dto ${r.item_descuento_porcentaje}%)`
        : r.producto_nombre;
    doc.fontSize(10).text(desc, colDesc, y, { width: 250 });
    doc.text(String(r.item_cantidad), colQty, y);
    doc.text(centsToMoneyString(unitCents), colUnit, y);
    doc.text(lineTotal, colTotal, y);
    y += 18;
    if (y > 720) {
      doc.addPage();
      y = doc.y;
    }
  }

  doc.moveDown(2);
  doc.moveTo(startX, doc.y).lineTo(startX + 500, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(0.7);

  const summaryX = startX + 300;
  doc.fontSize(10);
  doc.text(`Subtotal: ${centsToMoneyString(subtotalCents)} ${header.moneda}`, summaryX);
  doc.text(
    `IVA (${header.iva_porcentaje}%): ${centsToMoneyString(ivaCents)} ${header.moneda}`,
    summaryX
  );
  doc.text(`Descuento: ${centsToMoneyString(descuentoCents)} ${header.moneda}`, summaryX);
  doc.fontSize(12).text(`Total: ${centsToMoneyString(totalFinalCents)} ${header.moneda}`, summaryX);

  doc.end();
  return endPromise;
}

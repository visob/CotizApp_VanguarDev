import PDFDocument from "pdfkit";
import { pool } from "../config/database.js";
import { centsToMoneyString, parseMoneyToCents } from "./quote.service.js";

type PdfRow = {
  id: string | number;
  fecha_emision: string;
  moneda: string;
  tipo_cambio: string;
  subtotal: string;
  iva_porcentaje: string;
  descuento_porcentaje_global: string;
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
        c.descuento_porcentaje_global,
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
  const descuentoCents = parseMoneyToCents(header.descuento_global) ?? 0n;
  const totalFinalCents = parseMoneyToCents(header.total_final) ?? 0n;
  const ivaCents = totalFinalCents > subtotalCents ? totalFinalCents - subtotalCents : 0n;

  const doc = new PDFDocument({ size: "A4", margin: 48 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk: Buffer | Uint8Array) =>
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  );

  const endPromise = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Font sizes and colors
  const primaryColor = "#000000";
  const secondaryColor = "#444444";
  const bgColor = "#f9f9f9"; // the light beige background from the image
  
  // Actually, we can't easily change the whole page background without drawing a huge rect, 
  // but let's just stick to white page, it's safer for printing. The image has an off-white background,
  // we'll use white for the PDF paper.
  
  const startX = 48;
  const contentWidth = 500;

  // 1. Header: "COTIZACIÓN"
  doc.font("Helvetica-Bold").fontSize(36).fillColor(primaryColor).text("COTIZACIÓN", startX, 60);

  // Pill: N°
  const pillY = 100;
  doc.roundedRect(startX, pillY, 120, 24, 12).strokeColor(primaryColor).lineWidth(1.5).stroke();
  doc.font("Helvetica-Bold").fontSize(12).fillColor(primaryColor).text(`Nº: ${header.id}`, startX + 16, pillY + 6);

  // 2. Client Info Box
  const boxY = 150;
  doc.roundedRect(startX, boxY, contentWidth, 90, 12).strokeColor(primaryColor).lineWidth(1).stroke();
  
  // Left Side: Client Data
  doc.font("Helvetica-Bold").fontSize(10).fillColor(primaryColor).text("DATOS DEL CLIENTE", startX + 20, boxY + 16);
  doc.font("Helvetica").fillColor(secondaryColor);
  let textY = boxY + 36;
  doc.text(header.cliente_nombre_empresa, startX + 20, textY); textY += 14;
  if (header.cliente_contacto_principal) { doc.text(header.cliente_contacto_principal, startX + 20, textY); textY += 14; }
  if (header.cliente_cuit_tax_id) { doc.text(`CUIT: ${header.cliente_cuit_tax_id}`, startX + 20, textY); textY += 14; }

  // 3. Table Header (Black Pill)
  let tableY = 270;
  doc.roundedRect(startX, tableY, contentWidth, 30, 15).fillColor(primaryColor).fill();
  
  const colDesc = startX + 20;
  const colQty = startX + 250;
  const colUnit = startX + 330;
  const colTotal = startX + 410;

  doc.font("Helvetica-Bold").fontSize(10).fillColor("#ffffff");
  doc.text("Detalle", colDesc, tableY + 9);
  doc.text("Cantidad", colQty, tableY + 9);
  doc.text("Precio", colUnit, tableY + 9);
  doc.text("Total", colTotal, tableY + 9);

  // 4. Table Rows
  let y = tableY + 45;
  doc.font("Helvetica").fillColor(secondaryColor);

  for (const r of rows) {
    const unitCents = parseMoneyToCents(r.item_precio_unitario_momento) ?? 0n;
    const grossLineCents = unitCents * BigInt(r.item_cantidad);
    const lineTotal = centsToMoneyString(grossLineCents);
    const desc = r.producto_nombre;
    
    doc.text(desc, colDesc, y, { width: 200 });
    // Since item_cantidad might be a number, make sure it aligns well
    doc.text(String(r.item_cantidad).padStart(2, "0"), colQty, y);
    doc.text(`${centsToMoneyString(unitCents)} ${header.moneda}`, colUnit, y);
    doc.text(`${lineTotal} ${header.moneda}`, colTotal, y);
    
    y += 24; // Row spacing
    if (y > 720) {
      doc.addPage();
      y = doc.y;
    }
  }

  // 5. Horizontal Line below rows
  doc.moveTo(startX, y).lineTo(startX + contentWidth, y).strokeColor(primaryColor).lineWidth(1).stroke();
  
  // 6. Totals Section
  y += 20;
  
  // Subtotal (if needed, but the image just has IVA and TOTAL. Let's add subtotal, iva, descuento for clarity).
  doc.font("Helvetica").fontSize(11).fillColor(primaryColor);
  
  if (descuentoCents > 0) {
    doc.text("Descuento", colUnit, y);
    doc.text(`- ${centsToMoneyString(descuentoCents)}`, colTotal, y);
    y += 20;
  }
  
  doc.text("Subtotal", colUnit, y);
  doc.text(centsToMoneyString(subtotalCents), colTotal, y);
  y += 20;

  if (ivaCents > 0) {
    doc.text(`IVA`, colUnit, y);
    doc.text(`${header.iva_porcentaje}%`, colUnit + 40, y); // Small adjustment to align percentage
    doc.text(centsToMoneyString(ivaCents), colTotal, y);
    y += 20;
  }

  // Final Total (Black Pill)
  y += 10;
  const totalBoxWidth = 200;
  const totalBoxX = startX + contentWidth - totalBoxWidth;
  doc.roundedRect(totalBoxX, y, totalBoxWidth, 32, 16).fillColor(primaryColor).fill();
  
  doc.font("Helvetica-Bold").fontSize(12).fillColor("#ffffff");
  doc.text("TOTAL", totalBoxX + 20, y + 10);
  doc.text(`${centsToMoneyString(totalFinalCents)} ${header.moneda}`, totalBoxX + 110, y + 10);

  doc.end();
  return endPromise;
}

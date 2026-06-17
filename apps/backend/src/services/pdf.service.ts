import PDFDocument from "pdfkit";
import { pool } from "../config/database.js";
import { centsToMoneyString, parseMoneyToCents } from "./quote.service.js";

type PdfRow = {
  id: string | number;
  fecha_emision: string;
  fecha_vencimiento: string | null;
  moneda: string;
  tipo_cambio: string;
  subtotal: string;
  iva_porcentaje: string;
  descuento_porcentaje_global: string;
  descuento_global: string;
  total_final: string;
  estado: string;
  notas: string | null;
  forma_pago: string | null;
  plazo_entrega: string | null;
  lugar_entrega: string | null;
  cliente_nombre_empresa: string;
  cliente_contacto_principal: string | null;
  cliente_cuit_tax_id: string | null;
  usuario_nombre: string;
  usuario_email: string;
  item_cantidad: number;
  item_precio_unitario_momento: string;
  producto_nombre: string;
};

function formatIsoDateUtc(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  );
}

export async function generateQuotePdfBuffer(quoteId: number) {
  const result = await pool.query<PdfRow>(
    `
      select
        c.id,
        c.fecha_emision,
        c.fecha_vencimiento,
        c.moneda,
        c.tipo_cambio,
        c.subtotal,
        c.iva_porcentaje,
        c.descuento_porcentaje_global,
        c.descuento_global,
        c.total_final,
        c.estado,
        c.notas,
        c.forma_pago,
        c.plazo_entrega,
        c.lugar_entrega,
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

  // Colors and styling
  const primaryColor = "#000000";
  const mutedColor = "#666666";
  const lightLine = "#e0e0e0";
  
  const startX = 48;
  const contentWidth = 500;

  function drawDivider(yPos: number, color = lightLine) {
    doc.moveTo(startX, yPos).lineTo(startX + contentWidth, yPos).lineWidth(1).strokeColor(color).stroke();
  }

  // 1. Header
  const headerY = 48;
  
  // Top Left: Seller Info (Business Name)
  doc.font("Helvetica-Bold").fontSize(12).fillColor(primaryColor).text(header.usuario_nombre, startX, headerY);
  doc.font("Helvetica").fontSize(10).fillColor(mutedColor).text(header.usuario_email, startX, headerY + 14);

  // Top Right: Title and ID
  doc.font("Helvetica-Bold").fontSize(28).fillColor(primaryColor).text("Cotización", startX, headerY, { width: contentWidth, align: "right" });
  doc.fontSize(16).text(`#${String(header.id).padStart(6, '0')}`, startX, headerY + 30, { width: contentWidth, align: "right" });

  let y = headerY + 70;
  drawDivider(y);
  y += 24;

  // 2. Info Grid (3 Columns)
  const col1X = startX;
  const col2X = startX + 160;
  const col3X = startX + 310;

  // Col 1: Cliente
  doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor).text("Cliente:", col1X, y);
  doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
  let cy = y + 14;
  doc.text(header.cliente_nombre_empresa, col1X, cy); cy += 12;
  if (header.cliente_contacto_principal) { doc.text(`Contacto: ${header.cliente_contacto_principal}`, col1X, cy); cy += 12; }
  if (header.cliente_cuit_tax_id) { doc.text(`CUIT: ${header.cliente_cuit_tax_id}`, col1X, cy); cy += 12; }

  // Col 2: Vendedor
  doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor).text("Vendedor:", col2X, y);
  doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
  let vy = y + 14;
  doc.text(header.usuario_nombre, col2X, vy); vy += 12;
  doc.text(header.usuario_email, col2X, vy); vy += 12;

  // Col 3: Quote Details
  doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
  const formatDate = (iso: string) => {
    return formatIsoDateUtc(iso);
  };
  
  let qy = y;
  const detailLabelX = col3X;
  const detailWidth = 190;
  const drawDetail = (label: string, value: string) => {
    doc.fillColor(mutedColor).text(label, detailLabelX, qy);
    doc.fillColor(primaryColor).text(value, detailLabelX, qy, { width: detailWidth, align: "right" });
    qy += 14;
  };

  const mapEstado = (st: string) => {
    if (st === 'PEND_REACTIVACION') return 'Pendiente reactivación';
    if (st === 'BORRADOR') return 'Borrador';
    if (st === 'ENVIADA') return 'Enviada';
    if (st === 'ACEPTADA') return 'Aceptada';
    if (st === 'RECHAZADA') return 'Rechazada';
    return st.charAt(0).toUpperCase() + st.slice(1).toLowerCase().replace(/_/g, ' ');
  };

  drawDetail("Fecha", formatDate(header.fecha_emision));
  drawDetail("Vencimiento", header.fecha_vencimiento ? formatDate(header.fecha_vencimiento) : "-");
  drawDetail("Moneda", "ARS y USD");
  drawDetail("Tasa de cambio", `1 USD = ${Number(header.tipo_cambio).toFixed(6)} ARS`);
  drawDetail("Estado", mapEstado(header.estado));

  y = Math.max(cy, vy, qy) + 16;
  drawDivider(y);
  y += 24;

  // 3. Items Section
  doc.font("Helvetica-Bold").fontSize(10).fillColor(primaryColor).text("Cargos", startX, y);
  y += 16;
  drawDivider(y, "#f0f0f0");
  y += 16;

  for (const r of rows) {
    const unitCents = parseMoneyToCents(r.item_precio_unitario_momento) ?? 0n;
    const grossLineCents = unitCents * BigInt(r.item_cantidad);
    const lineTotal = centsToMoneyString(grossLineCents);
    const desc = r.producto_nombre;
    
    doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
    doc.text(`${desc} (x${r.item_cantidad} @ $${centsToMoneyString(unitCents)})`, startX, y);
    doc.fillColor(primaryColor).text(`$${lineTotal} ${header.moneda}`, startX, y, { width: contentWidth, align: "right" });
    
    y += 16;
    drawDivider(y, "#f0f0f0");
    y += 16;

    if (y > 700) {
      doc.addPage();
      y = doc.y;
    }
  }

  // 4. Totals
  const totalsX = startX + 300;
  const totalsW = contentWidth - 300;
  
  doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
  
  const drawTotalLine = (label: string, val: string, isBold = false) => {
    if (isBold) {
      doc.font("Helvetica-Bold").fillColor(primaryColor);
    } else {
      doc.font("Helvetica").fillColor(mutedColor);
    }
    doc.text(label, totalsX, y);
    doc.text(val, totalsX, y, { width: totalsW, align: "right" });
    y += 16;
  };

  if (descuentoCents > 0) {
    drawTotalLine("Subtotal", `$${centsToMoneyString(subtotalCents)}`);
    drawTotalLine("Descuento", `-$${centsToMoneyString(descuentoCents)}`);
  }
  if (ivaCents > 0) {
    if (descuentoCents === 0n) drawTotalLine("Subtotal", `$${centsToMoneyString(subtotalCents)}`);
    drawTotalLine(`IVA (${header.iva_porcentaje}%)`, `$${centsToMoneyString(ivaCents)}`);
  }

  // Total Final
  drawDivider(y, lightLine);
  y += 16;
  drawTotalLine("Total", `$${centsToMoneyString(totalFinalCents)} ${header.moneda}`, true);

  // Alternate Currency Total
  const tc = Number(header.tipo_cambio) || 1;
  const altCurrency = header.moneda === "USD" ? "ARS" : "USD";
  const amount = Number(totalFinalCents) / 100;
  const altAmount = header.moneda === "USD" ? amount * tc : amount / tc;
  
  // Draw alternate total slightly muted
  doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
  doc.text(`Total en ${altCurrency}`, totalsX, y);
  doc.text(`$${altAmount.toFixed(2)} ${altCurrency}`, totalsX, y, { width: totalsW, align: "right" });
  y += 16;

  // 5. Footer (Delivery & Payment Terms)
  // Positioned fixed near the bottom unless content pushed it down.
  const footerY = Math.max(y + 40, 720);
  
  if (footerY > 750) {
    doc.addPage();
  }

  const actFooterY = doc.y > 720 && footerY > 750 ? doc.y + 40 : footerY;

  drawDivider(actFooterY, lightLine);
  
  // Col 1: Plazo de entrega
  doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor).text("Plazo de entrega:", startX, actFooterY + 16);
  const plazoText = header.plazo_entrega || "-";
  doc.font("Helvetica").fillColor(mutedColor).text(plazoText, startX, actFooterY + 28, { width: 140 });

  // Col 2: Método de pago
  doc.font("Helvetica-Bold").fillColor(primaryColor).text("Método de pago:", startX + 160, actFooterY + 16);
  const pagoText = header.forma_pago || "-";
  doc.font("Helvetica").fillColor(mutedColor).text(pagoText, startX + 160, actFooterY + 28, { width: 160 });

  // Col 3: Lugar de entrega
  doc.font("Helvetica-Bold").fillColor(primaryColor).text("Lugar de entrega:", startX + 340, actFooterY + 16);
  const lugarText = header.lugar_entrega || "-";
  doc.font("Helvetica").fillColor(mutedColor).text(lugarText, startX + 340, actFooterY + 28, { width: 160 });

  doc.end();
  return endPromise;
}

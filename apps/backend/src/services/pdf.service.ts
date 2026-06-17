import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { pool } from "../config/database.js";
import { centsToMoneyString, parseMoneyToCents } from "./quote.service.js";

function getLocalFilePath(publicPath: string | null) {
  if (!publicPath || !publicPath.startsWith("/uploads/")) return null;
  const relativePath = publicPath.replace(/^\/uploads[\\/]/, "");
  return path.resolve(process.cwd(), "uploads", relativePath);
}

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
  cliente_email: string | null;
  cliente_telefono: string | null;
  usuario_nombre: string;
  usuario_email: string;
  item_cantidad: number;
  item_precio_unitario_momento: string;
  producto_id: string | number;
  producto_nombre: string;
  empresa_nombre: string;
  empresa_logo_url: string | null;
  empresa_direccion: string | null;
  empresa_provincia: string | null;
  empresa_pais: string | null;
  empresa_codigo_postal: string | null;
  empresa_email: string | null;
  empresa_telefono_contacto: string | null;
  empresa_website_url: string | null;
  empresa_footer_text: string | null;
};

function formatIsoDateUtc(value: unknown) {
  if (value === null || value === undefined) return "-";
  const str = value instanceof Date ? value.toISOString() : typeof value === "string" ? value : String(value);

  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    return new Intl.DateTimeFormat("es-AR", { timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
  }

  const date = new Date(str);
  if (!Number.isFinite(date.getTime())) return str;

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
        cl.email as cliente_email,
        cl.telefono as cliente_telefono,
        u.nombre as usuario_nombre,
        u.email as usuario_email,
        i.cantidad as item_cantidad,
        i.precio_unitario_momento as item_precio_unitario_momento,
        p.id as producto_id,
        p.nombre as producto_nombre,
        e.nombre as empresa_nombre,
        e.logo_url as empresa_logo_url,
        e.direccion as empresa_direccion,
        e.provincia as empresa_provincia,
        e.pais as empresa_pais,
        e.codigo_postal as empresa_codigo_postal,
        e.email as empresa_email,
        e.telefono_contacto as empresa_telefono_contacto,
        e.website_url as empresa_website_url,
        e.footer_text as empresa_footer_text
      from cotizaciones c
      join clientes cl on cl.id = c.id_cliente
      join usuarios u on u.id = c.id_usuario
      join items_cotizacion i on i.id_cotizacion = c.id
      join productos p on p.id = i.id_producto
      left join empresas e on e.id = c.id_empresa
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
  
  // Top Left: Company Logo or Name
  const localLogoPath = getLocalFilePath(header.empresa_logo_url);
  if (localLogoPath && fs.existsSync(localLogoPath)) {
    try {
      doc.image(localLogoPath, startX, headerY, { fit: [250, 60] });
    } catch {
      doc.font("Helvetica-Bold").fontSize(16).fillColor(primaryColor).text(header.empresa_nombre, startX, headerY);
    }
  } else {
    doc.font("Helvetica-Bold").fontSize(16).fillColor(primaryColor).text(header.empresa_nombre, startX, headerY);
  }

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

  // Facturar a (Client)
  let cy = y;
  doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor).text("Facturar a:", startX, cy);
  doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
  
  let clientY = cy + 14;
  doc.text(header.cliente_nombre_empresa, startX, clientY);
  clientY += 12;
  
  if (header.cliente_cuit_tax_id) {
    doc.text(`CUIT: ${header.cliente_cuit_tax_id}`, startX, clientY);
    clientY += 12;
  }
  if (header.cliente_contacto_principal) {
    doc.text(`Atn: ${header.cliente_contacto_principal}`, startX, clientY);
    clientY += 12;
  }
  if (header.cliente_email) {
    doc.text(header.cliente_email, startX, clientY);
    clientY += 12;
  }
  if (header.cliente_telefono) {
    doc.text(`Tel: ${header.cliente_telefono}`, startX, clientY);
    clientY += 12;
  }

  // Col 2: Vendedor
  doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor).text("Vendedor:", col2X, y);
  doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
  let vy = y + 14;
  doc.text(header.usuario_nombre, col2X, vy); vy += 12;
  doc.text(header.usuario_email, col2X, vy); vy += 12;

  // Col 3: Quote Details
  doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
  const formatDate = (iso: unknown) => formatIsoDateUtc(iso);
  
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

  y = Math.max(clientY, vy, qy) + 16;
  drawDivider(y);
  y += 24;

  // 3. Items Section
  drawDivider(y, "#f0f0f0");
  y += 8;
  
  doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor);
  doc.text("Cant.", startX, y, { width: 40, align: "center" });
  doc.text("Código", startX + 40, y, { width: 60, align: "center" });
  doc.text("Descripción", startX + 100, y, { width: 220, align: "left" });
  doc.text("P. Unitario", startX + 320, y, { width: 80, align: "right" });
  doc.text("Importe", startX + 400, y, { width: 100, align: "right" });

  y += 16;
  drawDivider(y, "#f0f0f0");
  y += 12;

  doc.font("Helvetica").fontSize(9);
  for (const r of rows) {
    const unitCents = parseMoneyToCents(r.item_precio_unitario_momento) ?? 0n;
    const grossLineCents = unitCents * BigInt(r.item_cantidad);
    const lineTotal = centsToMoneyString(grossLineCents);
    const desc = r.producto_nombre;
    const code = String(r.producto_id).padStart(4, "0");
    
    doc.fillColor(mutedColor);
    doc.text(String(r.item_cantidad), startX, y, { width: 40, align: "center" });
    doc.text(code, startX + 40, y, { width: 60, align: "center" });
    doc.text(desc, startX + 100, y, { width: 220, align: "left" });
    doc.text(`$${centsToMoneyString(unitCents)}`, startX + 320, y, { width: 80, align: "right" });
    
    doc.font("Helvetica-Bold").fillColor(primaryColor);
    doc.text(`$${lineTotal}`, startX + 400, y, { width: 100, align: "right" });
    doc.font("Helvetica"); // reset font for next item
    
    y += 20;
    drawDivider(y, "#f0f0f0");
    y += 12;

    if (y > 600) {
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



  // 5. Footer (Delivery & Payment Terms)
  const actFooterY = Math.max(y + 40, 650);

  drawDivider(actFooterY, lightLine);
  
  const colWidth = contentWidth / 3;

  // Col 1: Plazo de entrega
  doc.font("Helvetica-Bold").fontSize(9).fillColor(primaryColor).text("Plazo de entrega:", startX, actFooterY + 16, { width: colWidth, align: "center" });
  const plazoText = header.plazo_entrega || "-";
  doc.font("Helvetica").fillColor(mutedColor).text(plazoText, startX, actFooterY + 28, { width: colWidth, align: "center" });

  // Col 2: Método de pago
  doc.font("Helvetica-Bold").fillColor(primaryColor).text("Método de pago:", startX + colWidth, actFooterY + 16, { width: colWidth, align: "center" });
  const pagoText = header.forma_pago || "-";
  doc.font("Helvetica").fillColor(mutedColor).text(pagoText, startX + colWidth, actFooterY + 28, { width: colWidth, align: "center" });

  // Col 3: Lugar de entrega
  doc.font("Helvetica-Bold").fillColor(primaryColor).text("Lugar de entrega:", startX + colWidth * 2, actFooterY + 16, { width: colWidth, align: "center" });
  const lugarText = header.lugar_entrega || "-";
  doc.font("Helvetica").fillColor(mutedColor).text(lugarText, startX + colWidth * 2, actFooterY + 28, { width: colWidth, align: "center" });

  // Divider below delivery terms
  drawDivider(actFooterY + 50, lightLine);

  // Company Footer details
  const addressY = Math.max(actFooterY + 65, 735);
  const contactY = addressY + 20;
  const footerTextY = contactY + 20;

  const fullAddressParts = [];
  if (header.empresa_direccion) fullAddressParts.push(header.empresa_direccion);
  if (header.empresa_codigo_postal) fullAddressParts.push(header.empresa_codigo_postal);
  if (header.empresa_provincia) fullAddressParts.push(header.empresa_provincia);
  if (header.empresa_pais) fullAddressParts.push(header.empresa_pais);

  if (header.empresa_direccion) {
    doc.font("Helvetica").fontSize(9).fillColor(primaryColor);
    doc.text(fullAddressParts.join(", "), startX, addressY, { width: contentWidth, align: "center" });
  }

  const footerParts = [];
  if (header.empresa_telefono_contacto) footerParts.push(header.empresa_telefono_contacto);
  if (header.empresa_email) footerParts.push(header.empresa_email);
  if (header.empresa_website_url) footerParts.push(header.empresa_website_url);

  if (footerParts.length > 0) {
    doc.font("Helvetica").fontSize(9).fillColor(mutedColor);
    doc.text(footerParts.join("  |  "), startX, contactY, { width: contentWidth, align: "center" });
  }

  if (header.empresa_footer_text) {
    doc.font("Helvetica-Oblique").fontSize(8).fillColor(mutedColor);
    doc.text(header.empresa_footer_text, startX, footerTextY, { width: contentWidth, align: "center" });
  }

  doc.end();
  return endPromise;
}

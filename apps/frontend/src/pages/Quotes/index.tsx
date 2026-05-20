import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/common/Button";
import type { Client, CurrencyCode, Product } from "../../types";
import * as clientService from "../../services/client.service";
import * as productService from "../../services/product.service";
import * as quoteService from "../../services/quote.service";

type QuoteItemDraft = {
  id_producto: string;
  cantidad: string;
  descuento_porcentaje: string;
};

function parseMoneyToCents(value: unknown) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const whole = match[1] ?? "0";
  const frac = (match[2] ?? "").padEnd(2, "0");

  const cents = BigInt(whole) * 100n + BigInt(frac || "0");
  return cents >= 0n ? cents : null;
}

function centsToMoneyString(cents: bigint) {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  return `${sign}${whole.toString()}.${frac.toString().padStart(2, "0")}`;
}

function parsePercentToBasisPoints(value: unknown) {
  const raw = typeof value === "number" ? String(value) : typeof value === "string" ? value : "";
  const normalized = raw.replace(",", ".").trim();
  if (!normalized) return null;

  const match = normalized.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;

  const whole = match[1] ?? "0";
  const frac = (match[2] ?? "").padEnd(2, "0");
  const bp = BigInt(whole) * 100n + BigInt(frac || "0");
  return bp >= 0n ? bp : null;
}

function calcIvaCents(subtotalCents: bigint, ivaBasisPoints: bigint) {
  const numerator = subtotalCents * ivaBasisPoints;
  return (numerator + 5000n) / 10000n;
}

function contains(value: unknown, query: string) {
  if (!query) return true;
  if (typeof value !== "string") return false;
  return value.toLowerCase().includes(query);
}

function parseQty(value: string) {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  return int > 0 ? int : null;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function QuotesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [mode, setMode] = useState<"list" | "new">("list");

  const [quotes, setQuotes] = useState<quoteService.QuoteListItem[]>([]);
  const [tab, setTab] = useState<"todos" | "ultimas" | "reactivar">("todos");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [idCliente, setIdCliente] = useState<string>("");
  const [estado, setEstado] = useState<string>("BORRADOR");
  const [moneda, setMoneda] = useState<CurrencyCode>("ARS");
  const [fechaCotizacion, setFechaCotizacion] = useState<string>(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [fechaVencimiento, setFechaVencimiento] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

  const [items, setItems] = useState<QuoteItemDraft[]>([
    { id_producto: "", cantidad: "1", descuento_porcentaje: "0" }
  ]);

  const [notas, setNotas] = useState("");
  const [plazoEntrega, setPlazoEntrega] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [lugarEntrega, setLugarEntrega] = useState("");
  const [mantenimientoOferta, setMantenimientoOferta] = useState("");

  function toIsoStartOfDay(dateStr: string) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-").map((x) => Number(x));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d, 0, 0, 0, 0);
    return Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
  }

  function toIsoEndOfDay(dateStr: string) {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split("-").map((x) => Number(x));
    if (!y || !m || !d) return null;
    const dt = new Date(y, m - 1, d, 23, 59, 59, 999);
    return Number.isFinite(dt.getTime()) ? dt.toISOString() : null;
  }

  async function reloadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const [c, p] = await Promise.all([clientService.listClients(), productService.listProducts()]);
      setClients(c);
      setProducts(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_error");
    } finally {
      setLoading(false);
    }
  }

  async function reloadQuotes() {
    setLoading(true);
    setError(null);
    try {
      const estadoParam = tab === "reactivar" ? "PEND_REACTIVACION" : undefined;
      const from =
        tab === "ultimas"
          ? (() => {
              const d = new Date();
              d.setDate(d.getDate() - 30);
              return d.toISOString();
            })()
          : toIsoStartOfDay(fromDate) ?? undefined;
      const to = tab === "ultimas" ? undefined : toIsoEndOfDay(toDate) ?? undefined;

      const data = await quoteService.listQuotes({
        q: q.trim() || undefined,
        estado: estadoParam,
        from,
        to
      });
      setQuotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void Promise.all([reloadCatalog(), reloadQuotes()]);
  }, []);

  const ivaBp = useMemo(() => parsePercentToBasisPoints("21") ?? 2100n, []);

  const preview = useMemo(() => {
    const lines = items
      .map((it, idx) => {
        const id = Number(it.id_producto);
        const product = products.find((p) => p.id === id);
        if (!product) {
          return {
            idx,
            productName: "Seleccionar",
            unitCents: 0n,
            qty: null as number | null,
            discountBp: parsePercentToBasisPoints(it.descuento_porcentaje) ?? 0n,
            netLineCents: null as bigint | null
          };
        }

        const qty = parseQty(it.cantidad);
        const unitStr = moneda === "ARS" ? product.precio_ars : product.precio_usd;
        const unitCents = parseMoneyToCents(unitStr) ?? 0n;
        const discountBp = parsePercentToBasisPoints(it.descuento_porcentaje) ?? 0n;

        if (!qty) {
          return {
            idx,
            productName: product.nombre,
            unitCents,
            qty,
            discountBp,
            netLineCents: null
          };
        }

        const gross = unitCents * BigInt(qty);
        const discountLine = (gross * discountBp + 5000n) / 10000n;
        const net = gross > discountLine ? gross - discountLine : 0n;

        return {
          idx,
          productName: product.nombre,
          unitCents,
          qty,
          discountBp,
          netLineCents: net
        };
      })
      .filter(Boolean);

    const subtotalSinImpuestosCents = lines.reduce((acc, l) => acc + (l.netLineCents ?? 0n), 0n);
    const impuestosCents = calcIvaCents(subtotalSinImpuestosCents, ivaBp);
    const subtotalConImpuestosCents = subtotalSinImpuestosCents + impuestosCents;

    return {
      lines,
      subtotalSinImpuestosCents,
      impuestosCents,
      subtotalConImpuestosCents
    };
  }, [items, products, moneda, ivaBp]);

  function resetNewForm() {
    setError(null);
    setInfo(null);
    setIdCliente("");
    setEstado("BORRADOR");
    setMoneda("ARS");
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    setFechaCotizacion(`${yyyy}-${mm}-${dd}`);
    const v = new Date(now);
    v.setDate(v.getDate() + 30);
    const vyyyy = v.getFullYear();
    const vmm = String(v.getMonth() + 1).padStart(2, "0");
    const vdd = String(v.getDate()).padStart(2, "0");
    setFechaVencimiento(`${vyyyy}-${vmm}-${vdd}`);
    setItems([{ id_producto: "", cantidad: "1", descuento_porcentaje: "0" }]);
    setNotas("");
    setPlazoEntrega("");
    setFormaPago("");
    setLugarEntrega("");
    setMantenimientoOferta("");
  }

  function startNew() {
    resetNewForm();
    setMode("new");
  }

  function backToList() {
    setMode("list");
    void reloadQuotes();
  }

  function statusStyle(s: string) {
    const v = s.toUpperCase();
    const className = `statusPill status--${v.toLowerCase()}`;
    if (v === "PEND_REACTIVACION") return { className, label: "Pend. reactivación" };
    if (v === "ENVIADA") return { className, label: "Enviada" };
    if (v === "POSPUESTA") return { className, label: "Pospuesta" };
    if (v === "BORRADOR") return { className, label: "Borrador" };
    if (v === "CERRADA_PERDIDA") return { className, label: "Cerrada perdida" };
    if (v === "CERRADA_GANADA") return { className, label: "Cerrada ganada" };
    if (v === "EMITIDA") return { className, label: "Emitida" };
    return { className: "statusPill", label: s };
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString("es-AR") : iso;
  }

  function formatAlert(iso: string | null) {
    if (!iso) return "-";
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "-";
    const now = new Date();
    const sameDay =
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    return sameDay ? "Hoy" : d.toLocaleDateString("es-AR");
  }

  function downloadCsv() {
    const header = ["Cliente", "ID", "Fecha", "Monto", "Moneda", "TipoCliente", "Estado", "ProxAlerta"].join(",");
    const rows = quotes.map((r) => {
      const values = [
        r.cliente_nombre_empresa,
        `#${r.id}`,
        formatDate(r.fecha_emision),
        r.total_final,
        r.moneda,
        r.cliente_clasificacion ?? "",
        r.estado,
        r.proxima_alerta ?? ""
      ].map((v) => `"${String(v).replaceAll('"', '""')}"`);
      return values.join(",");
    });
    const csv = [header, ...rows].join("\n");
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "cotizaciones.csv");
  }

  function parseNewItemsForPayload() {
    return items
      .map((it) => {
        const id_producto = Number(it.id_producto);
        const cantidad = parseQty(it.cantidad);
        if (!Number.isFinite(id_producto) || id_producto <= 0 || !cantidad) return null;
        const descuentoOk = parsePercentToBasisPoints(it.descuento_porcentaje);
        if (descuentoOk === null) return null;
        return {
          id_producto,
          cantidad,
          descuento_porcentaje: it.descuento_porcentaje.trim() || "0"
        };
      })
      .filter((x): x is { id_producto: number; cantidad: number; descuento_porcentaje: string } => x !== null);
  }

  async function saveDraft() {
    setError(null);
    setInfo(null);

    const idClienteNum = Number(idCliente);
    if (!Number.isFinite(idClienteNum) || idClienteNum <= 0) {
      setError("Seleccioná un cliente válido");
      return;
    }

    setSaving(true);
    try {
      const payloadItems = parseNewItemsForPayload();
      const created = await quoteService.createQuote({
        id_cliente: idClienteNum,
        moneda,
        estado: "BORRADOR",
        fecha_emision: `${fechaCotizacion}T00:00:00.000Z`,
        fecha_vencimiento: `${fechaVencimiento}T00:00:00.000Z`,
        iva_porcentaje: "21",
        descuento_global: "0",
        tipo_cambio: moneda === "ARS" ? "1" : "1",
        notas,
        plazo_entrega: plazoEntrega,
        forma_pago: formaPago,
        lugar_entrega: lugarEntrega,
        mantenimiento_oferta: mantenimientoOferta,
        items: payloadItems
      });
      setInfo(`Borrador #${created.id} guardado`);
      backToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_error");
    } finally {
      setSaving(false);
    }
  }

  async function generateQuote() {
    setError(null);
    setInfo(null);

    const idClienteNum = Number(idCliente);
    if (!Number.isFinite(idClienteNum) || idClienteNum <= 0) {
      setError("Seleccioná un cliente válido");
      return;
    }

    const payloadItems = parseNewItemsForPayload();
    if (payloadItems.length === 0) {
      setError("Agregá al menos un producto con cantidad válida");
      return;
    }

    setSaving(true);
    try {
      const estadoToSend = estado === "BORRADOR" ? "EMITIDA" : estado;
      const created = await quoteService.createQuote({
        id_cliente: idClienteNum,
        moneda,
        estado: estadoToSend,
        fecha_emision: `${fechaCotizacion}T00:00:00.000Z`,
        fecha_vencimiento: `${fechaVencimiento}T00:00:00.000Z`,
        iva_porcentaje: "21",
        descuento_global: "0",
        tipo_cambio: moneda === "ARS" ? "1" : "1",
        notas,
        plazo_entrega: plazoEntrega,
        forma_pago: formaPago,
        lugar_entrega: lugarEntrega,
        mantenimiento_oferta: mantenimientoOferta,
        items: payloadItems
      });

      const pdf = await quoteService.downloadQuotePdf(created.id);
      downloadBlob(pdf.blob, pdf.filename ?? `cotizacion-${created.id}.pdf`);
      setInfo(`Cotización #${created.id} generada y descargada`);
      backToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      {mode === "list" ? (
        <div className="stack">
          <div>
            <div className="pageHeader">
              <div>
                <h1 className="pageTitle">Cotizaciones</h1>
              <div className="pageSubtitle">Creá presupuestos y hacé el seguimiento de tus ventas</div>
            </div>
            <div className="actions">
              <Button disabled={loading} onClick={downloadCsv} className="btn--ghost">
                <span style={{ marginRight: 8 }}>↓</span> Exportar lista
              </Button>
              <Button disabled={loading} onClick={startNew} className="btn--primary">
                + Nueva cotización
              </Button>
            </div>
          </div>

          <div className="pageTabs">
            {[
              { key: "todos", label: "Todos" },
              { key: "ultimas", label: "Últimas generadas" },
              { key: "reactivar", label: "Por reactivar" }
            ].map((t) => {
              const active = tab === (t.key as any);
              return (
                <button
                  key={t.key}
                  onClick={() => {
                    setTab(t.key as any);
                    void reloadQuotes();
                  }}
                  className={`pageTabPill ${active ? "pageTabPill--active" : ""}`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="filterToolbar">
            <input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} className="searchBarInput" />
            <div className="dateRange">
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" />
              <span className="hint">—</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" />
            </div>
            <Button disabled={loading} onClick={() => void reloadQuotes()} className="btn--ghost" style={{ display: "flex", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4H20L14 12V19L10 21V12L4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Filtrar
            </Button>
          </div>
        </div>

          {error ? <div className="error">{error}</div> : null}
          {info ? <div className="success">{info}</div> : null}
          {loading ? <div className="hint">Cargando...</div> : null}

          <div className="tableWrap">
            <table className="table table--min980">
              <thead>
                <tr>
                  <th className="colCheckbox">
                    <input type="checkbox" />
                  </th>
                  <th>Cliente</th>
                  <th>ID</th>
                  <th>Fecha</th>
                  <th>Monto</th>
                  <th>Tipo de cliente</th>
                  <th>Estado</th>
                  <th>Prox. alerta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((r) => {
                  const st = statusStyle(r.estado);
                  return (
                    <tr key={r.id}>
                      <td className="colCheckbox">
                        <input type="checkbox" />
                      </td>
                      <td>{r.cliente_nombre_empresa}</td>
                      <td className="cellMuted">#{r.id}</td>
                      <td className="cellMuted">{formatDate(r.fecha_emision)}</td>
                      <td className="cellMuted">
                        ${r.total_final} {r.moneda}
                      </td>
                      <td className="hint">{r.cliente_clasificacion ?? "-"}</td>
                      <td>
                        <span className={st.className}>{st.label}</span>
                      </td>
                      <td className="cellMuted">{formatAlert(r.proxima_alerta)}</td>
                      <td>
                        <Button
                          onClick={async () => {
                            try {
                              const pdf = await quoteService.downloadQuotePdf(r.id);
                              downloadBlob(pdf.blob, pdf.filename ?? `cotizacion-${r.id}.pdf`);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "download_error");
                            }
                          }}
                          className="btn--icon btn--ghost"
                          title="Descargar PDF"
                        >
                          ⋮
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {quotes.length === 0 && !loading ? (
                  <tr>
                    <td className="cellEmpty" colSpan={9}>
                      No hay cotizaciones para mostrar
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="stack">
          <div className="pageHeader">
            <div>
              <h1 className="pageTitle">Nueva cotización</h1>
              <div className="pageSubtitle">Cotizaciones &gt; Nueva cotización</div>
            </div>
            <Button onClick={backToList} disabled={saving} className="btn--ghost">
              Volver
            </Button>
          </div>

          {error ? <div className="error">{error}</div> : null}
          {info ? <div className="success">{info}</div> : null}

          <div className="sectionTitle">Datos generales</div>
          <div className="divider" />

          <div className="quoteNewGrid">
            <label className="field">
              <span className="label">Cliente</span>
              <select value={idCliente} onChange={(e) => setIdCliente(e.target.value)} className="select">
                <option value="">Seleccionar</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre_empresa}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="label">Estado de cotización</span>
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className="select">
                <option value="BORRADOR">Borrador</option>
                <option value="EMITIDA">Emitida</option>
                <option value="ENVIADA">Enviada</option>
                <option value="POSPUESTA">Pospuesta</option>
                <option value="PEND_REACTIVACION">Pend. reactivación</option>
                <option value="CERRADA_PERDIDA">Cerrada perdida</option>
                <option value="CERRADA_GANADA">Cerrada ganada</option>
              </select>
            </label>

            <label className="field">
              <span className="label">Fecha de cotización</span>
              <input type="date" value={fechaCotizacion} onChange={(e) => setFechaCotizacion(e.target.value)} className="input" />
            </label>

            <label className="field">
              <span className="label">Fecha de vencimiento</span>
              <input type="date" value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} className="input" />
            </label>

            <label className="field">
              <span className="label">Moneda</span>
              <select value={moneda} onChange={(e) => setMoneda(e.target.value as CurrencyCode)} className="select">
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          <div className="sectionTitle">Productos</div>
          <div className="divider" />

          <div className="stack">
            <div className="productsHeaderGrid hint">
              <div>Nombre del producto</div>
              <div>Cantidad</div>
              <div>Descuento</div>
              <div>Impuestos</div>
            </div>

            {items.map((it, idx) => (
              <div key={idx} className="productsRowGrid">
                <select
                  value={it.id_producto}
                  onChange={(e) => setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, id_producto: e.target.value } : x)))}
                  className="select"
                >
                  <option value="">Seleccionar</option>
                  {products.map((p) => (
                    <option key={p.id} value={String(p.id)}>
                      {p.nombre}
                    </option>
                  ))}
                </select>

                <input
                  value={it.cantidad}
                  onChange={(e) => setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, cantidad: e.target.value } : x)))}
                  inputMode="numeric"
                  className="input"
                />

                <select
                  value={it.descuento_porcentaje}
                  onChange={(e) => setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, descuento_porcentaje: e.target.value } : x)))}
                  className="select"
                >
                  {["0", "5", "10", "15", "20", "25", "30"].map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>

                <select value="Auto" disabled className="select">
                  <option>Auto</option>
                </select>
              </div>
            ))}

            <div className="row">
              <Button
                onClick={() => setItems((prev) => [...prev, { id_producto: "", cantidad: "1", descuento_porcentaje: "0" }])}
                disabled={saving}
                className="btn--ghost minw-280"
              >
                + Añadir otro producto
              </Button>
              {items.length > 1 ? (
                <Button onClick={() => setItems((prev) => prev.slice(0, -1))} disabled={saving} className="btn--ghost">
                  Quitar último
                </Button>
              ) : null}
            </div>
          </div>

          <div className="sectionTitle">Resumen</div>
          <div className="divider" />

          <div className="summaryGrid">
            <div />
            <div className="card summaryCard">
              <div className="stack">
                <div className="summaryRow">
                  <span className="hint">Subtotal (sin impuestos):</span>
                  <span className="summaryValue">${centsToMoneyString(preview.subtotalSinImpuestosCents)}</span>
                </div>
                <div className="summaryRow">
                  <span className="hint">Impuestos:</span>
                  <span className="summaryValue">${centsToMoneyString(preview.impuestosCents)}</span>
                </div>
                <div className="summaryRow">
                  <span className="hint">Subtotal (con impuestos):</span>
                  <span className="summaryValue">${centsToMoneyString(preview.subtotalConImpuestosCents)}</span>
                </div>
                <div className="divider" />
                <div className="summaryRow">
                  <span className="summaryTotalLabel">Total:</span>
                  <span className="summaryTotalValue">${centsToMoneyString(preview.subtotalConImpuestosCents)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="sectionTitle">Información adicional</div>
          <div className="divider" />

          <label className="field">
            <span className="label">Notas</span>
            <textarea value={notas} onChange={(e) => setNotas(e.target.value)} className="textarea" />
          </label>

          <div className="quoteNewGrid">
            <label className="field">
              <span className="label">Plazo de entrega</span>
              <input value={plazoEntrega} onChange={(e) => setPlazoEntrega(e.target.value)} placeholder="Seleccionar" className="input" />
            </label>
            <label className="field">
              <span className="label">Forma de pago</span>
              <input value={formaPago} onChange={(e) => setFormaPago(e.target.value)} placeholder="Seleccionar" className="input" />
            </label>
            <label className="field">
              <span className="label">Lugar de entrega</span>
              <input value={lugarEntrega} onChange={(e) => setLugarEntrega(e.target.value)} placeholder="Seleccionar" className="input" />
            </label>
            <label className="field">
              <span className="label">Mantenimiento de oferta</span>
              <input value={mantenimientoOferta} onChange={(e) => setMantenimientoOferta(e.target.value)} placeholder="Seleccionar" className="input" />
            </label>
          </div>

          <div className="newActions">
            <Button disabled={saving} onClick={() => void saveDraft()} className="btn--ghost minw-170">
              Guardar borrador
            </Button>
            <Button disabled={saving} onClick={() => void generateQuote()} className="btn--primary minw-170">
              Generar
            </Button>
            <Button disabled={saving} onClick={backToList} className="btn--danger minw-170">
              Descartar
            </Button>
          </div>

          {saving ? <div className="hint">Procesando...</div> : null}
        </div>
      )}
    </div>
  );
}

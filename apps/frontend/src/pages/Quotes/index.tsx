import { useEffect, useMemo, useState } from "react";
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
    if (v === "PEND_REACTIVACION") return { bg: "#e9e4c6", fg: "#3a3619", label: "Pend. reactivación" };
    if (v === "ENVIADA") return { bg: "#e7d4ee", fg: "#3a1e47", label: "Enviada" };
    if (v === "POSPUESTA") return { bg: "#d8c4bb", fg: "#3f2b23", label: "Pospuesta" };
    if (v === "BORRADOR") return { bg: "#cfcfcf", fg: "#1f1f1f", label: "Borrador" };
    if (v === "CERRADA_PERDIDA") return { bg: "#f0b4b4", fg: "#3a1515", label: "Cerrada perdida" };
    if (v === "CERRADA_GANADA") return { bg: "#bfe9c2", fg: "#17331a", label: "Cerrada ganada" };
    if (v === "EMITIDA") return { bg: "#cde3ff", fg: "#0e2440", label: "Emitida" };
    return { bg: "#cfcfcf", fg: "#1f1f1f", label: s };
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
    <div style={{ display: "grid", gap: 16 }}>
      {mode === "list" ? (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <div>
              <h1 style={{ marginTop: 0, marginBottom: 6 }}>Cotizaciones</h1>
              <div style={{ opacity: 0.8, fontSize: 13 }}>
                Creá presupuestos y hacé el seguimiento de tus ventas
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                disabled={loading}
                onClick={downloadCsv}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                Exportar lista
              </button>
              <button
                disabled={loading}
                onClick={startNew}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.12)",
                  color: "inherit",
                  cursor: "pointer"
                }}
              >
                + Nueva cotización
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
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
                  style={{
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: active ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                    color: "inherit",
                    cursor: "pointer"
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto auto", alignItems: "center" }}>
            <input
              placeholder="Buscar..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{
                width: "100%",
                boxSizing: "border-box",
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "inherit"
              }}
            />
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              />
              <span style={{ opacity: 0.7 }}>—</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              />
            </div>
            <button
              disabled={loading}
              onClick={() => void reloadQuotes()}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "inherit",
                cursor: "pointer"
              }}
            >
              Filtrar
            </button>
          </div>

          {error ? <div style={{ color: "#ffb4b4" }}>{error}</div> : null}
          {info ? <div style={{ color: "#b6ffd7" }}>{info}</div> : null}
          {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <th style={{ padding: "10px 8px", width: 36 }}>
                    <input type="checkbox" />
                  </th>
                  <th style={{ padding: "10px 8px" }}>Cliente</th>
                  <th style={{ padding: "10px 8px" }}>ID</th>
                  <th style={{ padding: "10px 8px" }}>Fecha</th>
                  <th style={{ padding: "10px 8px" }}>Monto</th>
                  <th style={{ padding: "10px 8px" }}>Tipo de cliente</th>
                  <th style={{ padding: "10px 8px" }}>Estado</th>
                  <th style={{ padding: "10px 8px" }}>Prox. alerta</th>
                  <th style={{ padding: "10px 8px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((r) => {
                  const st = statusStyle(r.estado);
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "10px 8px" }}>
                        <input type="checkbox" />
                      </td>
                      <td style={{ padding: "10px 8px" }}>{r.cliente_nombre_empresa}</td>
                      <td style={{ padding: "10px 8px", opacity: 0.9 }}>#{r.id}</td>
                      <td style={{ padding: "10px 8px", opacity: 0.9 }}>{formatDate(r.fecha_emision)}</td>
                      <td style={{ padding: "10px 8px", opacity: 0.9 }}>
                        ${r.total_final} {r.moneda}
                      </td>
                      <td style={{ padding: "10px 8px", opacity: 0.85 }}>
                        {r.cliente_clasificacion ?? "-"}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <span
                          style={{
                            padding: "6px 10px",
                            borderRadius: 8,
                            background: st.bg,
                            color: st.fg,
                            fontSize: 12,
                            display: "inline-block",
                            minWidth: 130,
                            textAlign: "center"
                          }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td style={{ padding: "10px 8px", opacity: 0.9 }}>{formatAlert(r.proxima_alerta)}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <button
                          onClick={async () => {
                            try {
                              const pdf = await quoteService.downloadQuotePdf(r.id);
                              downloadBlob(pdf.blob, pdf.filename ?? `cotizacion-${r.id}.pdf`);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "download_error");
                            }
                          }}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer"
                          }}
                        >
                          ⋮
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {quotes.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={9} style={{ padding: "16px 8px", opacity: 0.75 }}>
                      No hay cotizaciones para mostrar
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div>
              <h1 style={{ marginTop: 0, marginBottom: 6 }}>Nueva cotización</h1>
              <div style={{ opacity: 0.8, fontSize: 13 }}>Cotizaciones &gt; Nueva cotización</div>
            </div>
            <button
              onClick={backToList}
              disabled={saving}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer"
              }}
            >
              Volver
            </button>
          </div>

          {error ? <div style={{ color: "#ffb4b4" }}>{error}</div> : null}
          {info ? <div style={{ color: "#b6ffd7" }}>{info}</div> : null}

          <div style={{ fontWeight: 700, opacity: 0.9 }}>Datos generales</div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.12)" }} />

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <span>Cliente</span>
              <select
                value={idCliente}
                onChange={(e) => setIdCliente(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              >
                <option value="">Seleccionar</option>
                {clients.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.nombre_empresa}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <span>Estado de cotización</span>
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              >
                <option value="BORRADOR">Borrador</option>
                <option value="EMITIDA">Emitida</option>
                <option value="ENVIADA">Enviada</option>
                <option value="POSPUESTA">Pospuesta</option>
                <option value="PEND_REACTIVACION">Pend. reactivación</option>
                <option value="CERRADA_PERDIDA">Cerrada perdida</option>
                <option value="CERRADA_GANADA">Cerrada ganada</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <span>Fecha de cotización</span>
              <input
                type="date"
                value={fechaCotizacion}
                onChange={(e) => setFechaCotizacion(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <span>Fecha de vencimiento</span>
              <input
                type="date"
                value={fechaVencimiento}
                onChange={(e) => setFechaVencimiento(e.target.value)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              />
            </label>

            <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
              <span>Moneda</span>
              <select
                value={moneda}
                onChange={(e) => setMoneda(e.target.value as CurrencyCode)}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              >
                <option value="ARS">ARS</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 6 }}>Productos</div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.12)" }} />

          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 120px 140px 140px", gap: 10 }}>
              <div style={{ opacity: 0.85 }}>Nombre del producto</div>
              <div style={{ opacity: 0.85 }}>Cantidad</div>
              <div style={{ opacity: 0.85 }}>Descuento</div>
              <div style={{ opacity: 0.85 }}>Impuestos</div>
            </div>

            {items.map((it, idx) => (
              <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 120px 140px 140px", gap: 10 }}>
                <select
                  value={it.id_producto}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, id_producto: e.target.value } : x)))
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit"
                  }}
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
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, cantidad: e.target.value } : x)))
                  }
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit"
                  }}
                />

                <select
                  value={it.descuento_porcentaje}
                  onChange={(e) =>
                    setItems((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, descuento_porcentaje: e.target.value } : x))
                    )
                  }
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.06)",
                    color: "inherit"
                  }}
                >
                  {["0", "5", "10", "15", "20", "25", "30"].map((v) => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>

                <select
                  value="Auto"
                  disabled
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "rgba(255,255,255,0.04)",
                    color: "inherit",
                    opacity: 0.8
                  }}
                >
                  <option>Auto</option>
                </select>
              </div>
            ))}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() =>
                  setItems((prev) => [...prev, { id_producto: "", cantidad: "1", descuento_porcentaje: "0" }])
                }
                disabled={saving}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  width: 280
                }}
              >
                + Añadir otro producto
              </button>
              {items.length > 1 ? (
                <button
                  onClick={() => setItems((prev) => prev.slice(0, -1))}
                  disabled={saving}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.15)",
                    background: "transparent",
                    color: "inherit",
                    cursor: "pointer"
                  }}
                >
                  Quitar último
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 6 }}>Resumen</div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.12)" }} />

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "1fr minmax(280px, 420px)",
              alignItems: "start"
            }}
          >
            <div />
            <div
              style={{
                padding: 14,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)"
              }}
            >
              <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ opacity: 0.85 }}>Subtotal (sin impuestos):</span>
                  <span style={{ fontWeight: 600 }}>
                    ${centsToMoneyString(preview.subtotalSinImpuestosCents)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ opacity: 0.85 }}>Impuestos:</span>
                  <span style={{ fontWeight: 600 }}>${centsToMoneyString(preview.impuestosCents)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ opacity: 0.85 }}>Subtotal (con impuestos):</span>
                  <span style={{ fontWeight: 600 }}>
                    ${centsToMoneyString(preview.subtotalConImpuestosCents)}
                  </span>
                </div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "6px 0" }} />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontWeight: 700 }}>Total:</span>
                  <span style={{ fontWeight: 800 }}>
                    ${centsToMoneyString(preview.subtotalConImpuestosCents)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontWeight: 700, opacity: 0.9, marginTop: 6 }}>Información adicional</div>
          <div style={{ height: 1, background: "rgba(255,255,255,0.12)" }} />

          <label style={{ display: "grid", gap: 6 }}>
            <span>Notas</span>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              style={{
                minHeight: 96,
                padding: 10,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "inherit",
                resize: "vertical"
              }}
            />
          </label>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Plazo de entrega</span>
              <input
                value={plazoEntrega}
                onChange={(e) => setPlazoEntrega(e.target.value)}
                placeholder="Seleccionar"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Forma de pago</span>
              <input
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
                placeholder="Seleccionar"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Lugar de entrega</span>
              <input
                value={lugarEntrega}
                onChange={(e) => setLugarEntrega(e.target.value)}
                placeholder="Seleccionar"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <span>Mantenimiento de oferta</span>
              <input
                value={mantenimientoOferta}
                onChange={(e) => setMantenimientoOferta(e.target.value)}
                placeholder="Seleccionar"
                style={{
                  padding: 10,
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "inherit"
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-start", marginTop: 8 }}>
            <button
              disabled={saving}
              onClick={() => void saveDraft()}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                minWidth: 170
              }}
            >
              Guardar borrador
            </button>
            <button
              disabled={saving}
              onClick={() => void generateQuote()}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.12)",
                color: "inherit",
                cursor: "pointer",
                minWidth: 170
              }}
            >
              Generar
            </button>
            <button
              disabled={saving}
              onClick={backToList}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,80,80,0.6)",
                color: "inherit",
                cursor: "pointer",
                minWidth: 170
              }}
            >
              Descartar
            </button>
          </div>

          {saving ? <div style={{ opacity: 0.75 }}>Procesando...</div> : null}
        </div>
      )}
    </div>
  );
}

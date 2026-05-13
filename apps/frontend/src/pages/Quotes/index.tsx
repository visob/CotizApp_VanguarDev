import { useEffect, useMemo, useState } from "react";
import type { Client, CurrencyCode, Product } from "../../types";
import * as clientService from "../../services/client.service";
import * as productService from "../../services/product.service";
import * as quoteService from "../../services/quote.service";

type QuoteItemDraft = {
  id_producto: number;
  cantidad: string;
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

  const [idCliente, setIdCliente] = useState<string>("");
  const [moneda, setMoneda] = useState<CurrencyCode>("ARS");
  const [ivaPorcentaje, setIvaPorcentaje] = useState<string>("21");
  const [descuentoGlobal, setDescuentoGlobal] = useState<string>("0");
  const [tipoCambio, setTipoCambio] = useState<string>("1");

  const [productQuery, setProductQuery] = useState("");
  const [items, setItems] = useState<QuoteItemDraft[]>([]);

  async function reload() {
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

  useEffect(() => {
    void reload();
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    return products.filter((p) => contains(p.nombre, q) || String(p.id).includes(q));
  }, [productQuery, products]);

  const preview = useMemo(() => {
    const discountCents = parseMoneyToCents(descuentoGlobal) ?? 0n;
    const ivaBp = parsePercentToBasisPoints(ivaPorcentaje) ?? 0n;

    const lines = items
      .map((it) => {
        const product = products.find((p) => p.id === it.id_producto);
        if (!product) return null;

        const qty = parseQty(it.cantidad);
        const unitStr = moneda === "ARS" ? product.precio_ars : product.precio_usd;
        const unitCents = parseMoneyToCents(unitStr);

        const lineTotalCents =
          qty && unitCents !== null ? unitCents * BigInt(qty) : null;

        return {
          id_producto: it.id_producto,
          nombre: product.nombre,
          cantidadRaw: it.cantidad,
          cantidad: qty,
          unitCents: unitCents ?? 0n,
          lineTotalCents
        };
      })
      .filter(
        (
          x
        ): x is {
          id_producto: number;
          nombre: string;
          cantidadRaw: string;
          cantidad: number | null;
          unitCents: bigint;
          lineTotalCents: bigint | null;
        } => x !== null
      );

    const subtotalCents = lines.reduce((acc, l) => acc + (l.lineTotalCents ?? 0n), 0n);
    const ivaCents = calcIvaCents(subtotalCents, ivaBp);
    const totalBeforeDiscountCents = subtotalCents + ivaCents;
    const totalFinalCents =
      totalBeforeDiscountCents > discountCents ? totalBeforeDiscountCents - discountCents : 0n;

    return {
      lines,
      subtotalCents,
      ivaCents,
      discountCents,
      totalBeforeDiscountCents,
      totalFinalCents
    };
  }, [descuentoGlobal, ivaPorcentaje, items, moneda, products]);

  function addProduct(id_producto: number) {
    setInfo(null);
    setItems((prev) => {
      const existing = prev.find((x) => x.id_producto === id_producto);
      if (existing) {
        return prev.map((x) =>
          x.id_producto === id_producto ? { ...x, cantidad: String((parseQty(x.cantidad) ?? 0) + 1) } : x
        );
      }
      return [{ id_producto, cantidad: "1" }, ...prev];
    });
  }

  function removeItem(id_producto: number) {
    setInfo(null);
    setItems((prev) => prev.filter((x) => x.id_producto !== id_producto));
  }

  function clearDraft() {
    setIdCliente("");
    setMoneda("ARS");
    setIvaPorcentaje("21");
    setDescuentoGlobal("0");
    setTipoCambio("1");
    setItems([]);
    setProductQuery("");
  }

  async function onSaveAndDownload() {
    setError(null);
    setInfo(null);

    const idClienteNum = Number(idCliente);
    if (!Number.isFinite(idClienteNum) || idClienteNum <= 0) {
      setError("Seleccioná un cliente válido");
      return;
    }

    const discountCents = parseMoneyToCents(descuentoGlobal);
    if (discountCents === null) {
      setError("Descuento global inválido (ej: 0 o 1500.50)");
      return;
    }

    const ivaBp = parsePercentToBasisPoints(ivaPorcentaje);
    if (ivaBp === null) {
      setError("IVA inválido (ej: 21 o 10.5)");
      return;
    }

    const payloadItems = items
      .map((it) => {
        const cantidad = parseQty(it.cantidad);
        return cantidad ? { id_producto: it.id_producto, cantidad } : null;
      })
      .filter((x): x is { id_producto: number; cantidad: number } => x !== null);

    if (payloadItems.length === 0) {
      setError("Agregá al menos un item con cantidad válida");
      return;
    }

    setSaving(true);
    try {
      const created = await quoteService.createQuote({
        id_cliente: idClienteNum,
        moneda,
        descuento_global: descuentoGlobal,
        iva_porcentaje: ivaPorcentaje,
        tipo_cambio: tipoCambio,
        items: payloadItems
      });

      const pdf = await quoteService.downloadQuotePdf(created.id);
      downloadBlob(pdf.blob, pdf.filename ?? `cotizacion-${created.id}.pdf`);
      setInfo(`Cotización #${created.id} guardada y descargada`);
      clearDraft();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>Cotizaciones</h1>
          <div style={{ opacity: 0.8, fontSize: 13 }}>
            Armá una cotización, previsualizá los cálculos y descargá el PDF comercial
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            disabled={loading || saving}
            onClick={() => void onSaveAndDownload()}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.12)",
              color: "inherit",
              cursor: "pointer"
            }}
          >
            Guardar y descargar PDF
          </button>
          <button
            disabled={loading || saving}
            onClick={() => {
              setInfo(null);
              setError(null);
              clearDraft();
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer"
            }}
          >
            Limpiar
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          alignItems: "start"
        }}
      >
        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <span>Cliente</span>
          <select
            value={idCliente}
            onChange={(e) => setIdCliente(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit"
            }}
          >
            <option value="" disabled>
              Seleccionar...
            </option>
            {clients.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.nombre_empresa}
              </option>
            ))}
          </select>
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
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit"
            }}
          >
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </label>

        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <span>IVA %</span>
          <input
            value={ivaPorcentaje}
            onChange={(e) => setIvaPorcentaje(e.target.value)}
            inputMode="decimal"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit"
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <span>Descuento</span>
          <input
            value={descuentoGlobal}
            onChange={(e) => setDescuentoGlobal(e.target.value)}
            inputMode="decimal"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit"
            }}
          />
        </label>

        <label style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <span>Tipo cambio</span>
          <input
            value={tipoCambio}
            onChange={(e) => setTipoCambio(e.target.value)}
            inputMode="decimal"
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit"
            }}
          />
        </label>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            placeholder="Buscar productos (SKU o descripción...)"
            value={productQuery}
            onChange={(e) => setProductQuery(e.target.value)}
            style={{
              flex: 1,
              maxWidth: 520,
              boxSizing: "border-box",
              padding: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit"
            }}
          />
          <button
            disabled={loading || saving}
            onClick={() => void reload()}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(255,255,255,0.06)",
              color: "inherit",
              cursor: "pointer"
            }}
          >
            Actualizar
          </button>
        </div>

        {error ? <div style={{ color: "#ffb4b4" }}>{error}</div> : null}
        {info ? <div style={{ color: "#b6ffd7" }}>{info}</div> : null}
        {loading ? <div style={{ opacity: 0.75 }}>Cargando...</div> : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Productos</div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                  <th style={{ padding: "10px 8px" }}>SKU</th>
                  <th style={{ padding: "10px 8px" }}>Descripción</th>
                  <th style={{ padding: "10px 8px" }}>Precio</th>
                  <th style={{ padding: "10px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.slice(0, 30).map((p) => {
                  const unitStr = moneda === "ARS" ? p.precio_ars : p.precio_usd;
                  const unitCents = parseMoneyToCents(unitStr) ?? 0n;
                  return (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "10px 8px", opacity: 0.9 }}>{p.id}</td>
                      <td style={{ padding: "10px 8px" }}>{p.nombre}</td>
                      <td style={{ padding: "10px 8px", opacity: 0.9 }}>
                        {centsToMoneyString(unitCents)} {moneda}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <button
                          disabled={saving}
                          onClick={() => addProduct(p.id)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.08)",
                            color: "inherit",
                            cursor: "pointer"
                          }}
                        >
                          Agregar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredProducts.length > 30 ? (
              <div style={{ marginTop: 8, opacity: 0.75, fontSize: 12 }}>
                Mostrando 30 de {filteredProducts.length}. Refiná el filtro para ver el resto.
              </div>
            ) : null}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ overflowX: "auto" }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Items</div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
                    <th style={{ padding: "10px 8px" }}>Descripción</th>
                    <th style={{ padding: "10px 8px" }}>Cant.</th>
                    <th style={{ padding: "10px 8px" }}>Unit.</th>
                    <th style={{ padding: "10px 8px" }}>Total</th>
                    <th style={{ padding: "10px 8px" }} />
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: "12px 8px", opacity: 0.75 }}>
                        Agregá productos desde la tabla de la izquierda
                      </td>
                    </tr>
                  ) : null}
                  {preview.lines.map((l) => (
                    <tr key={l.id_producto} style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                      <td style={{ padding: "10px 8px" }}>{l.nombre}</td>
                      <td style={{ padding: "10px 8px" }}>
                        <input
                          value={l.cantidadRaw}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((x) =>
                                x.id_producto === l.id_producto ? { ...x, cantidad: e.target.value } : x
                              )
                            )
                          }
                          inputMode="numeric"
                          style={{
                            width: 90,
                            padding: 8,
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "rgba(255,255,255,0.06)",
                            color: "inherit"
                          }}
                        />
                      </td>
                      <td style={{ padding: "10px 8px", opacity: 0.9 }}>
                        {centsToMoneyString(l.unitCents)} {moneda}
                      </td>
                      <td style={{ padding: "10px 8px", opacity: 0.9 }}>
                        {l.lineTotalCents !== null ? `${centsToMoneyString(l.lineTotalCents)} ${moneda}` : "Cantidad inválida"}
                      </td>
                      <td style={{ padding: "10px 8px" }}>
                        <button
                          disabled={saving}
                          onClick={() => removeItem(l.id_producto)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.15)",
                            background: "transparent",
                            color: "inherit",
                            cursor: "pointer",
                            opacity: 0.9
                          }}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.04)"
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 10 }}>Vista previa</div>
              <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
                <div>
                  Subtotal: {centsToMoneyString(preview.subtotalCents)} {moneda}
                </div>
                <div>
                  IVA: {centsToMoneyString(preview.ivaCents)} {moneda}
                </div>
                <div style={{ opacity: 0.9 }}>
                  Total (sin descuento): {centsToMoneyString(preview.totalBeforeDiscountCents)} {moneda}
                </div>
                <div>
                  Descuento: {centsToMoneyString(preview.discountCents)} {moneda}
                </div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>
                  Total final: {centsToMoneyString(preview.totalFinalCents)} {moneda}
                </div>
              </div>
            </div>

            {saving ? <div style={{ opacity: 0.75 }}>Guardando...</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

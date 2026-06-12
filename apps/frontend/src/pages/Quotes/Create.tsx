import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import type { CatalogOption, Client, CurrencyCode, Product } from "../../types";
import * as clientService from "../../services/client.service";
import * as configService from "../../services/config.service";
import * as productService from "../../services/product.service";
import * as quoteService from "../../services/quote.service";
import { getErrorMessage } from "../../utils/feedback";
import "../../styles/quotes.css"; // assuming there's quotes.css, or just keep layout.css if it's there

type QuoteItemDraft = {
  id_producto: string;
  cantidad: string;
  iva_porcentaje: string;
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

function parseQty(value: string) {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  return int > 0 ? int : null;
}

function normalizePercentInput(value: string) {
  return value.replaceAll("%", "").trim();
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

export default function QuotesCreate() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogOptions, setCatalogOptions] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

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
    { id_producto: "", cantidad: "1", iva_porcentaje: "" }
  ]);

  const [notas, setNotas] = useState("");
  const [plazoEntrega, setPlazoEntrega] = useState("");
  const [formaPago, setFormaPago] = useState("");
  const [lugarEntrega, setLugarEntrega] = useState("");
  const [descuentoPorcentajeGlobal, setDescuentoPorcentajeGlobal] = useState("0");

  async function reloadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const [c, p, options] = await Promise.all([
        clientService.listClients(),
        productService.listProducts(),
        configService.listCatalogOptions()
      ]);
      setClients(c);
      setProducts(p);
      setCatalogOptions(options);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadCatalog();
  }, []);

  const formaPagoOptions = useMemo(
    () => catalogOptions.filter((option) => option.tipo === "forma_pago" && option.activo),
    [catalogOptions]
  );
  const lugarEntregaOptions = useMemo(
    () => catalogOptions.filter((option) => option.tipo === "lugar_entrega" && option.activo),
    [catalogOptions]
  );
  const ivaOptions = useMemo(
    () => catalogOptions.filter((option) => option.tipo === "tipo_iva" && option.activo),
    [catalogOptions]
  );

  useEffect(() => {
    if (ivaOptions.length === 0) return;
    const defaultIva = ivaOptions[0]?.value ?? "";
    setItems((prev) =>
      prev.map((item) =>
        item.iva_porcentaje
          ? item
          : {
              ...item,
              iva_porcentaje: defaultIva
            }
      )
    );
  }, [ivaOptions]);

  const preview = useMemo(() => {
    const globalDiscountBp =
      parsePercentToBasisPoints(normalizePercentInput(descuentoPorcentajeGlobal)) ?? 0n;
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
            ivaBp: parsePercentToBasisPoints(it.iva_porcentaje) ?? 0n,
            netLineCents: null as bigint | null
          };
        }

        const qty = parseQty(it.cantidad);
        const unitStr = moneda === "ARS" ? product.precio_ars : product.precio_usd;
        const unitCents = parseMoneyToCents(unitStr) ?? 0n;

        if (!qty) {
          return {
            idx,
            productName: product.nombre,
            unitCents,
            qty,
            ivaBp: parsePercentToBasisPoints(it.iva_porcentaje) ?? 0n,
            netLineCents: null
          };
        }

        const gross = unitCents * BigInt(qty);
        const discountLine = (gross * globalDiscountBp + 5000n) / 10000n;
        const net = gross > discountLine ? gross - discountLine : 0n;

        return {
          idx,
          productName: product.nombre,
          unitCents,
          qty,
          ivaBp: parsePercentToBasisPoints(it.iva_porcentaje) ?? 0n,
          netLineCents: net
        };
      })
      .filter(Boolean);

    const subtotalSinImpuestosCents = lines.reduce((acc, l) => acc + (l.netLineCents ?? 0n), 0n);
    const descuentoCents = lines.reduce((acc, line) => {
      const gross = line.qty ? line.unitCents * BigInt(line.qty) : 0n;
      const d = (gross * globalDiscountBp + 5000n) / 10000n;
      return acc + d;
    }, 0n);
    const subtotalAntesDescuentoCents =
      subtotalSinImpuestosCents + descuentoCents;
    const impuestosCents = lines.reduce(
      (acc, line) => acc + calcIvaCents(line.netLineCents ?? 0n, line.ivaBp ?? 0n),
      0n
    );
    const subtotalConImpuestosCents = subtotalSinImpuestosCents + impuestosCents;

    return {
      lines,
      subtotalAntesDescuentoCents,
      subtotalSinImpuestosCents,
      descuentoCents,
      impuestosCents,
      subtotalConImpuestosCents
    };
  }, [items, products, moneda, descuentoPorcentajeGlobal]);

  const discountBpInput = useMemo(
    () => parsePercentToBasisPoints(normalizePercentInput(descuentoPorcentajeGlobal)),
    [descuentoPorcentajeGlobal]
  );
  const isDiscountValid = discountBpInput !== null && discountBpInput >= 0n && discountBpInput <= 10000n;

  function backToList() {
    navigate("/quotes");
  }

  function parseNewItemsForPayload() {
    return items
      .map((it) => {
        const id_producto = Number(it.id_producto);
        const cantidad = parseQty(it.cantidad);
        if (!Number.isFinite(id_producto) || id_producto <= 0 || !cantidad) return null;
        const ivaOk = parsePercentToBasisPoints(it.iva_porcentaje);
        if (ivaOk === null) return null;
        return {
          id_producto,
          cantidad,
          iva_porcentaje: it.iva_porcentaje.trim()
        };
      })
      .filter(
        (x): x is { id_producto: number; cantidad: number; iva_porcentaje: string } => x !== null
      );
  }

  async function saveDraft() {
    setError(null);
    setInfo(null);

    const idClienteNum = Number(idCliente);
    if (!Number.isFinite(idClienteNum) || idClienteNum <= 0) {
      setError("Seleccioná un cliente válido");
      return;
    }
    if (!isDiscountValid) {
      setError("El descuento global debe ser un porcentaje entre 0 y 100 (ej: 10 o 10.5)");
      return;
    }
    setSaving(true);
    try {
      const payloadItems = parseNewItemsForPayload();
      await quoteService.createQuote({
        id_cliente: idClienteNum,
        moneda,
        estado: "BORRADOR",
        fecha_emision: `${fechaCotizacion}T00:00:00.000Z`,
        fecha_vencimiento: `${fechaVencimiento}T00:00:00.000Z`,
        descuento_porcentaje_global: normalizePercentInput(descuentoPorcentajeGlobal),
        tipo_cambio: moneda === "ARS" ? "1" : "1",
        notas,
        plazo_entrega: plazoEntrega,
        forma_pago: formaPago,
        lugar_entrega: lugarEntrega,
        items: payloadItems
      });
      showToast({ type: "success", text: "Borrador guardado correctamente" });
      navigate("/quotes");
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo guardar el borrador"));
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
    if (!isDiscountValid) {
      setError("El descuento global debe ser un porcentaje entre 0 y 100 (ej: 10 o 10.5)");
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
        descuento_porcentaje_global: normalizePercentInput(descuentoPorcentajeGlobal),
        tipo_cambio: moneda === "ARS" ? "1" : "1",
        notas,
        plazo_entrega: plazoEntrega,
        forma_pago: formaPago,
        lugar_entrega: lugarEntrega,
        items: payloadItems
      });

      const pdf = await quoteService.downloadQuotePdf(created.id);
      downloadBlob(pdf.blob, pdf.filename ?? `cotizacion-${created.id}.pdf`);
      showToast({ type: "success", text: "Cotización generada correctamente" });
      navigate("/quotes");
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo generar la cotización"));
      setSaving(false);
    }
  }

  return (
    <div className="page">
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

            <label className="field">
              <span className="label">Descuento global</span>
              <input
                value={descuentoPorcentajeGlobal}
                onChange={(e) => setDescuentoPorcentajeGlobal(e.target.value)}
                className="input"
                inputMode="decimal"
                placeholder="Ej: 10.5"
              />
            </label>

          </div>

          <div className="sectionTitle">Productos</div>
          <div className="divider" />

          <div className="stack">
            <div className="productsHeaderGrid hint">
              <div>Nombre del producto</div>
              <div>Cantidad</div>
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
                  value={it.iva_porcentaje}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, iva_porcentaje: e.target.value } : x)))
                  }
                  className="select"
                >
                  <option value="">Seleccionar</option>
                  {ivaOptions.map((option) => (
                    <option key={option.id} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}

            <div className="row">
              <Button
                onClick={() =>
                  setItems((prev) => [
                    ...prev,
                    {
                      id_producto: "",
                      cantidad: "1",
                      iva_porcentaje: ivaOptions[0]?.value ?? ""
                    }
                  ])
                }
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
                  <span className="hint">Subtotal (antes de descuento):</span>
                  <span className="summaryValue">${centsToMoneyString(preview.subtotalAntesDescuentoCents)}</span>
                </div>
                <div className="summaryRow">
                  <span className="hint">Descuento global ({descuentoPorcentajeGlobal}%):</span>
                  <span className="summaryValue">-${centsToMoneyString(preview.descuentoCents)}</span>
                </div>
                <div className="summaryRow">
                  <span className="hint">Subtotal (sin impuestos):</span>
                  <span className="summaryValue">${centsToMoneyString(preview.subtotalSinImpuestosCents)}</span>
                </div>
                <div className="summaryRow">
                  <span className="hint">Impuestos:</span>
                  <span className="summaryValue">${centsToMoneyString(preview.impuestosCents)}</span>
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
              <select value={formaPago} onChange={(e) => setFormaPago(e.target.value)} className="select">
                <option value="">Seleccionar</option>
                {formaPagoOptions.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="label">Lugar de entrega</span>
              <select value={lugarEntrega} onChange={(e) => setLugarEntrega(e.target.value)} className="select">
                <option value="">Seleccionar</option>
                {lugarEntregaOptions.map((option) => (
                  <option key={option.id} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
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
    </div>
  );
}

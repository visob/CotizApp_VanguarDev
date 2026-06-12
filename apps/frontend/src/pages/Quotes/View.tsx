import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import * as quoteService from "../../services/quote.service";
import { getErrorMessage } from "../../utils/feedback";
import "../../styles/quotes.css";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("es-AR") : iso;
}

export default function QuotesView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [data, setData] = useState<quoteService.QuoteDetailResult | null>(null);

  const [estado, setEstado] = useState("");
  const [proximaAlerta, setProximaAlerta] = useState("");

  async function loadData() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await quoteService.getQuote(Number(id));
      setData(res);
      setEstado(res.quote.estado);
      setProximaAlerta(res.quote.proxima_alerta ? res.quote.proxima_alerta.split("T")[0] : "");
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo cargar la cotización"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [id]);

  async function saveChanges() {
    if (!id || !data) return;
    setSaving(true);
    setError(null);
    try {
      await quoteService.updateQuote(Number(id), {
        estado,
        proxima_alerta: proximaAlerta ? `${proximaAlerta}T00:00:00.000Z` : null
      });
      showToast({ type: "success", text: "Cotización actualizada correctamente" });
      void loadData(); // reload
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo guardar la cotización"));
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <div className="page"><div className="hint">Cargando...</div></div>;
  }

  if (!data) {
    return (
      <div className="page">
        {error ? <div className="error">{error}</div> : <div className="error">Cotización no encontrada</div>}
        <Button onClick={() => navigate("/quotes")} className="btn--ghost" style={{ marginTop: 16 }}>Volver a cotizaciones</Button>
      </div>
    );
  }

  const q = data.quote;
  const c = data.client;
  const items = data.items;

  return (
    <div className="page">
      <div className="stack">
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle">Cotización #{q.id}</h1>
            <div className="pageSubtitle">Cotizaciones &gt; Ver cotización</div>
          </div>
          <Button onClick={() => navigate("/quotes")} disabled={saving} className="btn--ghost">
            Volver
          </Button>
        </div>

        {error ? <div className="error">{error}</div> : null}
        <div className="sectionTitle">Datos generales (Solo lectura)</div>
        <div className="divider" />

        <div className="quoteNewGrid">
          <label className="field">
            <span className="label">Cliente</span>
            <input value={c.nombre_empresa} disabled className="input" style={{ background: "var(--color-surface)" }} />
          </label>
          <label className="field">
            <span className="label">Fecha de cotización</span>
            <input value={formatDate(q.fecha_emision)} disabled className="input" style={{ background: "var(--color-surface)" }} />
          </label>
          <label className="field">
            <span className="label">Fecha de vencimiento</span>
            <input value={formatDate(q.fecha_vencimiento)} disabled className="input" style={{ background: "var(--color-surface)" }} />
          </label>
          <label className="field">
            <span className="label">Moneda</span>
            <input value={q.moneda} disabled className="input" style={{ background: "var(--color-surface)" }} />
          </label>
        </div>

        <div className="sectionTitle" style={{ marginTop: 32 }}>Control y Seguimiento</div>
        <div className="divider" />

        <div className="quoteNewGrid">
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
            <span className="label">Próxima Alerta</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" value={proximaAlerta} onChange={(e) => setProximaAlerta(e.target.value)} className="input" />
              <button onClick={() => setProximaAlerta("")} style={{ background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", fontSize: 13 }}>Limpiar</button>
            </div>
          </label>
        </div>

        <div className="sectionTitle" style={{ marginTop: 32 }}>Productos</div>
        <div className="divider" />

        <div className="tableWrap">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>IVA</th>
                <th>Precio Unit.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.producto_nombre}</td>
                  <td>{it.cantidad}</td>
                  <td>{it.iva_porcentaje}%</td>
                  <td>${it.precio_unitario_momento} {q.moneda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="sectionTitle" style={{ marginTop: 32 }}>Resumen de Totales</div>
        <div className="divider" />

        <div className="summaryGrid">
          <div />
          <div className="card summaryCard">
            <div className="stack">
              <div className="summaryRow">
                <span className="hint">Subtotal:</span>
                <span className="summaryValue">${q.subtotal}</span>
              </div>
              <div className="summaryRow">
                <span className="hint">Descuento Global:</span>
                <span className="summaryValue">
                  {q.descuento_porcentaje_global}% (${q.descuento_global})
                </span>
              </div>
              <div className="summaryRow">
                <span className="hint">IVA ({q.iva_porcentaje}):</span>
                <span className="summaryValue">Incluido</span>
              </div>
              <div className="divider" />
              <div className="summaryRow">
                <span className="summaryTotalLabel">Total Final:</span>
                <span className="summaryTotalValue">${q.total_final} {q.moneda}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="sectionTitle" style={{ marginTop: 32 }}>Información Adicional (Solo lectura)</div>
        <div className="divider" />

        <label className="field">
          <span className="label">Notas</span>
          <textarea value={q.notas || ""} disabled className="textarea" style={{ background: "var(--color-surface)" }} />
        </label>

        <div className="quoteNewGrid">
          <label className="field">
            <span className="label">Plazo de entrega</span>
            <input value={q.plazo_entrega || ""} disabled className="input" style={{ background: "var(--color-surface)" }} />
          </label>
          <label className="field">
            <span className="label">Forma de pago</span>
            <input value={q.forma_pago || ""} disabled className="input" style={{ background: "var(--color-surface)" }} />
          </label>
          <label className="field">
            <span className="label">Lugar de entrega</span>
            <input value={q.lugar_entrega || ""} disabled className="input" style={{ background: "var(--color-surface)" }} />
          </label>
        </div>

        <div className="newActions">
          <Button disabled={saving || (estado === q.estado && proximaAlerta === (q.proxima_alerta ? q.proxima_alerta.split("T")[0] : ""))} onClick={saveChanges} className="btn--primary minw-170">
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}

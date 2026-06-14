import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { NoteIcon, ReturnIcon } from "../../components/common/Icons";
import { useToast } from "../../context/ToastContext";
import * as quoteService from "../../services/quote.service";
import { getErrorMessage } from "../../utils/feedback";
import "../../styles/quotes.css";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("es-AR") : iso;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleString("es-AR") : iso;
}

function extractEstadoChange(metadata: unknown): { from: string; to: string } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const from = typeof m.from === "string" ? m.from : null;
  const to = typeof m.to === "string" ? m.to : null;
  return from && to ? { from, to } : null;
}

function extractCreationEstado(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  return typeof m.estado === "string" ? m.estado : null;
}

function extractNoteKey(metadata: unknown, fallbackId: number) {
  if (metadata && typeof metadata === "object") {
    const m = metadata as Record<string, unknown>;
    if (typeof m.noteKey === "string" && m.noteKey.trim()) return m.noteKey.trim();
  }
  return String(fallbackId);
}

export default function QuotesView() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  const [data, setData] = useState<quoteService.QuoteDetailResult | null>(null);
  const [tracking, setTracking] = useState<quoteService.QuoteTrackingEvent[]>([]);

  const [estado, setEstado] = useState("");
  const [proximaAlerta, setProximaAlerta] = useState("");
  const [fechaReactivacion1, setFechaReactivacion1] = useState("");
  const [fechaReactivacion2, setFechaReactivacion2] = useState("");
  const [fechaReactivacion3, setFechaReactivacion3] = useState("");
  const [reactivacionActiva, setReactivacionActiva] = useState<1 | 2 | 3>(1);

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteModalValue, setNoteModalValue] = useState("");
  const [editingNoteKey, setEditingNoteKey] = useState<string | null>(null);
  const [editingFrom, setEditingFrom] = useState<string | null>(null);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await quoteService.getQuote(Number(id));
      setData(res);
      setEstado(res.quote.estado);
      setProximaAlerta(res.quote.proxima_alerta ? res.quote.proxima_alerta.split("T")[0] : "");
      setFechaReactivacion1(res.quote.fecha_reactivacion_1 ? res.quote.fecha_reactivacion_1.split("T")[0] : "");
      setFechaReactivacion2(res.quote.fecha_reactivacion_2 ? res.quote.fecha_reactivacion_2.split("T")[0] : "");
      setFechaReactivacion3(res.quote.fecha_reactivacion_3 ? res.quote.fecha_reactivacion_3.split("T")[0] : "");
      setReactivacionActiva((res.quote.reactivacion_activa as 1 | 2 | 3) || 1);
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo cargar la cotización"));
    } finally {
      setLoading(false);
    }
  }

  async function loadTracking() {
    if (!id) return;
    setTrackingLoading(true);
    try {
      const items = await quoteService.listQuoteTracking(Number(id));
      setTracking(items);
    } catch (err) {
      showToast({ type: "error", text: getErrorMessage(err, {}, "No se pudo cargar el historial") });
    } finally {
      setTrackingLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    void loadTracking();
  }, [id]);

  async function saveChanges() {
    if (!id || !data) return;
    setSaving(true);
    setError(null);
    try {
      await quoteService.updateQuote(Number(id), {
        estado,
        proxima_alerta: proximaAlerta ? `${proximaAlerta}T00:00:00.000Z` : null,
        fecha_reactivacion_1: fechaReactivacion1 ? `${fechaReactivacion1}T00:00:00.000Z` : null,
        fecha_reactivacion_2: fechaReactivacion2 ? `${fechaReactivacion2}T00:00:00.000Z` : null,
        fecha_reactivacion_3: fechaReactivacion3 ? `${fechaReactivacion3}T00:00:00.000Z` : null,
        reactivacion_activa: reactivacionActiva
      });
      showToast({ type: "success", text: "Cotización actualizada correctamente" });
      void loadData();
      void loadTracking();
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo guardar la cotización"));
    } finally {
      setSaving(false);
    }
  }

  const notes = useMemo(() => {
    const editedKeys = new Set<string>();
    for (const ev of tracking) {
      if (ev.tipo_accion === "NOTA_EDITADA") {
        editedKeys.add(extractNoteKey(ev.metadata, ev.id));
      }
    }

    const latestByKey = new Map<
      string,
      { noteKey: string; text: string; updatedAtIso: string; who: string; edited: boolean }
    >();
    for (const ev of tracking) {
      if (ev.tipo_accion !== "NOTA" && ev.tipo_accion !== "NOTA_EDITADA") continue;
      if (!ev.observaciones) continue;
      const noteKey = extractNoteKey(ev.metadata, ev.id);
      if (latestByKey.has(noteKey)) continue;
      const who = ev.usuario_nombre || ev.usuario_email || (ev.id_usuario ? "Usuario" : "Sistema");
      latestByKey.set(noteKey, {
        noteKey,
        text: ev.observaciones,
        updatedAtIso: ev.fecha_accion,
        who,
        edited: editedKeys.has(noteKey)
      });
    }

    const arr = Array.from(latestByKey.values());
    arr.sort((a, b) => new Date(b.updatedAtIso).getTime() - new Date(a.updatedAtIso).getTime());
    return arr;
  }, [tracking]);

  function openNewNoteModal() {
    setEditingNoteKey(null);
    setEditingFrom(null);
    setNoteModalValue("");
    setNoteModalOpen(true);
  }

  function openEditNoteModal(noteKey: string, currentText: string) {
    setEditingNoteKey(noteKey);
    setEditingFrom(currentText);
    setNoteModalValue(currentText);
    setNoteModalOpen(true);
  }

  function closeNoteModal() {
    setNoteModalOpen(false);
    setNoteModalValue("");
    setEditingNoteKey(null);
    setEditingFrom(null);
  }

  async function saveNoteFromModal() {
    if (!id) return;
    const text = noteModalValue.trim();
    if (!text) return;
    setTrackingSaving(true);
    try {
      if (editingNoteKey) {
        await quoteService.addQuoteTrackingEvent(Number(id), {
          tipo_accion: "NOTA_EDITADA",
          observaciones: text,
          metadata: { noteKey: editingNoteKey, from: editingFrom, to: text }
        });
        showToast({ type: "success", text: "Nota modificada correctamente" });
      } else {
        const noteKey =
          typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : String(Date.now());
        await quoteService.addQuoteTrackingNote(Number(id), { nota: text, metadata: { noteKey } });
        showToast({ type: "success", text: "Nota agregada correctamente" });
      }
      closeNoteModal();
      void loadTracking();
    } catch (err) {
      showToast({ type: "error", text: getErrorMessage(err, {}, "No se pudo guardar la nota") });
    } finally {
      setTrackingSaving(false);
    }
  }

  if (loading && !data) {
    return <div className="page"><div className="hint">Cargando...</div></div>;
  }

  if (!data) {
    return (
      <div className="page">
        {error ? <div className="error">{error}</div> : <div className="error">Cotización no encontrada</div>}
        <Button onClick={() => navigate("/quotes")} className="btn--ghost" style={{ marginTop: 16, border: "none", fontWeight: 600, display: "flex", gap: 8 }}>
          <ReturnIcon /> Volver a cotizaciones
        </Button>
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
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Button
              type="button"
              onClick={openNewNoteModal}
              disabled={trackingSaving}
              className="btn--icon btn--ghost"
              title="Agregar nota"
              aria-label="Agregar nota"
            >
              <NoteIcon />
            </Button>
            <Button onClick={() => navigate("/quotes")} disabled={saving} className="btn--ghost" style={{ border: "none", fontWeight: 600, display: "flex", gap: 8 }}>
              <ReturnIcon /> Volver
            </Button>
          </div>
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
          <label className="field">
            <span className="label">Fecha de reactivación 1</span>
            <input type="date" value={fechaReactivacion1} onChange={(e) => setFechaReactivacion1(e.target.value)} className="input" />
          </label>
          <label className="field">
            <span className="label">Fecha de reactivación 2</span>
            <input type="date" value={fechaReactivacion2} onChange={(e) => setFechaReactivacion2(e.target.value)} className="input" />
          </label>
          <label className="field">
            <span className="label">Fecha de reactivación 3</span>
            <input type="date" value={fechaReactivacion3} onChange={(e) => setFechaReactivacion3(e.target.value)} className="input" />
          </label>
          <label className="field">
            <span className="label">Reactivación activa</span>
            <select value={reactivacionActiva} onChange={(e) => setReactivacionActiva(Number(e.target.value) as 1 | 2 | 3)} className="select">
              <option value={1}>Fecha 1</option>
              <option value={2}>Fecha 2</option>
              <option value={3}>Fecha 3</option>
            </select>
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

        <div className="sectionTitle" style={{ marginTop: 32 }}>Notas</div>
        <div className="divider" />

        {notes.length === 0 ? (
          <div className="hint">Todavía no hay notas.</div>
        ) : (
          <div className="stack">
            {notes.map((n) => (
              <div key={n.noteKey} className="card" style={{ padding: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                  <div style={{ fontWeight: 700 }}>
                    Nota{n.edited ? " (editada)" : ""}
                  </div>
                  <div className="hint">{formatDateTime(n.updatedAtIso)}</div>
                </div>
                <div className="hint" style={{ marginTop: 4 }}>Por: {n.who}</div>
                <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{n.text}</div>
                <div style={{ marginTop: 12, display: "flex", justifyContent: "flex-end" }}>
                  <Button onClick={() => openEditNoteModal(n.noteKey, n.text)} disabled={trackingSaving} className="btn--ghost">
                    Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="sectionTitle" style={{ marginTop: 32 }}>Historial</div>
        <div className="divider" />

        {trackingLoading ? (
          <div className="hint" style={{ marginTop: 10 }}>Cargando historial...</div>
        ) : tracking.length === 0 ? (
          <div className="hint" style={{ marginTop: 10 }}>Todavía no hay eventos en el historial.</div>
        ) : (
          <div className="stack" style={{ marginTop: 10 }}>
            {tracking.map((ev) => {
              const who = ev.usuario_nombre || ev.usuario_email || (ev.id_usuario ? "Usuario" : "Sistema");
              const title =
                ev.tipo_accion === "NOTA"
                  ? "Nota"
                  : ev.tipo_accion === "NOTA_EDITADA"
                    ? "Edición de nota"
                  : ev.tipo_accion === "CAMBIO_ESTADO"
                    ? "Cambio de estado"
                    : ev.tipo_accion === "CREACION"
                      ? "Creación"
                      : ev.tipo_accion;
              const estadoChange = ev.tipo_accion === "CAMBIO_ESTADO" ? extractEstadoChange(ev.metadata) : null;
              const createdEstado = ev.tipo_accion === "CREACION" ? extractCreationEstado(ev.metadata) : null;

              return (
                <div key={ev.id} className="card" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
                    <div style={{ fontWeight: 700 }}>{title}</div>
                    <div className="hint">{formatDateTime(ev.fecha_accion)}</div>
                  </div>
                  <div className="hint" style={{ marginTop: 4 }}>Por: {who}</div>
                  {estadoChange ? (
                    <div style={{ marginTop: 10 }}>Estado: {estadoChange.from} → {estadoChange.to}</div>
                  ) : null}
                  {ev.tipo_accion === "CREACION" ? (
                    <div style={{ marginTop: 10 }}>Cotización creada{createdEstado ? ` (estado: ${createdEstado})` : ""}</div>
                  ) : null}
                  {ev.observaciones ? (
                    <div style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{ev.observaciones}</div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}

        <div className="newActions">
          <Button
            disabled={
              saving ||
              (
                estado === q.estado &&
                proximaAlerta === (q.proxima_alerta ? q.proxima_alerta.split("T")[0] : "") &&
                fechaReactivacion1 === (q.fecha_reactivacion_1 ? q.fecha_reactivacion_1.split("T")[0] : "") &&
                fechaReactivacion2 === (q.fecha_reactivacion_2 ? q.fecha_reactivacion_2.split("T")[0] : "") &&
                fechaReactivacion3 === (q.fecha_reactivacion_3 ? q.fecha_reactivacion_3.split("T")[0] : "") &&
                reactivacionActiva === q.reactivacion_activa
              )
            }
            onClick={saveChanges}
            className="btn--primary minw-170"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {noteModalOpen ? (
        <div className="modalOverlay" onClick={() => (trackingSaving ? null : closeNoteModal())}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>{editingNoteKey ? "Editar nota" : "Agregar nota"}</h3>
            <p>Cotización #{q.id}</p>
            <div style={{ marginTop: 16 }}>
              <textarea
                value={noteModalValue}
                onChange={(e) => setNoteModalValue(e.target.value)}
                className="textarea"
                placeholder="Escribe una nota..."
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Button onClick={closeNoteModal} disabled={trackingSaving} className="btn--ghost">Cancelar</Button>
              <Button onClick={saveNoteFromModal} disabled={trackingSaving || !noteModalValue.trim()} className="btn--primary">
                {trackingSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

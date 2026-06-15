import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { NoteIcon, ReturnIcon } from "../../components/common/Icons";
import { DownloadIcon } from "lucide-react";
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

  const [activeTab, setActiveTab] = useState<"notas" | "historial">("notas");

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
    return (
      <div className="page" style={{ animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite" }}>
        <div className="pageHeader" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24, marginBottom: 24 }}>
          <div>
            <div style={{ width: 250, height: 38, background: "var(--border)", borderRadius: 6 }} />
            <div style={{ width: 180, height: 20, background: "var(--border)", borderRadius: 4, marginTop: 10 }} />
          </div>
        </div>
        <div className="quoteDetailGrid">
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div className="quoteHeaderCard" style={{ height: 120, border: "none", background: "var(--border)", opacity: 0.5 }} />
            <div style={{ height: 300, borderRadius: 12, background: "var(--border)", opacity: 0.3 }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="card" style={{ height: 180, border: "none", background: "var(--border)", opacity: 0.4 }} />
            <div className="card" style={{ height: 220, border: "none", background: "var(--border)", opacity: 0.3 }} />
          </div>
        </div>
      </div>
    );
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
      <div className="pageHeader" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24, marginBottom: 24 }}>
        <div>
          <h1 className="pageTitle">Cotizaciones</h1>
          <div className="pageSubtitle">
            <span onClick={() => navigate("/quotes")} style={{ cursor: "pointer" }}>Cotizaciones</span>
            {" > "}
            <b>Ver cotización</b>
          </div>
        </div>
        <div>
          <Button onClick={() => navigate("/quotes")} disabled={saving} className="btn--ghost" style={{ border: "none", fontWeight: 600, display: "flex", gap: 8 }}>
            <ReturnIcon /> Volver
          </Button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}

      <div className="quoteDetailGrid">
        {/* LEFT COLUMN: Quote Document Area */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          
          {/* Header Card (Light theme as requested) */}
          <div className="quoteHeaderCard">
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-main)", marginBottom: 8 }}>
                {c.nombre_empresa}
              </div>
              <div style={{ opacity: 0.8, fontSize: 14 }}>
                {c.contacto_principal ? `${c.contacto_principal} · ` : ""}
                {c.email || ""}
              </div>
            </div>
            <div style={{ textAlign: "right", opacity: 0.8, fontSize: 13, lineHeight: 1.6 }}>
              {c.direccion || ""} <br />
              {[c.provincia, c.pais].filter(Boolean).join(", ")}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 32, padding: "0 8px" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Cotización Nº</div>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{q.id}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Fechas</div>
              <div style={{ fontSize: 14 }}>
                Emisión: <span style={{ fontWeight: 500 }}>{formatDate(q.fecha_emision)}</span> <br />
                Vencimiento: <span style={{ fontWeight: 500 }}>{formatDate(q.fecha_vencimiento)}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 24, marginBottom: 32, display: "flex", flexDirection: "column" }}>
            <div style={{ marginBottom: 32 }}>
              <div className="quoteItemHeader">
                <div>Producto</div>
                <div>Cantidad</div>
                <div>Precio Unit.</div>
                <div>IVA</div>
                <div>Total</div>
              </div>
              {items.map((it) => (
                <div key={it.id} className="quoteItemRow">
                  <div style={{ fontWeight: 600 }}>{it.producto_nombre}</div>
                  <div>{it.cantidad}</div>
                  <div>${it.precio_unitario_momento} {q.moneda}</div>
                  <div>{it.iva_porcentaje}%</div>
                  <div style={{ fontWeight: 600 }}>${(Number(it.precio_unitario_momento) * it.cantidad).toFixed(2)}</div>
                </div>
              ))}
            </div>

            <div style={{ alignSelf: "flex-end", width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span className="hint">Subtotal:</span>
                <span style={{ fontWeight: 600 }}>${q.subtotal} {q.moneda}</span>
              </div>
              {Number(q.descuento_global) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                  <span className="hint">Descuento ({q.descuento_porcentaje_global}%):</span>
                  <span style={{ fontWeight: 600, color: "var(--danger)" }}>-${q.descuento_global}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                <span className="hint">IVA ({q.iva_porcentaje}%):</span>
                <span style={{ fontWeight: 600 }}>Incluido</span>
              </div>
              <div style={{ height: 1, background: "rgba(0,0,0,0.1)", margin: "8px 0" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 18, fontWeight: 700 }}>
                <span>Total Final:</span>
                <span>${q.total_final} {q.moneda}</span>
              </div>
            </div>
          </div>

          {/* Tabs Section for Notes and History */}
          <div style={{ marginTop: 5 }}>
            <div className="quotesTabs" style={{ marginBottom: 24 }}>
              <Button
                className={activeTab === "notas" ? "btn--primary" : "btn--ghost"}
                onClick={() => setActiveTab("notas")}
              >
                Notas ({notes.length})
              </Button>
              <Button
                className={activeTab === "historial" ? "btn--primary" : "btn--ghost"}
                onClick={() => setActiveTab("historial")}
              >
                Historial ({tracking.length})
              </Button>
            </div>

            {activeTab === "notas" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                  <div className="sectionTitle" style={{ margin: 0 }}>Notas</div>
                  <Button onClick={openNewNoteModal} disabled={trackingSaving} className="btn--ghost" style={{ fontSize: 13, padding: "6px 12px" }}>
                    <NoteIcon size={16} /> Agregar
                  </Button>
                </div>
                <div className="divider" />

                {notes.length === 0 ? (
                  <div className="hint">Todavía no hay notas.</div>
                ) : (
                  <div className="stack" style={{ maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
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
              </div>
            )}

            {activeTab === "historial" && (
              <div>
                <div className="sectionTitle">Historial</div>
                <div className="divider" />

                {trackingLoading ? (
                  <div className="hint" style={{ marginTop: 10 }}>Cargando historial...</div>
                ) : tracking.length === 0 ? (
                  <div className="hint" style={{ marginTop: 10 }}>Todavía no hay eventos en el historial.</div>
                ) : (
                  <div className="stack" style={{ marginTop: 10, maxHeight: 400, overflowY: "auto", paddingRight: 8 }}>
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
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 24 }}>
          
          {/* Action Buttons */}
          <div className="card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            <Button
              className="btn--primary"
              style={{ width: "100%", justifyContent: "center", padding: "12px" }}
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
            >
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>

            <Button
              className="btn--secondary"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={async () => {
                try {
                  const pdf = await quoteService.downloadQuotePdf(Number(id));
                  const url = URL.createObjectURL(pdf.blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = pdf.filename ?? `cotizacion-${id}.pdf`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  showToast({ type: "error", text: "No se pudo descargar el PDF" });
                }
              }}
            >
              <DownloadIcon size={18} /> Descargar PDF
            </Button>
          </div>

          {/* Client Details */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 600, marginBottom: 12, opacity: 0.8, fontSize: 14 }}>Datos del Cliente</div>
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
                <div className="clientAvatarLg" style={{ width: 44, height: 44, fontSize: 16, background: "var(--primary)", color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {c.nombre_empresa?.substring(0, 2).toUpperCase() || "C"}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.nombre_empresa}</div>
                  {c.contacto_principal && <div style={{ fontSize: 13, opacity: 0.8 }}>{c.contacto_principal}</div>}
                </div>
              </div>
              <div style={{ fontSize: 13, opacity: 0.8, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ wordBreak: "break-all" }}><strong>Email:</strong> {c.email || "-"}</div>
                <div><strong>Teléfono:</strong> {c.telefono || "-"}</div>
                <div><strong>CUIT:</strong> {c.cuit_tax_id || "-"}</div>
              </div>
            </div>
          </div>

          {/* Additional info (Plazo, forma de pago, lugar) */}
          {(q.plazo_entrega || q.forma_pago || q.lugar_entrega) && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontWeight: 600, marginBottom: 12, opacity: 0.8, fontSize: 14 }}>Información Adicional</div>
              <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
                {q.plazo_entrega && <div><strong>Plazo:</strong> {q.plazo_entrega}</div>}
                {q.forma_pago && <div><strong>Pago:</strong> {q.forma_pago}</div>}
                {q.lugar_entrega && <div><strong>Entrega:</strong> {q.lugar_entrega}</div>}
              </div>
            </div>
          )}

          {/* Control y Seguimiento Form */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontWeight: 600, marginBottom: 12, opacity: 0.8, fontSize: 14 }}>Control y Seguimiento</div>
            <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
              <label className="field" style={{ margin: 0 }}>
                <span className="label">Estado</span>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} className="select" style={{ background: "var(--background)" }}>
                  <option value="BORRADOR">Borrador</option>
                  <option value="EMITIDA">Emitida</option>
                  <option value="ENVIADA">Enviada</option>
                  <option value="POSPUESTA">Pospuesta</option>
                  <option value="PEND_REACTIVACION">Pend. reactivación</option>
                  <option value="CERRADA_PERDIDA">Cerrada perdida</option>
                  <option value="CERRADA_GANADA">Cerrada ganada</option>
                </select>
              </label>
              
              <label className="field" style={{ margin: 0 }}>
                <span className="label">Próxima Alerta</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <input type="date" value={proximaAlerta} onChange={(e) => setProximaAlerta(e.target.value)} className="input" style={{ background: "var(--background)" }} />
                  {proximaAlerta && <button onClick={() => setProximaAlerta("")} style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: 13, padding: "0 8px" }}>✕</button>}
                </div>
              </label>

              <label className="field" style={{ margin: 0 }}>
                <span className="label">Reactivación activa</span>
                <select value={reactivacionActiva} onChange={(e) => setReactivacionActiva(Number(e.target.value) as 1 | 2 | 3)} className="select" style={{ background: "var(--background)" }}>
                  <option value={1}>Fecha 1</option>
                  <option value={2}>Fecha 2</option>
                  <option value={3}>Fecha 3</option>
                </select>
              </label>

              {reactivacionActiva === 1 && (
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Fecha reactivación 1</span>
                  <input type="date" value={fechaReactivacion1} onChange={(e) => setFechaReactivacion1(e.target.value)} className="input" style={{ background: "var(--background)" }} />
                </label>
              )}
              {reactivacionActiva === 2 && (
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Fecha reactivación 2</span>
                  <input type="date" value={fechaReactivacion2} onChange={(e) => setFechaReactivacion2(e.target.value)} className="input" style={{ background: "var(--background)" }} />
                </label>
              )}
              {reactivacionActiva === 3 && (
                <label className="field" style={{ margin: 0 }}>
                  <span className="label">Fecha reactivación 3</span>
                  <input type="date" value={fechaReactivacion3} onChange={(e) => setFechaReactivacion3(e.target.value)} className="input" style={{ background: "var(--background)" }} />
                </label>
              )}
            </div>
          </div>
          
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

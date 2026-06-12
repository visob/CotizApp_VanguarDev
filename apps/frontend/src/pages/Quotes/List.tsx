import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ActionMenu } from "../../components/common/ActionMenu";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import * as quoteService from "../../services/quote.service";
import { getErrorMessage } from "../../utils/feedback";
import "../../styles/quotes.css";

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

export default function QuotesList() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<quoteService.QuoteListItem[]>([]);
  const [tab, setTab] = useState<"todos" | "ultimas" | "reactivar">("todos");
  const [q, setQ] = useState("");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const [statusModalQuote, setStatusModalQuote] = useState<quoteService.QuoteListItem | null>(null);
  const [newStatus, setNewStatus] = useState("");

  const [alertModalQuote, setAlertModalQuote] = useState<quoteService.QuoteListItem | null>(null);
  const [newAlertDate, setNewAlertDate] = useState("");

  const [noteModalQuote, setNoteModalQuote] = useState<quoteService.QuoteListItem | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

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

  async function reloadQuotes() {
    setLoading(true);
    setError(null);
    try {
      if (tab === "reactivar") {
        const data = await quoteService.listReactivationAlerts();
        setQuotes(data);
        return;
      }
      const estadoParam = undefined;
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
      setError(getErrorMessage(err, {}, "No se pudieron cargar las cotizaciones"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

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

  async function handleUpdateStatus() {
    if (!statusModalQuote || !newStatus) return;
    if (newStatus === "POSPUESTA" && !newAlertDate) {
      setError("Para posponer la cotización debés indicar una fecha de reactivación futura");
      return;
    }
    try {
      await quoteService.updateQuote(statusModalQuote.id, {
        estado: newStatus,
        fecha_reactivacion_activa: newStatus === "POSPUESTA" && newAlertDate ? `${newAlertDate}T00:00:00.000Z` : undefined
      });
      setStatusModalQuote(null);
      setNewAlertDate("");
      showToast({ type: "success", text: "Estado de la cotización actualizado" });
      void reloadQuotes();
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo actualizar el estado"));
    }
  }

  async function handleUpdateAlert() {
    if (!alertModalQuote) return;
    try {
      await quoteService.updateQuote(alertModalQuote.id, {
        proxima_alerta: newAlertDate ? `${newAlertDate}T00:00:00.000Z` : null
      });
      setAlertModalQuote(null);
      showToast({ type: "success", text: "Alerta actualizada correctamente" });
      void reloadQuotes();
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo actualizar la alerta"));
    }
  }

  async function handleAddNote() {
    if (!noteModalQuote) return;
    const nota = noteText.trim();
    if (!nota) return;
    setNoteSaving(true);
    try {
      const noteKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : String(Date.now());
      await quoteService.addQuoteTrackingNote(noteModalQuote.id, { nota, metadata: { noteKey } });
      setNoteModalQuote(null);
      setNoteText("");
      showToast({ type: "success", text: "Nota agregada correctamente" });
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo agregar la nota"));
    } finally {
      setNoteSaving(false);
    }
  }

  return (
    <div className="page">
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
              <Button disabled={loading} onClick={() => navigate("/quotes/create")} className="btn--primary">
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
                  onClick={() => setTab(t.key as any)}
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
                    <td className="tableActionsCell">
                      <ActionMenu
                        items={[
                          {
                            label: "Ver",
                            onClick: () => navigate(`/quotes/${r.id}`)
                          },
                          {
                            label: "Agregar Nota",
                            onClick: () => {
                              setNoteText("");
                              setNoteModalQuote(r);
                            }
                          },
                          {
                            label: "Cambiar Estado",
                            onClick: () => {
                              setNewStatus(r.estado);
                              setNewAlertDate(r.proxima_alerta ? r.proxima_alerta.split("T")[0] : "");
                              setStatusModalQuote(r);
                            }
                          },
                          {
                            label: "Modificar Alerta",
                            onClick: () => {
                              setNewAlertDate(r.proxima_alerta ? r.proxima_alerta.split("T")[0] : "");
                              setAlertModalQuote(r);
                            }
                          },
                          {
                            label: "Descargar PDF",
                            onClick: async () => {
                              try {
                                const pdf = await quoteService.downloadQuotePdf(r.id);
                                downloadBlob(pdf.blob, pdf.filename ?? `cotizacion-${r.id}.pdf`);
                              } catch (err) {
                                setError(getErrorMessage(err, {}, "No se pudo descargar el PDF"));
                              }
                            }
                          }
                        ]}
                      />
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

      {statusModalQuote && (
        <div className="modalOverlay" onClick={() => setStatusModalQuote(null)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Cambiar Estado</h3>
            <p>Cotización #{statusModalQuote.id}</p>
            <div style={{ marginTop: 16 }}>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="select" style={{ width: "100%" }}>
                <option value="BORRADOR">Borrador</option>
                <option value="EMITIDA">Emitida</option>
                <option value="ENVIADA">Enviada</option>
                <option value="POSPUESTA">Pospuesta</option>
                <option value="PEND_REACTIVACION">Pend. reactivación</option>
                <option value="CERRADA_PERDIDA">Cerrada perdida</option>
                <option value="CERRADA_GANADA">Cerrada ganada</option>
              </select>
              {newStatus === "POSPUESTA" ? (
                <div style={{ marginTop: 12 }}>
                  <input
                    type="date"
                    value={newAlertDate}
                    onChange={(e) => setNewAlertDate(e.target.value)}
                    className="input"
                    style={{ width: "100%" }}
                  />
                  <div className="hint" style={{ marginTop: 6 }}>
                    Al posponer, la fecha de reactivación futura es obligatoria.
                  </div>
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Button onClick={() => setStatusModalQuote(null)} className="btn--ghost">Cancelar</Button>
              <Button onClick={handleUpdateStatus} className="btn--primary">Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {alertModalQuote && (
        <div className="modalOverlay" onClick={() => setAlertModalQuote(null)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Modificar Próxima Alerta</h3>
            <p>Cotización #{alertModalQuote.id}</p>
            <div style={{ marginTop: 16 }}>
              <input type="date" value={newAlertDate} onChange={(e) => setNewAlertDate(e.target.value)} className="input" style={{ width: "100%" }} />
              <button onClick={() => setNewAlertDate("")} style={{ marginTop: 8, background: "none", border: "none", color: "var(--color-primary)", cursor: "pointer", fontSize: 13 }}>Limpiar alerta</button>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Button onClick={() => setAlertModalQuote(null)} className="btn--ghost">Cancelar</Button>
              <Button onClick={handleUpdateAlert} className="btn--primary">Guardar</Button>
            </div>
          </div>
        </div>
      )}

      {noteModalQuote && (
        <div className="modalOverlay" onClick={() => (noteSaving ? null : setNoteModalQuote(null))}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Agregar Nota</h3>
            <p>Cotización #{noteModalQuote.id}</p>
            <div style={{ marginTop: 16 }}>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="textarea"
                placeholder="Escribe una nota..."
              />
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 24, justifyContent: "flex-end" }}>
              <Button onClick={() => setNoteModalQuote(null)} disabled={noteSaving} className="btn--ghost">Cancelar</Button>
              <Button onClick={handleAddNote} disabled={noteSaving || !noteText.trim()} className="btn--primary">
                {noteSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

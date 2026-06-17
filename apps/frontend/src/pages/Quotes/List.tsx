import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ActionMenu } from "../../components/common/ActionMenu";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import * as quoteService from "../../services/quote.service";
import { extractIsoDate, formatIsoDate, getLocalTodayIsoDate } from "../../utils/date";
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
  const [vencFromDate, setVencFromDate] = useState<string>("");
  const [vencToDate, setVencToDate] = useState<string>("");
  const [estadoFilter, setEstadoFilter] = useState<string>("");
  const [tipoClienteFilter, setTipoClienteFilter] = useState<string>("");
  const [orderBy, setOrderBy] = useState<
    "reactivacion" | "vencimiento" | "estado" | "cliente" | "tipo_cliente" | "monto" | "emision" | "id"
  >("reactivacion");
  const [orderDir, setOrderDir] = useState<"asc" | "desc">("asc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [statusModalQuote, setStatusModalQuote] = useState<quoteService.QuoteListItem | null>(null);
  const [newStatus, setNewStatus] = useState("");

  const [alertModalQuote, setAlertModalQuote] = useState<quoteService.QuoteListItem | null>(null);
  const [newAlertDate, setNewAlertDate] = useState("");

  const [noteModalQuote, setNoteModalQuote] = useState<quoteService.QuoteListItem | null>(null);
  const [newNote, setNewNote] = useState("");
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
        const dir = orderDir === "asc" ? 1 : -1;
        const sorted = [...data].sort((a, b) => {
          if (orderBy === "id") return dir * (a.id - b.id);
          if (orderBy === "cliente") return dir * a.cliente_nombre_empresa.localeCompare(b.cliente_nombre_empresa);
          if (orderBy === "estado") return dir * a.estado.localeCompare(b.estado);
          if (orderBy === "tipo_cliente") return dir * String(a.cliente_clasificacion ?? "").localeCompare(String(b.cliente_clasificacion ?? ""));
          if (orderBy === "monto") return dir * (Number(a.total_final) - Number(b.total_final));
          if (orderBy === "vencimiento") return dir * (new Date(a.fecha_vencimiento ?? 0).getTime() - new Date(b.fecha_vencimiento ?? 0).getTime());
          if (orderBy === "emision") return dir * (new Date(a.fecha_emision).getTime() - new Date(b.fecha_emision).getTime());
          return dir * (new Date(a.fecha_reactivacion_activa ?? a.proxima_alerta ?? 0).getTime() - new Date(b.fecha_reactivacion_activa ?? b.proxima_alerta ?? 0).getTime());
        });
        setQuotes(sorted);
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
        estado: estadoFilter || estadoParam || undefined,
        tipo_cliente: tipoClienteFilter || undefined,
        from,
        to,
        venc_from: toIsoStartOfDay(vencFromDate) ?? undefined,
        venc_to: toIsoEndOfDay(vencToDate) ?? undefined,
        order_by: orderBy,
        order_dir: orderDir
      });
      setQuotes(data);
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudieron cargar las cotizaciones"));
    } finally {
      setLoading(false);
    }
  }

  function toggleSort(field: typeof orderBy) {
    if (orderBy === field) {
      setOrderDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setOrderBy(field);
    setOrderDir("asc");
  }

  function sortIndicator(field: typeof orderBy) {
    if (orderBy !== field) return "";
    return orderDir === "asc" ? " ↑" : " ↓";
  }

  useEffect(() => {
    void reloadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    void reloadQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderBy, orderDir, estadoFilter, tipoClienteFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void reloadQuotes();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, fromDate, toDate, vencFromDate, vencToDate]);

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
    return formatIsoDate(iso, iso);
  }

  function formatAlert(iso: string | null) {
    if (!iso) return "-";
    const isoDate = extractIsoDate(iso);
    if (!isoDate) return "-";
    return isoDate === getLocalTodayIsoDate() ? "Hoy" : formatIsoDate(iso, "-");
  }

  function downloadCsv() {
    const header = ["Cliente", "ID", "Fecha", "Vencimiento", "Monto", "Moneda", "TipoCliente", "Estado", "ProxAlerta"].join(",");
    const rows = quotes.map((r) => {
      const values = [
        r.cliente_nombre_empresa,
        `#${r.id}`,
        formatDate(r.fecha_emision),
        r.fecha_vencimiento ? formatDate(r.fecha_vencimiento) : "",
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
    try {
      await quoteService.updateQuote(statusModalQuote.id, {
        estado: newStatus,
        fecha_reactivacion_activa: newStatus === "POSPUESTA" && newAlertDate ? `${newAlertDate}:00.000Z` : undefined
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
        proxima_alerta: newAlertDate ? `${newAlertDate}:00.000Z` : null
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
    const nota = newNote.trim();
    if (!nota) return;
    setNoteSaving(true);
    try {
      const noteKey =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? (crypto as any).randomUUID() : String(Date.now());
      await quoteService.addQuoteTrackingNote(noteModalQuote.id, { nota, metadata: { noteKey } });
      setNoteModalQuote(null);
      setNewNote("");
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
              <Button disabled={loading} onClick={() => navigate("/quotes/create")} className="btn--gradient">
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

          <div className="filterToolbar" style={{ marginBottom: showAdvancedFilters ? 16 : 24 }}>
            <input placeholder="Buscar cliente o ID..." value={q} onChange={(e) => setQ(e.target.value)} className="searchBarInput" />
            <div className="dateRange" style={{ flex: "0 1 auto" }}>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input" style={{ width: "130px" }} />
              <span className="hint">—</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input" style={{ width: "130px" }} />
            </div>
            <Button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="btn--ghost" style={{ display: "flex", gap: 8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M4 4H20L14 12V19L10 21V12L4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> Filtros
            </Button>
          </div>

          {showAdvancedFilters && (
            <div className="filterToolbar" style={{ padding: "16px", background: "transparent", border: "1px solid var(--border)", borderRadius: "12px", marginTop: "-8px", marginBottom: "24px" }}>
              <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="select" style={{ backgroundColor: "var(--surface)", flex: 1 }}>
                <option value="">Estado (todos)</option>
                <option value="BORRADOR">Borrador</option>
                <option value="EMITIDA">Emitida</option>
                <option value="ENVIADA">Enviada</option>
                <option value="POSPUESTA">Pospuesta</option>
                <option value="PEND_REACTIVACION">Pend. reactivación</option>
                <option value="CERRADA_PERDIDA">Cerrada perdida</option>
                <option value="CERRADA_GANADA">Cerrada ganada</option>
              </select>
              <select value={tipoClienteFilter} onChange={(e) => setTipoClienteFilter(e.target.value)} className="select" style={{ backgroundColor: "var(--surface)", flex: 1 }}>
                <option value="">Tipo (todos)</option>
                {Array.from(new Set(quotes.map((x) => x.cliente_clasificacion).filter(Boolean) as string[]))
                  .sort((a, b) => a.localeCompare(b))
                  .map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
              </select>
              <Button className="btn--ghost" onClick={() => { setEstadoFilter(""); setTipoClienteFilter(""); setQ(""); setFromDate(""); setToDate(""); }} style={{ flex: "0 0 auto", backgroundColor: "var(--surface)", color: "var(--text-muted)", fontSize: "0.85rem", border: "1px solid var(--border)" }}>
                Borrar filtros
              </Button>
            </div>
          )}
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
                <th>
                  <button type="button" onClick={() => toggleSort("cliente")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                    Cliente{sortIndicator("cliente")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("id")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                    ID{sortIndicator("id")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("emision")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                    Fecha{sortIndicator("emision")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("vencimiento")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                    Venc.{sortIndicator("vencimiento")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("monto")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                    Monto{sortIndicator("monto")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("tipo_cliente")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                    Tipo de cliente{sortIndicator("tipo_cliente")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("estado")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                    Estado{sortIndicator("estado")}
                  </button>
                </th>
                <th>
                  <button type="button" onClick={() => toggleSort("reactivacion")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}>
                    Prox. alerta{sortIndicator("reactivacion")}
                  </button>
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((r) => {
                const st = statusStyle(r.estado);
                return (
                  <tr key={r.id} onClick={() => navigate(`/quotes/${r.id}`)} style={{ cursor: "pointer" }} className="tableRowHover">
                    <td className="colCheckbox" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" />
                    </td>
                    <td>{r.cliente_nombre_empresa}</td>
                    <td className="cellMuted">#{r.id}</td>
                    <td className="cellMuted">{formatDate(r.fecha_emision)}</td>
                    <td className="cellMuted">{r.fecha_vencimiento ? formatDate(r.fecha_vencimiento) : "-"}</td>
                    <td className="cellMuted">
                      ${r.total_final} {r.moneda}
                    </td>
                    <td className="cellMuted">{r.cliente_clasificacion ?? "-"}</td>
                    <td>
                      <span className={st.className}>{st.label}</span>
                    </td>
                    <td className="cellMuted">{formatAlert(r.proxima_alerta)}</td>
                    <td className="tableActionsCell" onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        items={[
                          {
                            label: "Ver",
                            onClick: () => navigate(`/quotes/${r.id}`)
                          },
                          {
                            label: "Agregar Nota",
                            onClick: () => {
                              setNewNote("");
                              setNoteModalQuote(r);
                            }
                          },
                          {
                            label: "Cambiar Estado",
                            onClick: () => {
                              setNewStatus(r.estado);
                              setNewAlertDate(r.proxima_alerta ? r.proxima_alerta.slice(0, 16) : "");
                              setStatusModalQuote(r);
                            }
                          },
                          {
                            label: "Modificar Alerta",
                            onClick: () => {
                              setNewAlertDate(r.proxima_alerta ? r.proxima_alerta.slice(0, 16) : "");
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
                  <td className="cellEmpty" colSpan={10}>
                    No hay cotizaciones para mostrar
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {statusModalQuote ? createPortal(
        <div className="modalOverlay" onClick={() => setStatusModalQuote(null)}>
          <div className="modalContent" onClick={(event) => event.stopPropagation()}>
            <h3>Cambiar Estado</h3>
            <p>Cotización #{statusModalQuote.id}</p>
            <div className="modalField">
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="select modalControl">
                <option value="BORRADOR">Borrador</option>
                <option value="EMITIDA">Emitida</option>
                <option value="ENVIADA">Enviada</option>
                <option value="POSPUESTA">Pospuesta</option>
                <option value="CERRADA_GANADA">Cerrada ganada</option>
                <option value="CERRADA_PERDIDA">Cerrada perdida</option>
                <option value="VENCIDA">Vencida</option>
              </select>
            </div>
            <div className="modalActions">
              <Button onClick={() => setStatusModalQuote(null)} className="btn--ghost">Cancelar</Button>
              <Button disabled={loading} onClick={() => void handleUpdateStatus()} className="btn--primary">Guardar</Button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {alertModalQuote ? createPortal(
        <div className="modalOverlay" onClick={() => setAlertModalQuote(null)}>
          <div className="modalContent" onClick={(event) => event.stopPropagation()}>
            <h3>Modificar Alerta</h3>
            <p>Cotización #{alertModalQuote.id}</p>
            <div className="modalField">
              <input type="datetime-local" value={newAlertDate} onChange={(e) => setNewAlertDate(e.target.value)} className="input modalControl" />
              <button onClick={() => setNewAlertDate("")} style={{ marginTop: 8, background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: 13 }}>Limpiar alerta</button>
            </div>
            <div className="modalActions">
              <Button onClick={() => setAlertModalQuote(null)} className="btn--ghost">Cancelar</Button>
              <Button disabled={loading} onClick={() => void handleUpdateAlert()} className="btn--primary">Guardar</Button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}

      {noteModalQuote ? createPortal(
        <div className="modalOverlay" onClick={() => (noteSaving ? null : setNoteModalQuote(null))}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Agregar Nota</h3>
            <p>Cotización #{noteModalQuote.id}</p>
            <div className="modalField">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="textarea modalControl"
                placeholder="Escribe una nota..."
              />
            </div>
            <div className="modalActions">
              <Button onClick={() => setNoteModalQuote(null)} disabled={noteSaving} className="btn--ghost">Cancelar</Button>
              <Button onClick={() => void handleAddNote()} disabled={noteSaving || !newNote.trim()} className="btn--primary">
                {noteSaving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

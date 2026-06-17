import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { FilePlus, UserPlus, PackagePlus, AlarmClock, MessageSquare, Send, Users, CheckCircle, Search } from "lucide-react";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import * as dashboardService from "../../services/dashboard.service";
import * as quoteService from "../../services/quote.service";
import { formatIsoDate } from "../../utils/date";
import { getErrorMessage } from "../../utils/feedback";
import { NotesWidget } from "./NotesWidget";
import "../../styles/dashboard.css";

function formatDate(iso: string | null) {
  return formatIsoDate(iso, iso ?? "-");
}

function formatKpiDelta(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return { label: "= 0%", tone: "neutral" as const };
    }
    return { label: "↗ +100%", tone: "positive" as const };
  }

  const percentage = Math.round(((current - previous) / previous) * 100);
  if (percentage > 0) {
    return { label: `↗ +${percentage}%`, tone: "positive" as const };
  }
  if (percentage < 0) {
    return { label: `↘ ${percentage}%`, tone: "negative" as const };
  }
  return { label: "= 0%", tone: "neutral" as const };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<dashboardService.DashboardPeriod>("week");
  const [metrics, setMetrics] = useState<dashboardService.DashboardMetrics | null>(null);
  const [items, setItems] = useState<dashboardService.DashboardReactivation[]>([]);
  const [statusModalQuote, setStatusModalQuote] = useState<quoteService.QuoteReactivationAlert | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [newAlertDate, setNewAlertDate] = useState("");
  const [newNote, setNewNote] = useState("");

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getDashboard({ period });
      setMetrics(data.metrics);
      setItems(data.reactivations);
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudieron cargar los datos del dashboard"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, [period]);

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
      setNewNote("");
      showToast({ type: "success", text: "Cotización actualizada correctamente" });
      void reload();
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo actualizar la cotización"));
    }
  }

  const quotesSentDelta = formatKpiDelta(metrics?.quotesSentCurrent ?? 0, metrics?.quotesSentPrevious ?? 0);
  const clientsContactedDelta = formatKpiDelta(metrics?.clientsContactedCurrent ?? 0, metrics?.clientsContactedPrevious ?? 0);
  const salesWonDelta = formatKpiDelta(metrics?.salesWonCurrent ?? 0, metrics?.salesWonPrevious ?? 0);

  return (
    <div className="page" style={{ height: "calc(100vh - 100px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="stack" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle"><span style={{ fontWeight: 400 }}>Hola,</span> {user?.nombre || "Usuario"}</h1>
            <div className="pageSubtitle">Resumen de tu actividad y próximas alertas</div>
          </div>
          <div className="pageHeaderSearch">
            <Search size={18} className="pageHeaderSearchIcon" />
            <input type="text" placeholder="Buscar en la app..." className="pageHeaderSearchInput" />
          </div>
        </div>

      {/* Main Layout: 2 Columns */}
      <div className="dashboardMainGrid">
        {/* Left Column */}
        <div className="dashboardColLeft">
          {/* Ultimos 30 dias */}
          <div className="dashboardSection">
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600 }}>Tus ultimos 30 dias</h3>
            <div className="kpiGrid">
              <div className="kpiCard kpiCard--animGradient1">
                <div className="kpiTop">
                  <div className="kpiLabel">Cotizaciones<br/><strong>enviadas</strong></div>
                  <div className={`kpiBadge ${quotesSentDelta.tone === "positive" ? "kpiBadge--positive" : quotesSentDelta.tone === "negative" ? "kpiBadge--negative" : ""}`}>
                    {quotesSentDelta.label}
                  </div>
                </div>
                <div className="kpiBottom">
                  <div className="kpiValue">{metrics?.quotesSentCurrent ?? 0}</div>
                  <div className="kpiIconWrap"><Send size={20} /></div>
                </div>
              </div>
              <div className="kpiCard kpiCard--animGradient3">
                <div className="kpiTop">
                  <div className="kpiLabel">Clientes<br/><strong>contactados</strong></div>
                  <div className={`kpiBadge ${clientsContactedDelta.tone === "positive" ? "kpiBadge--positive" : clientsContactedDelta.tone === "negative" ? "kpiBadge--negative" : ""}`}>
                    {clientsContactedDelta.label}
                  </div>
                </div>
                <div className="kpiBottom">
                  <div className="kpiValue">{metrics?.clientsContactedCurrent ?? 0}</div>
                  <div className="kpiIconWrap"><Users size={20} /></div>
                </div>
              </div>
              <div className="kpiCard kpiCard--animGradient2">
                <div className="kpiTop">
                  <div className="kpiLabel">Ventas<br/><strong>cerradas</strong></div>
                  <div className={`kpiBadge ${salesWonDelta.tone === "positive" ? "kpiBadge--positive" : salesWonDelta.tone === "negative" ? "kpiBadge--negative" : ""}`}>
                    {salesWonDelta.label}
                  </div>
                </div>
                <div className="kpiBottom">
                  <div className="kpiValue">{metrics?.salesWonCurrent ?? 0}</div>
                  <div className="kpiIconWrap"><CheckCircle size={20} /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboardSectionHeader" style={{ marginTop: 8 }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Próximas reactivaciones</h3>
            <div className="dashboardTabs">
              <button className={`dashboardTab ${period === "week" ? "dashboardTab--active" : ""}`} onClick={() => setPeriod("week")}>Esta semana</button>
              <button className={`dashboardTab ${period === "month" ? "dashboardTab--active" : ""}`} onClick={() => setPeriod("month")}>Este mes</button>
            </div>
          </div>
          
          <div className="dashWidget">
            <div className="dashTableWrap hide-scrollbar">
              {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}
              {loading ? <div className="hint" style={{ marginBottom: 16 }}>Cargando dashboard...</div> : null}

              <table className="dashTable">
                <thead>
                  <tr>
                    <th>Nombre / Razón Social</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th style={{ textAlign: "center" }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.cliente_nombre_empresa}</td>
                      <td className="cellMuted">{formatDate(item.fecha_reactivacion_activa || item.fecha_emision)}</td>
                      <td>
                        <span className={`statusPill ${item.estado === "VENCIDO" ? "statusPill--danger" : "statusPill--success"}`}>
                          {item.estado === "PEND_REACTIVACION" ? "Próximo" : item.estado}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className="dashActions">
                          <button 
                            className="iconBtn"
                            onClick={() => {
                              setNewStatus(item.estado);
                              setNewAlertDate(item.fecha_reactivacion_activa ? item.fecha_reactivacion_activa.split("T")[0] : "");
                              setStatusModalQuote(item as unknown as quoteService.QuoteReactivationAlert);
                            }}
                            title="Gestionar Alarma"
                          >
                            <AlarmClock size={16} />
                          </button>
                          <button 
                            className="iconBtn"
                            onClick={() => navigate(`/quotes/${item.id}`)}
                            title="Ver Mensajes/Cotización"
                          >
                            <MessageSquare size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!loading && items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="cellEmpty">
                        {period === "week" ? "No hay reactivaciones previstas para esta semana." : "No hay reactivaciones previstas para este mes."}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Notas & Accesos */}
        <div className="dashboardColRight">
          <div className="dashboardSection" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600 }}>Notas</h3>
            <div className="hint" style={{ marginBottom: 12 }}>Tus notas quedan guardadas por usuario.</div>
            <NotesWidget />
          </div>

          <div className="dashboardSection" style={{ marginTop: 24 }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600 }}>Accesos rápidos</h3>
            <div className="quickActionsGrid">
              <button className="quickBtn" onClick={() => navigate("/quotes/create")}>
                <span className="quickIcon"><FilePlus size={20} /></span>
                <span className="quickLabel">Nueva<br/><strong>cotización</strong></span>
              </button>
              <div className="quickActionsRow">
                <button className="quickBtn" onClick={() => navigate("/clients/new")}>
                  <span className="quickIcon"><UserPlus size={20} /></span>
                  <span className="quickLabel">Nuevo<br/><strong>cliente</strong></span>
                </button>
                <button className="quickBtn" onClick={() => navigate("/products/new")}>
                  <span className="quickIcon"><PackagePlus size={20} /></span>
                  <span className="quickLabel">Nuevo<br/><strong>producto</strong></span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {statusModalQuote ? createPortal(
        <div className="modalOverlay" onClick={() => setStatusModalQuote(null)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Actualizar Estado</h3>
            <p>Cotización #{statusModalQuote.id}</p>
            <div className="modalField">
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="select modalControl">
                <option value="EMITIDA">Emitida</option>
                <option value="ENVIADA">Enviada</option>
                <option value="POSPUESTA">Pospuesta</option>
                <option value="CERRADA_GANADA">Cerrada ganada</option>
                <option value="CERRADA_PERDIDA">Cerrada perdida</option>
                <option value="VENCIDA">Vencida</option>
              </select>
            </div>
            <div className="modalField">
              <textarea
                className="textarea modalControl"
                placeholder="Nota de seguimiento (opcional)..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
              />
            </div>
            <div className="modalActions">
              <Button onClick={() => setStatusModalQuote(null)} className="btn--ghost">Cancelar</Button>
              <Button disabled={loading} onClick={() => void handleUpdateStatus()} className="btn--primary">
                Guardar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

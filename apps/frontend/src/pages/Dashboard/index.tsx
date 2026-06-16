import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePlus, UserPlus, PackagePlus, AlarmClock, MessageSquare, Send, Users, CheckCircle, Search } from "lucide-react";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import { useAuth } from "../../context/AuthContext";
import * as quoteService from "../../services/quote.service";
import { getErrorMessage } from "../../utils/feedback";
import { NotesWidget } from "./NotesWidget";
import "../../styles/dashboard.css";

function formatDate(iso: string | null) {
  if (!iso) return "-";
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleDateString("es-AR") : iso;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<quoteService.QuoteReactivationAlert[]>([]);
  const [statusModalQuote, setStatusModalQuote] = useState<quoteService.QuoteReactivationAlert | null>(null);
  const [newStatus, setNewStatus] = useState("");
  const [newAlertDate, setNewAlertDate] = useState("");

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await quoteService.listReactivationAlerts();
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudieron cargar las alertas de reactivación"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

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
      showToast({ type: "success", text: "Cotización actualizada correctamente" });
      void reload();
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudo actualizar la cotización"));
    }
  }

  return (
    <div className="page" style={{ height: "calc(100vh - 100px)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div className="stack" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle"><span style={{ fontWeight: 400 }}>Hola,</span> {user?.nombre || "Usuario"} {user?.apellido || ""}</h1>
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
          {/* Tu mes en números */}
          <div className="dashboardSection">
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: 600 }}>Tu mes en números</h3>
            <div className="kpiGrid">
              <div className="kpiCard kpiCard--animGradient1">
                <div className="kpiTop">
                  <div className="kpiLabel">Cotizaciones<br/><strong>enviadas</strong></div>
                  <div className="kpiBadge kpiBadge--positive">↗ +25%</div>
                </div>
                <div className="kpiBottom">
                  <div className="kpiValue">25</div>
                  <div className="kpiIconWrap"><Send size={20} /></div>
                </div>
              </div>
              <div className="kpiCard kpiCard--animGradient3">
                <div className="kpiTop">
                  <div className="kpiLabel">Clientes<br/><strong>contactados</strong></div>
                  <div className="kpiBadge kpiBadge--negative">↘ -5%</div>
                </div>
                <div className="kpiBottom">
                  <div className="kpiValue">30</div>
                  <div className="kpiIconWrap"><Users size={20} /></div>
                </div>
              </div>
              <div className="kpiCard kpiCard--animGradient2">
                <div className="kpiTop">
                  <div className="kpiLabel">Ventas<br/><strong>cerradas</strong></div>
                  <div className="kpiBadge kpiBadge--positive">↗ +8%</div>
                </div>
                <div className="kpiBottom">
                  <div className="kpiValue">05</div>
                  <div className="kpiIconWrap"><CheckCircle size={20} /></div>
                </div>
              </div>
            </div>
          </div>

          <div className="dashboardSectionHeader" style={{ marginTop: 8 }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>Próximas reactivaciones</h3>
            <div className="dashboardTabs">
              <button className="dashboardTab dashboardTab--active">Esta semana</button>
              <button className="dashboardTab">Este mes</button>
            </div>
          </div>
          
          <div className="dashWidget">
            <div className="dashTableWrap hide-scrollbar">
              {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}
              {loading ? <div className="hint" style={{ marginBottom: 16 }}>Cargando alertas...</div> : null}

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
                              setStatusModalQuote(item);
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
                      <td colSpan={4} className="cellEmpty">No hay cotizaciones para reactivar hoy.</td>
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

      {statusModalQuote ? (
        <div className="modalOverlay" onClick={() => setStatusModalQuote(null)}>
          <div className="modalContent" onClick={(e) => e.stopPropagation()}>
            <h3>Gestionar reactivación</h3>
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
                  <input type="date" value={newAlertDate} onChange={(e) => setNewAlertDate(e.target.value)} className="input" style={{ width: "100%" }} />
                  <div className="hint" style={{ marginTop: 6 }}>
                    Debés indicar una nueva fecha de reactivación futura.
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
      ) : null}
    </div>
  );
}

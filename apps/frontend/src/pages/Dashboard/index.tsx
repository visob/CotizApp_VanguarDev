import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
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
    <div className="page">
      <div className="stack">
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle">Dashboard</h1>
            <div className="pageSubtitle">Cotizaciones para reactivar hoy o atrasadas</div>
          </div>
          <Button onClick={() => void reload()} disabled={loading} className="btn--ghost">
            Actualizar
          </Button>
        </div>

        {error ? <div className="error">{error}</div> : null}
        {loading ? <div className="hint">Cargando alertas...</div> : null}

        <div className="tableWrap">
          <table className="table table--min980">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>ID</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Reactivación activa</th>
                <th>Slot activo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.cliente_nombre_empresa}</td>
                  <td className="cellMuted">#{item.id}</td>
                  <td className="cellMuted">{formatDate(item.fecha_emision)}</td>
                  <td>{item.estado}</td>
                  <td className="cellMuted">{formatDate(item.fecha_reactivacion_activa)}</td>
                  <td className="cellMuted">Fecha {item.reactivacion_activa}</td>
                  <td className="tableActionsCell">
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Button onClick={() => navigate(`/quotes/${item.id}`)} className="btn--ghost">Ver</Button>
                      <Button
                        onClick={() => {
                          setNewStatus(item.estado);
                          setNewAlertDate(item.fecha_reactivacion_activa ? item.fecha_reactivacion_activa.split("T")[0] : "");
                          setStatusModalQuote(item);
                        }}
                        className="btn--primary"
                      >
                        Gestionar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="cellEmpty">No hay cotizaciones para reactivar hoy.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
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

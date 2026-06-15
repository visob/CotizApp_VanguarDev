import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ActionMenu } from "../../components/common/ActionMenu";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import type { Client } from "../../types";
import { getErrorMessage } from "../../utils/feedback";
import * as clientService from "../../services/client.service";
import "../../styles/clients.css";

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 4H20L14 12V19L10 21V12L4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

function normalizeClientStatus(status: string | null | undefined) {
  const value = (status ?? "").trim().toLowerCase();
  if (value === "activo") return "activo";
  if (value === "pausado") return "pausado";
  if (value === "desactivado" || value === "baja") return "desactivado";
  return "activo";
}

function getClientStatusMeta(status: string | null | undefined) {
  const normalized = normalizeClientStatus(status);
  if (normalized === "pausado") {
    return { className: "statusPill statusPill--pausado", label: "Pausado" };
  }
  if (normalized === "desactivado") {
    return { className: "statusPill statusPill--desactivado", label: "Desactivado" };
  }
  return { className: "statusPill statusPill--activo", label: "Activo" };
}

export function ClientsList() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [statusModalClient, setStatusModalClient] = useState<Client | null>(null);
  const [newStatus, setNewStatus] = useState("Activo");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const errorMessages: Record<string, string> = {
    duplicate_nombre_empresa: "Ya existe un cliente con esa razón social en esta empresa.",
    duplicate_cuit_tax_id: "Ya existe un cliente con ese CUIT en esta empresa.",
    email_invalido: "Ingresá un email válido.",
    estado_invalido: "El estado seleccionado no es válido."
  };

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await clientService.listClients();
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudieron cargar los clientes"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    let result = items;
    if (activeTab === "Activos") result = result.filter((c) => normalizeClientStatus(c.estado) === "activo");
    if (activeTab === "Bajas") result = result.filter((c) => normalizeClientStatus(c.estado) === "desactivado");

    const q = filter.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        return (
          (c.nombre_empresa?.toLowerCase() || "").includes(q) ||
          (c.cuit_tax_id || "").includes(q) ||
          (c.email?.toLowerCase() || "").includes(q) ||
          (c.clasificacion?.toLowerCase() || "").includes(q)
        );
      });
    }
    return result;
  }, [filter, items, activeTab]);

  async function handleUpdateStatus() {
    if (!statusModalClient) return;
    try {
      const { id, ...payload } = statusModalClient;
      const updated = await clientService.updateClient(id, {
        ...payload,
        estado: newStatus
      });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setStatusModalClient(null);
      showToast({ type: "success", text: "Estado del cliente actualizado" });
    } catch (err) {
      setError(getErrorMessage(err, errorMessages, "No se pudo actualizar el estado del cliente"));
    }
  }

  return (
    <div className="page">
      <div>
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle">Clientes</h1>
          <div className="pageSubtitle">Visualizá y administrá tu cartera de clientes</div>
        </div>
        <div className="actions">
          <Button className="btn--ghost">
            <span className="btnIconLead">↑</span> Importar
          </Button>
          <Button className="btn--ghost">
            <span className="btnIconLead">↓</span> Exportar lista
          </Button>
          <Button onClick={() => navigate("/clients/new")} className="btn--primary">
            + Nuevo cliente
          </Button>
        </div>
      </div>

      <div className="pageTabs">
        <button className={`pageTabPill ${activeTab === "Todos" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Todos")}>Todos</button>
        <button className={`pageTabPill ${activeTab === "Activos" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Activos")}>Activos</button>
        <button className={`pageTabPill ${activeTab === "Bajas" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Bajas")}>Bajas</button>
      </div>

      <div className="filterToolbar">
        <input
          className="searchBarInput"
          placeholder="Buscar..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="dateRange">
          <input type="date" className="input" />
          <span className="hint">—</span>
          <input type="date" className="input" />
        </div>
          <Button className="btn--ghost btnInlineIcon">
            <FilterIcon /> Filtrar
          </Button>
        </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="hint">Cargando...</div> : null}

      <div className="tableWrap">
        <table className="table table--min980">
          <thead>
            <tr>
              <th className="colCheckbox"><input type="checkbox" /></th>
              <th>Nombre / Razón Social</th>
              <th>CUIT</th>
              <th>Telefono</th>
              <th>Email</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Ult. contacto</th>
              <th className="tableActionsCell">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const statusMeta = getClientStatusMeta(c.estado);
              return (
              <tr key={c.id}>
                <td className="colCheckbox"><input type="checkbox" /></td>
                <td style={{ fontWeight: 500 }}>
                  <Link className="tableLink" to={`/clients/${c.id}`} state={{ client: c }}>
                    {c.nombre_empresa}
                  </Link>
                </td>
                <td>{c.cuit_tax_id ?? "-"}</td>
                <td>{c.telefono ?? "-"}</td>
                <td>{c.email ?? "-"}</td>
                <td>{c.clasificacion ?? "-"}</td>
                <td>
                  <span className={statusMeta.className}>
                    {statusMeta.label}
                  </span>
                </td>
                <td>{c.ult_contacto ? new Date(c.ult_contacto).toLocaleDateString() : "17/04/2026"}</td>
                <td className="tableActionsCell">
                  <ActionMenu
                    items={[
                      {
                        label: "Editar",
                        onClick: () => navigate(`/clients/${c.id}/edit`)
                      },
                      {
                        label: "Cambiar Estado",
                        onClick: () => {
                          setNewStatus(getClientStatusMeta(c.estado).label);
                          setStatusModalClient(c);
                        }
                      }
                    ]}
                  />
                </td>
              </tr>
            )})}
            {!filtered.length && !loading ? (
              <tr>
                <td className="cellEmpty" colSpan={9}>
                  No se encontraron clientes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {statusModalClient ? (
        <div className="modalOverlay" onClick={() => setStatusModalClient(null)}>
          <div className="modalContent" onClick={(event) => event.stopPropagation()}>
            <h3>Cambiar Estado</h3>
            <p>{statusModalClient.nombre_empresa}</p>
            <div className="modalField">
              <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)} className="select modalControl">
                <option value="Activo">Activo</option>
                <option value="Pausado">Pausado</option>
                <option value="Desactivado">Desactivado</option>
              </select>
            </div>
            <div className="modalActions">
              <Button onClick={() => setStatusModalClient(null)} className="btn--ghost">
                Cancelar
              </Button>
              <Button onClick={() => void handleUpdateStatus()} className="btn--primary">
                Guardar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

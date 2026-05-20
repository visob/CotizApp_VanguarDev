import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import type { Client } from "../../types";
import * as clientService from "../../services/client.service";
import "../../styles/clients.css";

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M8 7V3M16 7V3M7 11H17M5 21H19C20.1046 21 21 20.1046 21 19V7C21 5.89543 20.1046 5 19 5H5C3.89543 5 3 5.89543 3 7V19C3 20.1046 3.89543 21 5 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const FilterIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M4 4H20L14 12V19L10 21V12L4 4Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DotsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M12 13C12.5523 13 13 12.5523 13 12C13 11.4477 12.5523 11 12 11C11.4477 11 11 11.4477 11 12C11 12.5523 11.4477 13 12 13Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 6C12.5523 6 13 5.55228 13 5C13 4.44772 12.5523 4 12 4C11.4477 4 11 4.44772 11 5C11 5.55228 11.4477 6 12 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 20C12.5523 20 13 19.5523 13 19C13 18.4477 12.5523 18 12 18C11.4477 18 11 18.4477 11 19C11 19.5523 11.4477 20 12 20Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function ClientsList() {
  const [items, setItems] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const navigate = useNavigate();

  async function reload() {
    setLoading(true);
    try {
      const data = await clientService.listClients();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    let result = items;
    if (activeTab === "Activos") result = result.filter(c => c.estado !== "Baja");
    if (activeTab === "Bajas") result = result.filter(c => c.estado === "Baja");

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
            <span style={{ marginRight: 8 }}>↑</span> Importar
          </Button>
          <Button className="btn--ghost">
            <span style={{ marginRight: 8 }}>↓</span> Exportar lista
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
          <Button className="btn--ghost" style={{ display: "flex", gap: 8 }}>
            <FilterIcon /> Filtrar
          </Button>
        </div>
      </div>

      {loading ? <div className="hint">Cargando...</div> : null}

      <div className="tableWrap">
        <table className="table table--min980">
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" /></th>
              <th>Nombre / Razón Social</th>
              <th>CUIT</th>
              <th>Telefono</th>
              <th>Email</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Ult. contacto</th>
              <th style={{ textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td><input type="checkbox" /></td>
                <td style={{ fontWeight: 500 }}>
                  <Link style={{ textDecoration: "none", color: "inherit" }} to={`/clients/${c.id}`}>
                    {c.nombre_empresa}
                  </Link>
                </td>
                <td>{c.cuit_tax_id ?? "-"}</td>
                <td>{c.telefono ?? "-"}</td>
                <td>{c.email ?? "-"}</td>
                <td>{c.clasificacion ?? "-"}</td>
                <td>
                  <span className={`statusPill statusPill--${c.estado?.toLowerCase() === "baja" ? "baja" : "activo"}`}>
                    {c.estado ?? "Activo"}
                  </span>
                </td>
                <td>{c.ult_contacto ? new Date(c.ult_contacto).toLocaleDateString() : "17/04/2026"}</td>
                <td style={{ textAlign: "center" }}>
                  <button style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>
                    <DotsIcon />
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && !loading ? (
              <tr>
                <td className="cellEmpty" colSpan={9} style={{ textAlign: "center" }}>
                  No se encontraron clientes.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import * as clientService from "../../services/client.service";
import type { Client } from "../../types";
import "../../styles/clients.css";

type ClientDraft = Omit<Client, "id">;

const emptyDraft: ClientDraft = {
  nombre_empresa: "",
  cuit_tax_id: "",
  email: "",
  telefono: "",
  direccion: "",
  codigo_postal: "",
  pais: "Argentina",
  provincia: "Buenos Aires",
  clasificacion: "Cliente final",
  estado: "Activo"
};

const ReturnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 14L4 9M4 9L9 4M4 9H14C17.866 9 21 12.134 21 16C21 19.866 17.866 23 14 23H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function ClientCreate() {
  const [draft, setDraft] = useState<ClientDraft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function onSave() {
    setError(null);
    const nombre = draft.nombre_empresa?.trim();
    if (!nombre) {
      setError("El nombre / razón social es obligatorio");
      return;
    }

    setLoading(true);
    try {
      await clientService.createClient({
        ...draft,
        nombre_empresa: nombre
      });
      navigate("/clients");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="pageHeader" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24, marginBottom: 8 }}>
        <div>
          <h1 className="pageTitle">Clientes</h1>
          <div className="pageSubtitle" style={{ marginTop: 8 }}>
            <Link to="/clients" style={{ textDecoration: "none", color: "inherit", opacity: 0.8 }}>Clientes</Link> 
            <span style={{ margin: "0 6px", opacity: 0.5 }}>›</span> 
            <span style={{ fontWeight: 600 }}>Agregar nuevo cliente</span>
          </div>
        </div>
        <div className="actions">
          <Button onClick={() => navigate("/clients")} className="btn--ghost" style={{ border: "none", fontWeight: 600, display: "flex", gap: 8 }}>
            <ReturnIcon /> Volver
          </Button>
        </div>
      </div>

      <div className="stack maxw-820" style={{ maxWidth: 840 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "10px 0 20px" }}>Nuevo cliente</h2>
        
        <div className="formGrid formGrid--2" style={{ gap: 24 }}>
          <label className="field">
            <span className="label">Nombre / Razón Social</span>
            <input
              value={draft.nombre_empresa}
              onChange={(e) => setDraft((d) => ({ ...d, nombre_empresa: e.target.value }))}
              className="input"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            />
          </label>
          <label className="field">
            <span className="label">CUIT</span>
            <input
              value={draft.cuit_tax_id ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, cuit_tax_id: e.target.value }))}
              className="input"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            />
          </label>
          <label className="field">
            <span className="label">Email</span>
            <input
              value={draft.email ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              className="input"
              type="email"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            />
          </label>
          <label className="field">
            <span className="label">Teléfono</span>
            <input
              value={draft.telefono ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, telefono: e.target.value }))}
              className="input"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            />
          </label>
          <label className="field">
            <span className="label">Dirección</span>
            <input
              value={draft.direccion ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, direccion: e.target.value }))}
              className="input"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            />
          </label>
          <label className="field">
            <span className="label">Código Postal</span>
            <input
              value={draft.codigo_postal ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, codigo_postal: e.target.value }))}
              className="input"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            />
          </label>
          <label className="field">
            <span className="label">País</span>
            <select
              value={draft.pais ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, pais: e.target.value }))}
              className="select"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            >
              <option value="Argentina">Argentina</option>
              <option value="Uruguay">Uruguay</option>
              <option value="Chile">Chile</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Provincia</span>
            <select
              value={draft.provincia ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, provincia: e.target.value }))}
              className="select"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            >
              <option value="Buenos Aires">Buenos Aires</option>
              <option value="CABA">CABA</option>
              <option value="Córdoba">Córdoba</option>
              <option value="Santa Fe">Santa Fe</option>
            </select>
          </label>
          <label className="field">
            <span className="label">Tipo</span>
            <select
              value={draft.clasificacion ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, clasificacion: e.target.value }))}
              className="select"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            >
              <option value="Distribuidor">Distribuidor</option>
              <option value="Cliente final">Cliente final</option>
            </select>
          </label>
          
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
            <Button disabled={loading} onClick={() => void onSave()} style={{ background: "#18181b", color: "#fff", width: "100%", maxWidth: 200, border: "none" }}>
              Guardar
            </Button>
          </div>
        </div>

        {error ? <div className="error" style={{ marginTop: 16 }}>{error}</div> : null}
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/common/Button";
import * as clientService from "../../services/client.service";
import type { Client } from "../../types";
import "../../styles/clients.css";

const ReturnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 14L4 9M4 9L9 4M4 9H14C17.866 9 21 12.134 21 16C21 19.866 17.866 23 14 23H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UserIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MailIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M4 7.00005L10.2 11.65C11.2667 12.45 12.7333 12.45 13.8 11.65L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const PhoneIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M3 5.5C3 14.0604 9.93959 21 18.5 21C18.8862 21 19.2693 20.9804 19.648 20.942C20.3129 20.8744 20.7818 20.2526 20.6728 19.5938L19.8601 14.6781C19.7431 13.9702 19.167 13.4357 18.455 13.3742L15.352 13.1064C14.4988 13.0327 13.7118 13.5683 13.4077 14.3793C13.0039 15.4564 11.4552 16.5 9 14.5C6.5 12.5 5.86702 10.7497 7.05432 10.354C7.88602 10.077 8.44111 9.27891 8.35824 8.41168L8.03369 4.99612C7.96205 4.24647 7.35924 3.66697 6.60803 3.56581L2.83786 3.05837C2.17937 2.96974 1.57947 3.47355 1.54784 4.13627C1.51614 4.8009 1.5 5.46585 1.5 6.13098" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const MapPinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M12 21C15.5 17.4 19 14.1764 19 10.2C19 6.22355 15.866 3 12 3C8.13401 3 5 6.22355 5 10.2C5 14.1764 8.5 17.4 12 21Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 12C13.1046 12 14 11.1046 14 10C14 8.89543 13.1046 8 12 8C10.8954 8 10 8.89543 10 10C10 11.1046 10.8954 12 12 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const GlobeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
    <path d="M2 12H22" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 2C14.5013 4.73835 15.9228 8.29203 16 12C15.9228 15.708 14.5013 19.2616 12 22C9.49872 19.2616 8.07725 15.708 8 12C8.07725 8.29203 9.49872 4.73835 12 2Z" stroke="currentColor" strokeWidth="2"/>
  </svg>
);

const FileIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M13 2V9H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EditIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const TrashIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);


export function ClientView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        // We fetch all and find by ID since the controller doesn't seem to expose a direct GET /:id? Wait, we can.
        // Actually, let's just use listClients and filter for now to guarantee it works.
        const all = await clientService.listClients();
        const found = all.find(c => String(c.id) === id);
        if (found) {
          setClient(found);
        } else {
          setError("Cliente no encontrado");
        }
      } catch (err) {
        setError("Error cargando cliente");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [id]);

  if (loading) return <div className="page"><div className="hint">Cargando...</div></div>;
  if (error || !client) return <div className="page"><div className="error">{error}</div></div>;

  return (
    <div className="page">
      <div className="pageHeader" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24, marginBottom: 8 }}>
        <div>
          <h1 className="pageTitle">Clientes</h1>
          <div className="pageSubtitle" style={{ marginTop: 8 }}>
            <Link to="/clients" style={{ textDecoration: "none", color: "inherit", opacity: 0.8 }}>Clientes</Link> 
            <span style={{ margin: "0 6px", opacity: 0.5 }}>›</span> 
            <span style={{ fontWeight: 600 }}>Visualizar cliente</span>
          </div>
        </div>
        <div className="actions">
          <Button onClick={() => navigate("/clients")} className="btn--ghost" style={{ border: "none", fontWeight: 600, display: "flex", gap: 8 }}>
            <ReturnIcon /> Volver
          </Button>
        </div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 600, margin: "10px 0 20px" }}>Ver cliente</h2>

      <div className="clientDetailGrid">
        <div className="clientCard">
          <h3 className="infoTitle">Información personal</h3>
          
          <div className="clientInfoRow">
            <div className="clientAvatarLg">
              <UserIcon />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{client.nombre_empresa}</div>
              <div style={{ opacity: 0.8, fontSize: 14 }}>CUIT: {client.cuit_tax_id || "-"}</div>
            </div>
          </div>

          <div className="infoBlock">
            <div className="infoTitle">Información de contacto</div>
            <div className="infoItem">
              <span className="iconMuted"><MailIcon /></span> {client.email || "-"}
            </div>
            <div className="infoItem">
              <span className="iconMuted"><PhoneIcon /></span> {client.telefono || "-"}
            </div>
          </div>

          <div className="infoBlock">
            <div className="infoTitle">Ubicación</div>
            <div className="infoItem">
              <span className="iconMuted"><MapPinIcon /></span> {client.direccion || "-"}
            </div>
            <div className="infoItem">
              <span className="iconMuted"><GlobeIcon /></span> {[client.provincia, client.pais].filter(Boolean).join(", ") || "-"}
            </div>
          </div>

          <div className="infoBlock" style={{ marginBottom: 0 }}>
            <div className="infoTitle">Tipo de cliente</div>
            <div className="infoItem">
              <span className="iconMuted"><UserIcon /></span> {client.clasificacion || "-"}
            </div>
          </div>
        </div>

        <div className="stack">
          <div style={{ fontWeight: 600 }}>Estado</div>
          <div className={`clientCard ${client.estado?.toLowerCase() === "baja" ? "clientCard--baja" : ""}`} style={{ flex: 1, minHeight: 120 }}>
            {client.estado || "Activo"}
          </div>
        </div>

        <div className="stack">
          <div style={{ fontWeight: 600 }}>Reactivaciones</div>
          <div className="clientCard clientCard--empty" style={{ flex: 1, minHeight: 120 }}>
            No hay reactivaciones previstas
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "10px 0 16px" }}>Historial de cotizaciones</h3>
          <div className="clientCard" style={{ padding: "8px 24px" }}>
            <table className="table" style={{ width: "100%" }}>
              <tbody>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "16px 0", fontWeight: 500 }}>17/04/2026</td>
                  <td style={{ padding: "16px 0", fontWeight: 500 }}>Productos: 5</td>
                  <td style={{ padding: "16px 0", fontWeight: 600 }}>Monto: $22.000 ARS</td>
                  <td style={{ padding: "16px 0", textAlign: "right" }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6, marginRight: 16 }}><FileIcon /></button>
                    <button style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}><DownloadIcon /></button>
                  </td>
                </tr>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "16px 0", fontWeight: 500 }}>17/04/2026</td>
                  <td style={{ padding: "16px 0", fontWeight: 500 }}>Productos: 5</td>
                  <td style={{ padding: "16px 0", fontWeight: 600 }}>Monto: $22.000 ARS</td>
                  <td style={{ padding: "16px 0", textAlign: "right" }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6, marginRight: 16 }}><FileIcon /></button>
                    <button style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}><DownloadIcon /></button>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "16px 0", fontWeight: 500 }}>17/04/2026</td>
                  <td style={{ padding: "16px 0", fontWeight: 500 }}>Productos: 5</td>
                  <td style={{ padding: "16px 0", fontWeight: 600 }}>Monto: $22.000 ARS</td>
                  <td style={{ padding: "16px 0", textAlign: "right" }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6, marginRight: 16 }}><FileIcon /></button>
                    <button style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}><DownloadIcon /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div style={{ width: 64, marginTop: 42 }}>
          <div style={{ fontWeight: 600, marginBottom: 16, textAlign: "center" }}>Acciones</div>
          <div className="viewActions">
            <Button className="btn--icon"><PlusIcon /></Button>
            <Button className="btn--icon"><EditIcon /></Button>
            <Button className="btn--icon" onClick={async () => {
              if (window.confirm("¿Seguro que deseas eliminar este cliente?")) {
                await clientService.deleteClient(client.id);
                navigate("/clients");
              }
            }}><TrashIcon /></Button>
          </div>
        </div>
      </div>
    </div>
  );
}

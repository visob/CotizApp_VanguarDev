import { useState } from "react";
import { Button } from "../../components/common/Button";
import "../../styles/pages.css";

export default function SupportPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const faqs = [
    {
      q: "¿Cómo configuro mi logo en las cotizaciones?",
      a: "Para configurar tu logo, andá a 'Configuración' en el menú lateral. Ahí vas a poder subir el logo de tu empresa, cambiar los colores principales y editar la información de contacto."
    },
    {
      q: "¿Cómo hago el seguimiento de mis cotizaciones?",
      a: "El sistema de seguimiento te avisa cuando una cotización necesita revisión. Al crear una, el sistema programa alertas que te aparecerán en el Inicio (Dashboard)."
    },
    {
      q: "¿Cómo aplico un descuento general?",
      a: "Al editar una cotización, en la sección de totales al final de la página, vas a encontrar un campo para ingresar un descuento porcentual antes de calcular el IVA."
    }
  ];

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="page" style={{ height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div className="pageHeader" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: "2rem", margin: 0 }}>Soporte</h1>
          <div className="hint" style={{ marginTop: "8px" }}>Resolvé tus dudas o comunicate con nuestro equipo</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "40px", flex: 1, minHeight: 0 }}>
        {/* Left Column: FAQs */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <h2 style={{ fontSize: "1.25rem", marginTop: 0, marginBottom: "20px", fontWeight: 600, flexShrink: 0 }}>
            Preguntas frecuentes
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", paddingBottom: "20px" }}>
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div key={idx} style={{ background: "#ffffff", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(125, 57, 235, 0.15)", flexShrink: 0 }}>
                  <button
                    onClick={() => toggleFaq(idx)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "16px",
                      background: "transparent",
                      border: "none",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "inherit"
                    }}
                  >
                    {faq.q}
                    <span style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                      &#9662;
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ padding: "0 16px 16px", fontSize: "0.95rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Contact */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <h2 style={{ fontSize: "1.25rem", marginTop: 0, marginBottom: "20px", fontWeight: 600, flexShrink: 0 }}>
            Contactanos
          </h2>
          <div style={{ background: "rgba(125, 57, 235, 0.04)", border: "1px solid rgba(125, 57, 235, 0.1)", borderRadius: "16px", padding: "28px", display: "flex", flexDirection: "column", flex: 1, overflowY: "auto" }}>
            <h3 style={{ fontSize: "1.1rem", margin: "0 0 12px 0", color: "inherit" }}>¿No encontraste lo que buscabas?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "0.95rem", margin: "0 0 20px 0", lineHeight: 1.5 }}>
              Nuestro equipo está disponible para ayudarte. Escribinos tu consulta.
            </p>
            
            <form style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1 }} onSubmit={(e) => e.preventDefault()}>
              <div>
                <label className="label">Asunto</label>
                <input type="text" className="input" placeholder="Ej: Problema al generar PDF" style={{ width: "100%", background: "#ffffff", border: "1px solid rgba(125, 57, 235, 0.2)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                <label className="label">Mensaje</label>
                <textarea className="input" placeholder="Escribí tu mensaje acá..." style={{ width: "100%", background: "#ffffff", border: "1px solid rgba(125, 57, 235, 0.2)", flex: 1, resize: "none", minHeight: "80px" }} />
              </div>
              <Button className="btn--primary" style={{ alignSelf: "flex-start", marginTop: "8px" }}>
                Enviar mensaje
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

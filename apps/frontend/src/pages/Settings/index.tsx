import { useEffect, useState } from "react";
import { Button } from "../../components/common/Button";
import * as configService from "../../services/config.service";
import "../../styles/settings.css";

export default function SettingsPage() {
  const [exchangeRate, setExchangeRate] = useState("1000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    async function fetchConfig() {
      const rate = await configService.getConfig("exchange_rate");
      if (rate) setExchangeRate(rate.valor);
      setLoading(false);
    }
    void fetchConfig();
  }, []);

  async function handleSave() {
    setMessage(null);
    const val = parseFloat(exchangeRate.replace(",", "."));
    if (isNaN(val) || val <= 0) {
      setMessage({ text: "Ingresa un valor válido para la tasa de cambio", type: "error" });
      return;
    }

    setSaving(true);
    try {
      await configService.setConfig("exchange_rate", val.toString());
      setMessage({ text: "Configuración guardada correctamente", type: "success" });
    } catch (err) {
      setMessage({ text: "Error al guardar configuración", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="hint">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="pageHeader" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24, marginBottom: 24 }}>
        <div>
          <h1 className="pageTitle">Configuración</h1>
          <div className="pageSubtitle" style={{ marginTop: 8 }}>Ajustes globales del sistema</div>
        </div>
      </div>

      <div className="settingsCard">
        <h2 className="settingsSectionTitle">Moneda y Cotización</h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label className="field" style={{ maxWidth: 300 }}>
            <span className="label">Tasa de Cambio (1 USD = ? ARS)</span>
            <input
              value={exchangeRate}
              onChange={(e) => setExchangeRate(e.target.value)}
              className="input"
              style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
            />
          </label>

          <div style={{ marginTop: 8 }}>
            <Button disabled={saving} onClick={() => void handleSave()} style={{ background: "#18181b", color: "#fff", border: "none", minWidth: 120 }}>
              {saving ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>

          {message ? (
            <div className={message.type === "error" ? "error" : ""} style={message.type === "success" ? { color: "green", fontSize: 14, fontWeight: 500 } : {}}>
              {message.text}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

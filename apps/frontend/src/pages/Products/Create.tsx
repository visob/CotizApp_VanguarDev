import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import * as productService from "../../services/product.service";
import type { Product } from "../../types";
import "../../styles/clients.css";

const EXCHANGE_RATE = 1000; // 1 USD = 1000 ARS

type ProductDraft = Omit<Product, "id">;

const emptyDraft: ProductDraft = {
  nombre: "",
  sku: "",
  descripcion: "",
  stock: 0,
  precio_ars: "",
  precio_usd: "",
  garantia: "12 meses",
  estado: "Activo"
};

const ReturnIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M9 14L4 9M4 9L9 4M4 9H14C17.866 9 21 12.134 21 16C21 19.866 17.866 23 14 23H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function ProductCreate() {
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [stockInput, setStockInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function handleUsdChange(value: string) {
    const usdNum = parseFloat(value.replace(",", "."));
    let arsVal = draft.precio_ars;
    if (!isNaN(usdNum)) {
      arsVal = (usdNum * EXCHANGE_RATE).toString();
    } else if (value === "") {
      arsVal = "";
    }
    setDraft(d => ({ ...d, precio_usd: value, precio_ars: arsVal }));
  }

  function handleArsChange(value: string) {
    const arsNum = parseFloat(value.replace(",", "."));
    let usdVal = draft.precio_usd;
    if (!isNaN(arsNum)) {
      usdVal = (arsNum / EXCHANGE_RATE).toString();
    } else if (value === "") {
      usdVal = "";
    }
    setDraft(d => ({ ...d, precio_ars: value, precio_usd: usdVal }));
  }

  async function onSave() {
    setError(null);
    const nombre = draft.nombre?.trim();
    if (!nombre) {
      setError("El nombre del producto es obligatorio");
      return;
    }

    let ars = parseFloat(draft.precio_ars.replace(",", "."));
    let usd = parseFloat(draft.precio_usd.replace(",", "."));
    if (isNaN(ars) && isNaN(usd)) {
      setError("Debes ingresar el precio en ARS o USD");
      return;
    }
    if (isNaN(ars)) ars = 0;
    if (isNaN(usd)) usd = 0;

    let stockParsed = parseInt(stockInput.trim(), 10);
    if (isNaN(stockParsed) || stockInput.trim() === "") {
      stockParsed = -1; // Ilimitado
    }

    setLoading(true);
    try {
      await productService.createProduct({
        ...draft,
        nombre,
        precio_ars: ars.toString(),
        precio_usd: usd.toString(),
        stock: stockParsed
      });
      navigate("/products");
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
          <h1 className="pageTitle">Productos</h1>
          <div className="pageSubtitle" style={{ marginTop: 8 }}>
            <Link to="/products" style={{ textDecoration: "none", color: "inherit", opacity: 0.8 }}>Productos</Link> 
            <span style={{ margin: "0 6px", opacity: 0.5 }}>›</span> 
            <span style={{ fontWeight: 600 }}>Agregar nuevo producto</span>
          </div>
        </div>
        <div className="actions">
          <Button onClick={() => navigate("/products")} className="btn--ghost" style={{ border: "none", fontWeight: 600, display: "flex", gap: 8 }}>
            <ReturnIcon /> Volver
          </Button>
        </div>
      </div>

      <div className="stack maxw-820" style={{ maxWidth: 840 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: "10px 0 20px" }}>Nuevo producto</h2>
        
        <div className="formGrid formGrid--2" style={{ gap: 24 }}>
          {/* Left Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <label className="field">
              <span className="label">Nombre</span>
              <input
                value={draft.nombre}
                onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                className="input"
                style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span className="label">Descripción</span>
              <textarea
                value={draft.descripcion ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
                className="textarea"
                style={{ background: "rgba(17,24,39,0.06)", border: "none", flex: 1 }}
              />
            </label>
          </div>

          {/* Right Column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <label className="field">
              <span className="label">SKU</span>
              <input
                value={draft.sku ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                className="input"
                style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
              />
            </label>
            <label className="field">
              <span className="label">Stock</span>
              <input
                placeholder="Ilimitado"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                className="input"
                style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
              />
            </label>
            
            <div style={{ display: "flex", gap: 12 }}>
              <label className="field" style={{ flex: 1 }}>
                <span className="label">Precio USD</span>
                <input
                  value={draft.precio_usd}
                  onChange={(e) => handleUsdChange(e.target.value)}
                  className="input"
                  style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
                />
              </label>
              <label className="field" style={{ flex: 1 }}>
                <span className="label">Precio ARS (Tasa $1000)</span>
                <input
                  value={draft.precio_ars}
                  onChange={(e) => handleArsChange(e.target.value)}
                  className="input"
                  style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
                />
              </label>
            </div>

            <label className="field">
              <span className="label">Garantía</span>
              <select
                value={draft.garantia ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, garantia: e.target.value }))}
                className="select"
                style={{ background: "rgba(17,24,39,0.06)", border: "none" }}
              >
                <option value="Sin garantía">Sin garantía</option>
                <option value="6 meses">6 meses</option>
                <option value="12 meses">12 meses</option>
                <option value="24 meses">24 meses</option>
              </select>
            </label>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-start", marginTop: 10 }}>
          <Button disabled={loading} onClick={() => void onSave()} style={{ background: "#18181b", color: "#fff", width: "100%", maxWidth: 160, border: "none" }}>
            Guardar
          </Button>
        </div>

        {error ? <div className="error" style={{ marginTop: 16 }}>{error}</div> : null}
      </div>
    </div>
  );
}

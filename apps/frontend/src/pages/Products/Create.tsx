import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import * as productService from "../../services/product.service";
import * as configService from "../../services/config.service";
import type { Product } from "../../types";
import { ReturnIcon } from "../../components/common/Icons";
import "../../styles/products.css";

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

export function ProductCreate() {
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [stockInput, setStockInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const [exchangeRate, setExchangeRate] = useState(1000); // Default fallback

  useEffect(() => {
    async function fetchRate() {
      const rateConfig = await configService.getConfig("exchange_rate");
      if (rateConfig) {
        const rate = parseFloat(rateConfig.valor);
        if (!isNaN(rate) && rate > 0) {
          setExchangeRate(rate);
        }
      }
    }
    void fetchRate();
  }, []);

  function handleUsdChange(value: string) {
    const usdNum = parseFloat(value.replace(",", "."));
    let arsVal = draft.precio_ars;
    if (!isNaN(usdNum)) {
      arsVal = (usdNum * exchangeRate).toString();
    } else if (value === "") {
      arsVal = "";
    }
    setDraft(d => ({ ...d, precio_usd: value, precio_ars: arsVal }));
  }

  function handleArsChange(value: string) {
    const arsNum = parseFloat(value.replace(",", "."));
    let usdVal = draft.precio_usd;
    if (!isNaN(arsNum)) {
      usdVal = (arsNum / exchangeRate).toString();
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
      <div className="productsPageHeader">
        <div>
          <h1 className="pageTitle">Productos</h1>
          <div className="pageSubtitle productsPageSubtitle">
            <Link to="/products" className="productsBreadcrumbLink">Productos</Link> 
            <span className="productsBreadcrumbSeparator">›</span> 
            <span className="productsBreadcrumbCurrent">Agregar nuevo producto</span>
          </div>
        </div>
        <div className="actions">
          <Button onClick={() => navigate("/products")} className="btn--ghost btn--return">
            <ReturnIcon /> Volver
          </Button>
        </div>
      </div>

      <div className="stack createStack">
        <h2 className="createTitle">Nuevo producto</h2>
        
        <div className="formGrid formGrid--2 formGrid--gap">
          {/* Left Column */}
          <div className="formCol">
            <label className="field">
              <span className="label">Nombre</span>
              <input
                value={draft.nombre}
                onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                className="input formInput"
              />
            </label>
            <label className="field flex-1">
              <span className="label">Descripción</span>
              <textarea
                value={draft.descripcion ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
                className="textarea formTextarea"
              />
            </label>
          </div>

          {/* Right Column */}
          <div className="formCol">
            <label className="field">
              <span className="label">SKU</span>
              <input
                value={draft.sku ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
                className="input formInput"
              />
            </label>
            <label className="field">
              <span className="label">Stock</span>
              <input
                placeholder="Ilimitado"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                className="input formInput"
              />
            </label>
            
            <div className="flexRow">
              <label className="field flex-1">
                <span className="label">Precio USD</span>
                <input
                  value={draft.precio_usd}
                  onChange={(e) => handleUsdChange(e.target.value)}
                  className="input formInput"
                />
              </label>
              <label className="field flex-1">
                <span className="label">Precio ARS (Tasa ${exchangeRate})</span>
                <input
                  value={draft.precio_ars}
                  onChange={(e) => handleArsChange(e.target.value)}
                  className="input formInput"
                />
              </label>
            </div>

            <label className="field">
              <span className="label">Garantía</span>
              <select
                value={draft.garantia ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, garantia: e.target.value }))}
                className="select formInput"
              >
                <option value="Sin garantía">Sin garantía</option>
                <option value="6 meses">6 meses</option>
                <option value="12 meses">12 meses</option>
                <option value="24 meses">24 meses</option>
              </select>
            </label>
          </div>
        </div>

        <div className="saveContainer">
          <Button disabled={loading} onClick={() => void onSave()} className="btn--save">
            Guardar
          </Button>
        </div>

        {error ? <div className="error errorMargin">{error}</div> : null}
      </div>
    </div>
  );
}

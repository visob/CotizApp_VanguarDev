import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import * as productService from "../../services/product.service";
import * as configService from "../../services/config.service";
import type { Product } from "../../types";
import { ReturnIcon } from "../../components/common/Icons";
import { getErrorMessage } from "../../utils/feedback";
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

const productErrorMessages: Record<string, string> = {
  nombre_required: "El nombre del producto es obligatorio.",
  precio_ars_y_usd_requeridos: "Debes informar precios validos para ARS y USD.",
  stock_invalido: "El stock debe ser un numero entero mayor o igual a 0, o dejarse vacio para ilimitado.",
  duplicate_nombre: "Ya existe un producto con ese nombre en esta empresa.",
  duplicate_sku: "Ya existe un producto con ese SKU en esta empresa.",
  estado_invalido: "El estado seleccionado no es valido."
};

export function ProductCreate() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [stockInput, setStockInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { showToast } = useToast();

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

  useEffect(() => {
    if (!id) return;

    async function loadProduct() {
      setLoading(true);
      setError(null);
      try {
        const product = await productService.getProduct(Number(id));
        const { id: _id, ...rest } = product;
        setDraft({
          ...emptyDraft,
          ...rest
        });
        setStockInput(product.stock === -1 ? "" : String(product.stock));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al cargar producto");
      } finally {
        setLoading(false);
      }
    }

    void loadProduct();
  }, [id]);

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

    const arsText = draft.precio_ars.trim();
    const usdText = draft.precio_usd.trim();
    let ars = parseFloat(arsText.replace(",", "."));
    let usd = parseFloat(usdText.replace(",", "."));
    if (!arsText && !usdText) {
      setError("Debes ingresar al menos un precio");
      return;
    }
    if ((!Number.isNaN(ars) && ars < 0) || (!Number.isNaN(usd) && usd < 0)) {
      setError("Los precios no pueden ser negativos");
      return;
    }
    if (isNaN(ars)) ars = 0;
    if (isNaN(usd)) usd = 0;

    let stockParsed = parseInt(stockInput.trim(), 10);
    if (isNaN(stockParsed) || stockInput.trim() === "") {
      stockParsed = -1; // Ilimitado
    }
    if (stockParsed < -1) {
      setError("El stock no puede ser negativo");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...draft,
        nombre,
        precio_ars: ars.toString(),
        precio_usd: usd.toString(),
        stock: stockParsed
      };

      if (isEditMode && id) {
        await productService.updateProduct(Number(id), payload);
        showToast({ type: "success", text: "Producto actualizado correctamente" });
      } else {
        await productService.createProduct(payload);
        showToast({ type: "success", text: "Producto creado correctamente" });
      }

      navigate("/products");
    } catch (err) {
      setError(getErrorMessage(err, productErrorMessages, "No se pudo guardar el producto"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div className="pageHeader" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24, marginBottom: 8 }}>
        <div>
          <h1 className="pageTitle">Productos</h1>
          <div className="pageSubtitle productsPageSubtitle">
            <Link to="/products" className="productsBreadcrumbLink">Productos</Link> 
            <span className="productsBreadcrumbSeparator">›</span> 
            <span className="productsBreadcrumbCurrent">{isEditMode ? "Editar producto" : "Agregar nuevo producto"}</span>
          </div>
        </div>
        <div className="actions">
          <Button onClick={() => navigate("/products")} className="btn--ghost" style={{ border: "none", fontWeight: 600, display: "flex", gap: 8 }}>
            <ReturnIcon /> Volver
          </Button>
        </div>
      </div>

      <div className="stack">
        <div className="sectionTitle" style={{ marginTop: 8 }}>Datos generales</div>
        <div className="divider" />
        
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <label className="field">
            <span className="label">Nombre</span>
            <input
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              className="input"
            />
          </label>

          <label className="field">
            <span className="label">SKU</span>
            <input
              value={draft.sku ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, sku: e.target.value }))}
              className="input"
            />
          </label>

          <label className="field">
            <span className="label">Stock</span>
            <input
              placeholder="Ilimitado"
              value={stockInput}
              onChange={(e) => setStockInput(e.target.value)}
              className="input"
            />
          </label>

          <label className="field">
            <span className="label">Garantía</span>
            <select
              value={draft.garantia ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, garantia: e.target.value }))}
              className="select"
            >
              <option value="Sin garantía">Sin garantía</option>
              <option value="6 meses">6 meses</option>
              <option value="12 meses">12 meses</option>
              <option value="24 meses">24 meses</option>
            </select>
          </label>

          <label className="field" style={{ gridColumn: "1 / -1" }}>
            <span className="label">Descripción</span>
            <textarea
              value={draft.descripcion ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))}
              className="textarea"
            />
          </label>
        </div>

        <div className="sectionTitle">Precio</div>
        <div className="divider" />

        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <label className="field">
            <span className="label">Precio USD</span>
            <input
              value={draft.precio_usd}
              onChange={(e) => handleUsdChange(e.target.value)}
              className="input"
            />
          </label>

          <label className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span className="label" style={{ marginBottom: 0 }}>Precio ARS</span>
              <span style={{ 
                background: 'var(--fluo-accent)', 
                color: 'var(--dark-accent)', 
                padding: '6px 12px', 
                borderRadius: '8px', 
                fontSize: '13px', 
                fontWeight: 700 
              }}>Tasa: {exchangeRate}</span>
            </div>
            <input
              value={draft.precio_ars}
              onChange={(e) => handleArsChange(e.target.value)}
              className="input"
            />
          </label>
        </div>

        <div className="newActions">
          <Button disabled={loading} onClick={() => void onSave()} className="btn--primary minw-170">
            {isEditMode ? "Guardar cambios" : "Guardar"}
          </Button>
        </div>

        {error ? <div className="error errorMargin">{error}</div> : null}
      </div>
    </div>
  );
}

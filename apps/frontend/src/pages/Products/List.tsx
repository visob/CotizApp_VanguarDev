import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ActionMenu } from "../../components/common/ActionMenu";
import { Button } from "../../components/common/Button";
import { useToast } from "../../context/ToastContext";
import type { Product } from "../../types";
import * as productService from "../../services/product.service";
import { formatMoney } from "../../utils/currency";
import { SearchIcon, FilterIcon } from "../../components/common/Icons";
import { getErrorMessage } from "../../utils/feedback";
import "../../styles/products.css";

function parseMoney(value: string) {
  const n = Number(value.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ProductsList() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [estadoFilter, setEstadoFilter] = useState("");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [statusModalProduct, setStatusModalProduct] = useState<Product | null>(null);
  const [newStatus, setNewStatus] = useState("Activo");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const errorMessages: Record<string, string> = {
    duplicate_nombre: "Ya existe un producto con ese nombre en esta empresa.",
    duplicate_sku: "Ya existe un producto con ese SKU en esta empresa.",
    estado_invalido: "El estado seleccionado no es válido."
  };

  function normalizeProductStatus(status: string | null | undefined) {
    const value = (status ?? "").trim().toLowerCase();
    if (value === "activo") return "activo";
    if (value === "pausado") return "pausado";
    if (value === "desactivado") return "desactivado";
    return "activo";
  }

  function getProductStatusMeta(status: string | null | undefined) {
    const normalized = normalizeProductStatus(status);
    if (normalized === "pausado") {
      return { className: "statusPill statusPill--pausado", label: "Pausado" };
    }
    if (normalized === "desactivado") {
      return { className: "statusPill statusPill--desactivado", label: "Desactivado" };
    }
    return { className: "statusPill statusPill--activo", label: "Activo" };
  }

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await productService.listProducts();
      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err, {}, "No se pudieron cargar los productos"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    let result = items;
    if (activeTab === "Activos") result = result.filter((p) => normalizeProductStatus(p.estado) === "activo");
    if (activeTab === "Desactivados") result = result.filter((p) => normalizeProductStatus(p.estado) === "desactivado");

    const q = filter.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        return (
          (p.nombre?.toLowerCase() || "").includes(q) ||
          (p.sku?.toLowerCase() || "").includes(q) ||
          (p.descripcion?.toLowerCase() || "").includes(q)
        );
      });
    }

    if (estadoFilter) {
      result = result.filter((p) => normalizeProductStatus(p.estado) === normalizeProductStatus(estadoFilter));
    }
    
    const min = parseFloat(precioMin);
    if (!isNaN(min)) {
      result = result.filter((p) => Number(p.precio_ars) >= min);
    }
    
    const max = parseFloat(precioMax);
    if (!isNaN(max)) {
      result = result.filter((p) => Number(p.precio_ars) <= max);
    }

    return result;
  }, [filter, items, activeTab, estadoFilter, precioMin, precioMax]);

  async function handleUpdateStatus() {
    if (!statusModalProduct) return;
    try {
      const { id, ...payload } = statusModalProduct;
      const updated = await productService.updateProduct(id, {
        ...payload,
        estado: newStatus
      });
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      setStatusModalProduct(null);
      showToast({ type: "success", text: "Estado del producto actualizado" });
    } catch (err) {
      setError(getErrorMessage(err, errorMessages, "No se pudo actualizar el estado del producto"));
    }
  }

  return (
    <div className="page">
      <div>
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle">Productos</h1>
            <div className="pageSubtitle">Visualizá y gestioná tu catálogo de productos</div>
          </div>
          <div className="actions">
            <Button className="btn--ghost">
              <span style={{ marginRight: 8 }}>↑</span> Importar
            </Button>
            <Button className="btn--ghost">
              <span style={{ marginRight: 8 }}>↓</span> Exportar lista
            </Button>
            <Button onClick={() => navigate("/products/new")} className="btn--gradient">
              + Nuevo producto
            </Button>
          </div>
        </div>

        <div className="pageTabs">
          <button className={`pageTabPill ${activeTab === "Todos" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Todos")}>Todos</button>
          <button className={`pageTabPill ${activeTab === "Activos" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Activos")}>Activos</button>
          <button className={`pageTabPill ${activeTab === "Desactivados" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Desactivados")}>Desactivados</button>
        </div>

        <div className="filterToolbar" style={{ marginBottom: showAdvancedFilters ? 16 : 24 }}>
          <input
            className="searchBarInput"
            placeholder="Buscar..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button onClick={() => setShowAdvancedFilters(!showAdvancedFilters)} className="btn--ghost" style={{ display: "flex", gap: 8 }}>
            <FilterIcon /> Filtros
          </Button>
        </div>

        {showAdvancedFilters && (
          <div className="filterToolbar" style={{ padding: "16px", background: "transparent", border: "1px solid var(--border)", borderRadius: "12px", marginTop: "-8px", marginBottom: "24px" }}>
            <select value={estadoFilter} onChange={(e) => setEstadoFilter(e.target.value)} className="select" style={{ backgroundColor: "var(--surface)", flex: 1 }}>
              <option value="">Estado (todos)</option>
              <option value="activo">Activo</option>
              <option value="pausado">Pausado</option>
              <option value="desactivado">Desactivado</option>
            </select>
            <div className="dateRange" style={{ flex: 1 }}>
              <span className="hint" style={{ fontSize: "0.85rem", fontWeight: 500 }}>Precio:</span>
              <input type="number" placeholder="Min" value={precioMin} onChange={(e) => setPrecioMin(e.target.value)} className="input" />
              <span className="hint">—</span>
              <input type="number" placeholder="Max" value={precioMax} onChange={(e) => setPrecioMax(e.target.value)} className="input" />
            </div>
            <Button className="btn--ghost" onClick={() => { setFilter(""); setEstadoFilter(""); setPrecioMin(""); setPrecioMax(""); }} style={{ flex: "0 0 auto", backgroundColor: "var(--surface)", color: "var(--text-muted)", fontSize: "0.85rem", border: "1px solid var(--border)" }}>
              Borrar filtros
            </Button>
          </div>
        )}
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="hint">Cargando...</div> : null}

      <div className="tableWrap">
        <table className="table table--min980">
          <thead>
            <tr>
              <th className="checkboxCol"><input type="checkbox" /></th>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>SKU</th>
              <th>Descripción</th>
              <th>Precio</th>
              <th>Estado</th>
              <th className="colActions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const ars = parseMoney(p.precio_ars) ?? 0;
              const usd = parseMoney(p.precio_usd) ?? 0;
              const statusMeta = getProductStatusMeta(p.estado);
              
              return (
                <tr key={p.id}>
                  <td><input type="checkbox" /></td>
                  <td className="colName">
                    <button
                      type="button"
                      className="productLink productLinkButton"
                      onClick={() => navigate(`/products/${p.id}/edit`)}
                    >
                      {p.nombre}
                    </button>
                  </td>
                  <td>{p.tipo_producto || "-"}</td>
                  <td>{p.sku ?? "-"}</td>
                  <td className="colDescription">
                    {p.descripcion ?? "-"}
                  </td>
                  <td>
                    <div>{formatMoney(ars, "ARS")}</div>
                    <div className="priceUsd">{formatMoney(usd, "USD")}</div>
                  </td>
                  <td>
                    <span className={statusMeta.className}>
                      {statusMeta.label}
                    </span>
                  </td>
                  <td className="colActions">
                    <ActionMenu
                      items={[
                        {
                          label: "Editar",
                          onClick: () => navigate(`/products/${p.id}/edit`)
                        },
                        {
                          label: "Cambiar Estado",
                          onClick: () => {
                            setNewStatus(statusMeta.label);
                            setStatusModalProduct(p);
                          }
                        }
                      ]}
                    />
                  </td>
                </tr>
              );
            })}
            {!filtered.length && !loading ? (
              <tr>
                <td className="cellEmpty colActions" colSpan={8}>
                  No se encontraron productos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {statusModalProduct ? createPortal(
        <div className="modalOverlay" onClick={() => setStatusModalProduct(null)}>
          <div className="modalContent" onClick={(event) => event.stopPropagation()}>
            <h3>Cambiar Estado</h3>
            <p>{statusModalProduct.nombre}</p>
            <div className="modalField">
              <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)} className="select modalControl">
                <option value="activo">Activo</option>
                <option value="pausado">Pausado</option>
                <option value="discontinuado">Discontinuado</option>
              </select>
            </div>
            <div className="modalActions">
              <Button onClick={() => setStatusModalProduct(null)} className="btn--ghost">
                Cancelar
              </Button>
              <Button disabled={loading} onClick={() => void handleUpdateStatus()} className="btn--primary">
                Guardar
              </Button>
            </div>
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
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
  const [statusModalProduct, setStatusModalProduct] = useState<Product | null>(null);
  const [newStatus, setNewStatus] = useState("Activo");
  const navigate = useNavigate();
  const { showToast } = useToast();

  const errorMessages: Record<string, string> = {
    duplicate_nombre: "Ya existe un producto con ese nombre en esta empresa.",
    duplicate_sku: "Ya existe un producto con ese SKU en esta empresa.",
    stock_invalido: "El stock ingresado no es válido.",
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
    return result;
  }, [filter, items, activeTab]);

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
            <Button onClick={() => navigate("/products/new")} className="btn--primary">
              + Nuevo producto
            </Button>
          </div>
        </div>

        <div className="pageTabs">
          <button className={`pageTabPill ${activeTab === "Todos" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Todos")}>Todos</button>
          <button className={`pageTabPill ${activeTab === "Activos" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Activos")}>Activos</button>
          <button className={`pageTabPill ${activeTab === "Desactivados" ? "pageTabPill--active" : ""}`} onClick={() => setActiveTab("Desactivados")}>Desactivados</button>
        </div>

        <div className="filterToolbar">
          <input
            className="searchBarInput"
            placeholder="Buscar..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <Button className="btn--ghost" style={{ display: "flex", gap: 8 }}>
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
              <th className="checkboxCol"><input type="checkbox" /></th>
              <th>Nombre</th>
              <th>SKU</th>
              <th>Descripción</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th className="colActions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const ars = parseMoney(p.precio_ars) ?? 0;
              const usd = parseMoney(p.precio_usd) ?? 0;
              const stockLabel = p.stock === -1 ? "Ilimitado" : p.stock;
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
                  <td>{p.sku ?? "-"}</td>
                  <td className="colDescription">
                    {p.descripcion ?? "-"}
                  </td>
                  <td>
                    <div>{formatMoney(ars, "ARS")}</div>
                    <div className="priceUsd">{formatMoney(usd, "USD")}</div>
                  </td>
                  <td>{stockLabel}</td>
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

      {statusModalProduct ? (
        <div className="modalOverlay" onClick={() => setStatusModalProduct(null)}>
          <div className="modalContent" onClick={(event) => event.stopPropagation()}>
            <h3>Cambiar Estado</h3>
            <p>{statusModalProduct.nombre}</p>
            <div className="modalField">
              <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)} className="select modalControl">
                <option value="Activo">Activo</option>
                <option value="Pausado">Pausado</option>
                <option value="Desactivado">Desactivado</option>
              </select>
            </div>
            <div className="modalActions">
              <Button onClick={() => setStatusModalProduct(null)} className="btn--ghost">
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

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/common/Button";
import type { Product } from "../../types";
import * as productService from "../../services/product.service";
import { formatMoney } from "../../utils/currency";
import "../../styles/clients.css";

const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <path d="M21 21L15 15M17 10C17 13.866 13.866 17 10 17C6.13401 17 3 13.866 3 10C3 6.13401 6.13401 3 10 3C13.866 3 17 6.13401 17 10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
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

function parseMoney(value: string) {
  const n = Number(value.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function ProductsList() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [activeTab, setActiveTab] = useState("Todos");
  const navigate = useNavigate();

  async function reload() {
    setLoading(true);
    try {
      const data = await productService.listProducts();
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
    if (activeTab === "Activos") result = result.filter(p => p.estado !== "Desactivado");
    if (activeTab === "Desactivados") result = result.filter(p => p.estado === "Desactivado");

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

  return (
    <div className="page">
      <div className="pageHeader">
        <div>
          <h1 className="pageTitle">Productos</h1>
          <div className="pageSubtitle">Visualizá y gestioná tu catálogo de productos</div>
        </div>
        <div className="actions">
          <Button className="btn--ghost" style={{ background: "transparent", border: "1px solid var(--border)", color: "#111827", fontWeight: 600 }}>
            <span style={{ marginRight: 8 }}>↑</span> Importar
          </Button>
          <Button className="btn--ghost" style={{ background: "transparent", border: "1px solid var(--border)", color: "#111827", fontWeight: 600 }}>
            <span style={{ marginRight: 8 }}>↓</span> Exportar lista
          </Button>
          <Button onClick={() => navigate("/products/new")} style={{ background: "#111827", color: "#fff", border: "none", fontWeight: 600 }}>
            + Nuevo producto
          </Button>
        </div>
      </div>

      <div className="clientsTabs">
        <button className={`tabPill ${activeTab === "Todos" ? "tabPill--active" : ""}`} onClick={() => setActiveTab("Todos")}>Todos</button>
        <button className={`tabPill ${activeTab === "Activos" ? "tabPill--active" : ""}`} onClick={() => setActiveTab("Activos")}>Activos</button>
        <button className={`tabPill ${activeTab === "Desactivados" ? "tabPill--active" : ""}`} onClick={() => setActiveTab("Desactivados")}>Desactivados</button>
        <button className="tabPill tabPill--icon">+</button>
      </div>

      <div className="toolbar">
        <div className="searchBar">
          <input
            placeholder="Buscar..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          <div style={{ opacity: 0.5 }}><SearchIcon /></div>
        </div>
        <Button className="btn--ghost" style={{ background: "rgba(17,24,39,0.05)", border: "none", fontWeight: 500, display: "flex", gap: 8 }}>
          <FilterIcon /> Filtrar
        </Button>
      </div>

      {loading ? <div className="hint">Cargando...</div> : null}

      <div className="tableWrap">
        <table className="table table--min980">
          <thead>
            <tr>
              <th style={{ width: 40 }}><input type="checkbox" /></th>
              <th>Nombre</th>
              <th>SKU</th>
              <th>Descripción</th>
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th style={{ textAlign: "center" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const ars = parseMoney(p.precio_ars) ?? 0;
              const usd = parseMoney(p.precio_usd) ?? 0;
              const stockLabel = p.stock === -1 ? "Ilimitado" : p.stock;
              
              return (
                <tr key={p.id}>
                  <td><input type="checkbox" /></td>
                  <td style={{ fontWeight: 500 }}>
                    <Link style={{ textDecoration: "none", color: "inherit" }} to={`/products/${p.id}`}>
                      {p.nombre}
                    </Link>
                  </td>
                  <td>{p.sku ?? "-"}</td>
                  <td style={{ maxWidth: 200, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.descripcion ?? "-"}
                  </td>
                  <td>
                    <div>{formatMoney(ars, "ARS")}</div>
                    <div style={{ fontSize: 13, opacity: 0.8 }}>{formatMoney(usd, "USD")}</div>
                  </td>
                  <td>{stockLabel}</td>
                  <td>
                    <span className={`statusPill statusPill--${p.estado?.toLowerCase() === "desactivado" ? "baja" : "activo"}`}>
                      {p.estado ?? "Activo"}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", opacity: 0.6 }}>
                      <DotsIcon />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length && !loading ? (
              <tr>
                <td className="cellEmpty" colSpan={8} style={{ textAlign: "center" }}>
                  No se encontraron productos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

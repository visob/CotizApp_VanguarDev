import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/common/Button";
import type { Product } from "../../types";
import * as productService from "../../services/product.service";
import { formatMoney } from "../../utils/currency";

type ProductDraft = {
  nombre: string;
  precio_ars: string;
  precio_usd: string;
  stock: string;
};

const emptyDraft: ProductDraft = {
  nombre: "",
  precio_ars: "",
  precio_usd: "",
  stock: "0"
};

function parseMoney(value: string) {
  const n = Number(value.replace(",", ".").trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function parseStock(value: string) {
  const n = Number(value.trim());
  if (!Number.isFinite(n)) return null;
  const int = Math.trunc(n);
  return int >= 0 ? int : null;
}

function contains(value: unknown, query: string) {
  if (!query) return true;
  if (typeof value !== "string") return false;
  return value.toLowerCase().includes(query);
}

export default function ProductsPage() {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return items.filter((p) => {
      return contains(p.nombre, q) || String(p.id).includes(q);
    });
  }, [filter, items]);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await productService.listProducts();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "load_error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft);
  }

  function startEdit(item: Product) {
    setEditingId(item.id);
    setDraft({
      nombre: item.nombre,
      precio_ars: item.precio_ars,
      precio_usd: item.precio_usd,
      stock: String(item.stock)
    });
  }

  async function onSave() {
    setError(null);
    const nombre = draft.nombre.trim();
    if (!nombre) {
      setError("La descripción es obligatoria");
      return;
    }

    const ars = parseMoney(draft.precio_ars);
    const usd = parseMoney(draft.precio_usd);
    if (ars === null || usd === null) {
      setError("Debés ingresar precios válidos en ARS y USD");
      return;
    }

    const stock = parseStock(draft.stock);
    if (stock === null) {
      setError("Stock inválido");
      return;
    }

    const payload: Omit<Product, "id"> = {
      nombre,
      precio_ars: String(ars),
      precio_usd: String(usd),
      stock
    };

    setLoading(true);
    try {
      if (editingId) {
        const updated = await productService.updateProduct(editingId, payload);
        setItems((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await productService.createProduct(payload);
        setItems((prev) => [created, ...prev]);
      }
      startCreate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "save_error");
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: number) {
    setError(null);
    setLoading(true);
    try {
      await productService.deleteProduct(id);
      setItems((prev) => prev.filter((p) => p.id !== id));
      if (editingId === id) {
        startCreate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "delete_error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <div>
        <div className="pageHeader">
          <div>
            <h1 className="pageTitle">Productos</h1>
          <div className="pageSubtitle">Catálogo bimonetario (ARS / USD) y stock</div>
        </div>
        <Button onClick={startCreate} className="btn--primary">
          + Nuevo producto
        </Button>
      </div>

      <div className="stack maxw-720">
        <div className="sectionTitle">{editingId ? `Editar SKU #${editingId}` : "Nuevo"}</div>
        <div className="formGrid formGrid--4">
          <label className="field">
            <span className="label">Descripción</span>
            <input
              value={draft.nombre}
              onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
              className="input"
            />
          </label>
          <label className="field">
            <span className="label">Precio ARS</span>
            <input
              value={draft.precio_ars}
              onChange={(e) => setDraft((d) => ({ ...d, precio_ars: e.target.value }))}
              inputMode="decimal"
              className="input"
            />
          </label>
          <label className="field">
            <span className="label">Precio USD</span>
            <input
              value={draft.precio_usd}
              onChange={(e) => setDraft((d) => ({ ...d, precio_usd: e.target.value }))}
              inputMode="decimal"
              className="input"
            />
          </label>
          <label className="field">
            <span className="label">Stock</span>
            <input
              value={draft.stock}
              onChange={(e) => setDraft((d) => ({ ...d, stock: e.target.value }))}
              inputMode="numeric"
              className="input"
            />
          </label>
        </div>

        <div className="actions">
          <Button disabled={loading} onClick={() => void onSave()} className="btn--primary">
            Guardar
          </Button>
          <Button disabled={loading} onClick={startCreate} className="btn--ghost">
            Cancelar
          </Button>
        </div>
      </div>

      <div className="filterToolbar">
        <input
          placeholder="Filtrar (SKU o descripción...)"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="searchBarInput"
        />
        <Button disabled={loading} onClick={() => void reload()} className="btn--ghost">
          Actualizar
        </Button>
      </div>
      </div>

      {error ? <div className="error">{error}</div> : null}
      {loading ? <div className="hint">Cargando...</div> : null}

      <div className="tableWrap">
        <table className="table table--min820">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Descripción</th>
              <th>ARS</th>
              <th>USD</th>
              <th>Stock</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const ars = parseMoney(p.precio_ars) ?? 0;
              const usd = parseMoney(p.precio_usd) ?? 0;
              return (
                <tr key={p.id}>
                  <td className="cellMuted">{p.id}</td>
                  <td>{p.nombre}</td>
                  <td>{formatMoney(ars, "ARS")}</td>
                  <td>{formatMoney(usd, "USD")}</td>
                  <td>{p.stock}</td>
                  <td className="row">
                    <Button disabled={loading} onClick={() => startEdit(p)} className="btn--sm">
                      Editar
                    </Button>
                    <Button disabled={loading} onClick={() => void onDelete(p.id)} className="btn--sm btn--ghost">
                      Eliminar
                    </Button>
                  </td>
                </tr>
              );
            })}
            {!filtered.length ? (
              <tr>
                <td className="cellEmpty" colSpan={6}>
                  Sin resultados
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

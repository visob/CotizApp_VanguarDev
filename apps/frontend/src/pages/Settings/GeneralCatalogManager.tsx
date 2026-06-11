import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/common/Button";
import type { CatalogOption, CatalogOptionType } from "../../types";
import * as configService from "../../services/config.service";

type DraftState = Record<CatalogOptionType, { label: string; value: string }>;

const sectionMeta: Record<
  CatalogOptionType,
  { title: string; description: string; valueLabel: string; hideValueInput?: boolean }
> = {
  forma_pago: {
    title: "Forma de Pago",
    description: "Opciones disponibles para nuevas cotizaciones.",
    valueLabel: "Valor",
    hideValueInput: true
  },
  lugar_entrega: {
    title: "Lugar de Entrega",
    description: "Opciones activas por empresa para cotizaciones.",
    valueLabel: "Valor",
    hideValueInput: true
  },
  tipo_iva: {
    title: "Tipo de IVA",
    description: "Define la etiqueta visible y el porcentaje a aplicar.",
    valueLabel: "Porcentaje"
  }
};

function toNonEmptyString(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildValue(tipo: CatalogOptionType, label: string, value: string) {
  const trimmedValue = toNonEmptyString(value);
  if (tipo === "tipo_iva") {
    return trimmedValue;
  }
  return trimmedValue ?? toNonEmptyString(label);
}

export function GeneralCatalogManager() {
  const [items, setItems] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftState>({
    forma_pago: { label: "", value: "" },
    lugar_entrega: { label: "", value: "" },
    tipo_iva: { label: "", value: "" }
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const [editingValue, setEditingValue] = useState("");

  async function loadItems() {
    setLoading(true);
    setError(null);
    try {
      const next = await configService.listCatalogOptions({ includeInactive: true });
      setItems(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error_cargando_catalogos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
  }, []);

  const grouped = useMemo(() => {
    return {
      forma_pago: items.filter((item) => item.tipo === "forma_pago"),
      lugar_entrega: items.filter((item) => item.tipo === "lugar_entrega"),
      tipo_iva: items.filter((item) => item.tipo === "tipo_iva")
    } satisfies Record<CatalogOptionType, CatalogOption[]>;
  }, [items]);

  async function handleCreate(tipo: CatalogOptionType) {
    const label = toNonEmptyString(drafts[tipo].label);
    const value = buildValue(tipo, drafts[tipo].label, drafts[tipo].value);
    if (!label || !value) {
      setError(`Completá los campos de ${sectionMeta[tipo].title}`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await configService.createCatalogOption({ tipo, label, value });
      setDrafts((prev) => ({
        ...prev,
        [tipo]: { label: "", value: "" }
      }));
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error_creando_catalogo");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(item: CatalogOption) {
    const label = toNonEmptyString(editingLabel);
    const value = buildValue(item.tipo, editingLabel, editingValue);
    if (!label || !value) {
      setError("Completá los campos antes de guardar");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await configService.updateCatalogOption(item.id, { label, value });
      setEditingId(null);
      setEditingLabel("");
      setEditingValue("");
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error_actualizando_catalogo");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(id: number) {
    if (!window.confirm("¿Desactivar opción? Ya no se ofrecerá en nuevas cotizaciones.")) return;
    setSaving(true);
    setError(null);
    try {
      await configService.deactivateCatalogOption(id);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "error_desactivando_catalogo");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settingsWideCard">
      <h2 className="settingsSectionTitle">Catálogos de Cotización</h2>
      <div className="hint">Estas opciones pertenecen solo a la empresa actual.</div>
      {error ? <div className="error" style={{ marginTop: 12 }}>{error}</div> : null}
      {loading ? <div className="hint" style={{ marginTop: 12 }}>Cargando catálogos...</div> : null}

      <div className="stack" style={{ marginTop: 16 }}>
        {(Object.keys(sectionMeta) as CatalogOptionType[]).map((tipo) => {
          const meta = sectionMeta[tipo];
          const list = grouped[tipo];
          return (
            <div key={tipo} className="card" style={{ padding: 16 }}>
              <div className="sectionTitle">{meta.title}</div>
              <div className="hint" style={{ marginTop: 4 }}>{meta.description}</div>

              <div className="formGrid formGrid--2" style={{ marginTop: 12 }}>
                <label className="field">
                  <span className="label">Etiqueta</span>
                  <input
                    className="input"
                    value={drafts[tipo].label}
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [tipo]: { ...prev[tipo], label: e.target.value }
                      }))
                    }
                  />
                </label>
                {!meta.hideValueInput ? (
                  <label className="field">
                    <span className="label">{meta.valueLabel}</span>
                    <input
                      className="input"
                      value={drafts[tipo].value}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [tipo]: { ...prev[tipo], value: e.target.value }
                        }))
                      }
                      placeholder={tipo === "tipo_iva" ? "Ej: 21 o 10.5" : ""}
                    />
                  </label>
                ) : (
                  <div className="hint" style={{ alignSelf: "end" }}>
                    El valor interno será el mismo texto de la etiqueta.
                  </div>
                )}
              </div>

              <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
                <Button
                  className="btn--primary"
                  disabled={saving}
                  onClick={() => void handleCreate(tipo)}
                >
                  {saving ? "Guardando..." : "Agregar opción"}
                </Button>
              </div>

              <div className="tableWrap" style={{ marginTop: 12 }}>
                <table className="table table--min720">
                  <thead>
                    <tr>
                      <th>Etiqueta</th>
                      <th>{meta.hideValueInput ? "Valor interno" : meta.valueLabel}</th>
                      <th>Estado</th>
                      <th className="nowrap">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item) => {
                      const isEditing = editingId === item.id;
                      return (
                        <tr key={item.id}>
                          <td>
                            {isEditing ? (
                              <input
                                className="input"
                                value={editingLabel}
                                onChange={(e) => setEditingLabel(e.target.value)}
                              />
                            ) : (
                              item.label
                            )}
                          </td>
                          <td>
                            {isEditing ? (
                              meta.hideValueInput ? (
                                <span className="hint">Se actualiza junto con la etiqueta</span>
                              ) : (
                                <input
                                  className="input"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                />
                              )
                            ) : (
                              item.value
                            )}
                          </td>
                          <td>{item.activo ? "Activa" : "Inactiva"}</td>
                          <td className="nowrap">
                            <div className="row" style={{ gap: 8 }}>
                              {isEditing ? (
                                <>
                                  <Button
                                    className="btn--sm"
                                    onClick={() => {
                                      setEditingId(null);
                                      setEditingLabel("");
                                      setEditingValue("");
                                    }}
                                    disabled={saving}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    className="btn--sm btn--primary"
                                    onClick={() => void handleSaveEdit(item)}
                                    disabled={saving}
                                  >
                                    Guardar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    className="btn--sm"
                                    onClick={() => {
                                      setEditingId(item.id);
                                      setEditingLabel(item.label);
                                      setEditingValue(item.value);
                                      setError(null);
                                    }}
                                    disabled={saving}
                                  >
                                    Editar
                                  </Button>
                                  {item.activo ? (
                                    <Button
                                      className="btn--sm btn--danger"
                                      onClick={() => void handleDeactivate(item.id)}
                                      disabled={saving}
                                    >
                                      Desactivar
                                    </Button>
                                  ) : null}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!list.length ? (
                      <tr>
                        <td className="cellEmpty" colSpan={4}>
                          No hay opciones configuradas.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/common/Button";
import { useAuth } from "../../context/AuthContext";
import type { Company, ManagedUser, UserRole } from "../../types";
import * as companyService from "../../services/company.service";
import * as configService from "../../services/config.service";
import * as userAdminService from "../../services/userAdmin.service";
import "../../styles/settings.css";

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function roleLabel(value: UserRole) {
  if (value === "SuperAdmin") return "SuperAdmin";
  if (value === "Admin") return "Admin";
  return "Vendedor";
}

function getUserLockStatus(user: ManagedUser) {
  if (user.lock_until) {
    const lockUntilMs = new Date(user.lock_until).getTime();
    if (Number.isFinite(lockUntilMs) && lockUntilMs > Date.now()) {
      const remainingMinutes = Math.max(1, Math.ceil((lockUntilMs - Date.now()) / 60_000));
      return {
        locked: true,
        tone: "locked" as const,
        label: `Bloqueado · nivel ${Math.max(1, user.lock_level)} · ${remainingMinutes} min restantes`
      };
    }
  }

  if (user.failed_login_attempts > 0) {
    return {
      locked: false,
      tone: "warning" as const,
      label: `${user.failed_login_attempts} intento${user.failed_login_attempts === 1 ? "" : "s"} fallido${user.failed_login_attempts === 1 ? "" : "s"} · nivel ${user.lock_level}`
    };
  }

  if (user.lock_level > 0) {
    return {
      locked: false,
      tone: "ok" as const,
      label: `Sin bloqueo activo · nivel ${user.lock_level}`
    };
  }

  return {
    locked: false,
    tone: "ok" as const,
    label: "Sin bloqueos"
  };
}

type TabKey = "general" | "users" | "companies";

export default function SettingsPage() {
  const { user } = useAuth();

  const isSuperAdmin = user?.rol === "SuperAdmin";
  const canManageUsers = user?.rol === "SuperAdmin" || user?.rol === "Admin";

  const tabs = useMemo(() => {
    const items: Array<{ key: TabKey; label: string }> = [];
    if (!isSuperAdmin) items.push({ key: "general", label: "General" });
    if (canManageUsers) items.push({ key: "users", label: "Usuarios" });
    if (isSuperAdmin) items.push({ key: "companies", label: "Empresas" });
    return items;
  }, [canManageUsers, isSuperAdmin]);

  const [activeTab, setActiveTab] = useState<TabKey>(() => (isSuperAdmin ? "users" : "general"));

  const [exchangeRate, setExchangeRate] = useState("1000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesIncludeInactive, setCompaniesIncludeInactive] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [companySaving, setCompanySaving] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [editingCompanyName, setEditingCompanyName] = useState("");

  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersIncludeInactive, setUsersIncludeInactive] = useState(false);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [userCompanyFilter, setUserCompanyFilter] = useState<number | "all">("all");

  const [creatingUser, setCreatingUser] = useState(false);
  const [userSaving, setUserSaving] = useState(false);
  const [newUserNombre, setNewUserNombre] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>(isSuperAdmin ? "Admin" : "Vendedor");
  const [newUserCompanyId, setNewUserCompanyId] = useState<number | "">(
    typeof user?.empresaId === "number" ? user.empresaId : ""
  );

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserNombre, setEditUserNombre] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserRole, setEditUserRole] = useState<UserRole>("Vendedor");
  const [editUserActivo, setEditUserActivo] = useState(true);
  const [editUserCompanyId, setEditUserCompanyId] = useState<number | "">("");

  useEffect(() => {
    async function fetchConfig() {
      if (isSuperAdmin) {
        setLoading(false);
        return;
      }
      const rate = await configService.getConfig("exchange_rate");
      if (rate) setExchangeRate(rate.valor);
      setLoading(false);
    }
    void fetchConfig();
  }, [isSuperAdmin]);

  useEffect(() => {
    if (tabs.some((t) => t.key === activeTab)) return;
    setActiveTab(tabs[0]?.key ?? "general");
  }, [activeTab, tabs]);

  async function loadCompanies() {
    if (!isSuperAdmin) return;
    setCompaniesLoading(true);
    setCompaniesError(null);
    try {
      const items = await companyService.listCompanies({ includeInactive: companiesIncludeInactive });
      setCompanies(items);
    } catch (err) {
      setCompaniesError(err instanceof Error ? err.message : "error_cargando_empresas");
    } finally {
      setCompaniesLoading(false);
    }
  }

  async function loadUsers() {
    if (!canManageUsers) return;
    setUsersLoading(true);
    setUsersError(null);
    try {
      const companyId =
        userCompanyFilter === "all"
          ? undefined
          : typeof userCompanyFilter === "number"
            ? userCompanyFilter
            : undefined;
      const items = await userAdminService.listUsers({
        includeInactive: usersIncludeInactive,
        companyId
      });
      setUsers(items);
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "error_cargando_usuarios");
    } finally {
      setUsersLoading(false);
    }
  }

  useEffect(() => {
    if (isSuperAdmin) {
      void loadCompanies();
    }
  }, [isSuperAdmin, companiesIncludeInactive]);

  useEffect(() => {
    if (canManageUsers) {
      void loadUsers();
    }
  }, [canManageUsers, usersIncludeInactive, userCompanyFilter]);

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

  async function handleCreateCompany() {
    const nombre = toNonEmptyString(newCompanyName);
    if (!nombre) {
      setCompaniesError("Ingresá un nombre de empresa");
      return;
    }

    setCompanySaving(true);
    setCompaniesError(null);
    try {
      await companyService.createCompany({ nombre });
      setNewCompanyName("");
      await loadCompanies();
    } catch (err) {
      setCompaniesError(err instanceof Error ? err.message : "error_creando_empresa");
    } finally {
      setCompanySaving(false);
    }
  }

  async function handleUpdateCompany(id: number) {
    const nombre = toNonEmptyString(editingCompanyName);
    if (!nombre) {
      setCompaniesError("Ingresá un nombre de empresa");
      return;
    }
    setCompanySaving(true);
    setCompaniesError(null);
    try {
      await companyService.updateCompany(id, { nombre });
      setEditingCompanyId(null);
      setEditingCompanyName("");
      await loadCompanies();
    } catch (err) {
      setCompaniesError(err instanceof Error ? err.message : "error_actualizando_empresa");
    } finally {
      setCompanySaving(false);
    }
  }

  async function handleDeactivateCompany(id: number) {
    if (!window.confirm("¿Desactivar empresa? No se elimina, solo queda inactiva.")) return;
    setCompanySaving(true);
    setCompaniesError(null);
    try {
      await companyService.deactivateCompany(id);
      await loadCompanies();
    } catch (err) {
      setCompaniesError(err instanceof Error ? err.message : "error_desactivando_empresa");
    } finally {
      setCompanySaving(false);
    }
  }

  function openEditUser(item: ManagedUser) {
    setEditingUserId(item.id);
    setEditUserNombre(item.nombre);
    setEditUserEmail(item.email);
    setEditUserPassword("");
    setEditUserRole(item.rol);
    setEditUserActivo(item.activo);
    setEditUserCompanyId(item.id_empresa ?? "");
    setUsersError(null);
    setCreatingUser(false);
  }

  function closeEditUser() {
    setEditingUserId(null);
    setEditUserNombre("");
    setEditUserEmail("");
    setEditUserPassword("");
    setUsersError(null);
  }

  async function handleCreateUser() {
    const nombre = toNonEmptyString(newUserNombre);
    const email = toNonEmptyString(newUserEmail);
    const password = toNonEmptyString(newUserPassword);
    const rol = newUserRole;

    if (!nombre || !email || !password) {
      setUsersError("Completá nombre, email y contraseña");
      return;
    }

    const payload: Parameters<typeof userAdminService.createUser>[0] = {
      nombre,
      email: normalizeEmail(email),
      password,
      rol
    };

    if (isSuperAdmin) {
      const companyId = typeof newUserCompanyId === "number" ? newUserCompanyId : null;
      if (!companyId) {
        setUsersError("Seleccioná una empresa para el usuario");
        return;
      }
      payload.id_empresa = companyId;
    }

    setUserSaving(true);
    setUsersError(null);
    try {
      await userAdminService.createUser(payload);
      setNewUserNombre("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole(isSuperAdmin ? "Admin" : "Vendedor");
      setCreatingUser(false);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "error_creando_usuario");
    } finally {
      setUserSaving(false);
    }
  }

  async function handleUpdateUser() {
    if (!editingUserId) return;

    const nombre = toNonEmptyString(editUserNombre);
    const email = toNonEmptyString(editUserEmail);
    if (!nombre || !email) {
      setUsersError("Completá nombre y email");
      return;
    }

    const payload: Parameters<typeof userAdminService.updateUser>[1] = {
      nombre,
      email: normalizeEmail(email),
      rol: editUserRole,
      activo: editUserActivo
    };

    const password = toNonEmptyString(editUserPassword);
    if (password) {
      payload.password = password;
    }

    if (isSuperAdmin) {
      const companyId = typeof editUserCompanyId === "number" ? editUserCompanyId : null;
      if (!companyId) {
        setUsersError("Seleccioná una empresa para el usuario");
        return;
      }
      payload.id_empresa = companyId;
    }

    setUserSaving(true);
    setUsersError(null);
    try {
      await userAdminService.updateUser(editingUserId, payload);
      closeEditUser();
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "error_actualizando_usuario");
    } finally {
      setUserSaving(false);
    }
  }

  async function handleDeactivateUser(id: number) {
    if (!window.confirm("¿Desactivar usuario? No se elimina, solo queda inactivo.")) return;
    setUserSaving(true);
    setUsersError(null);
    try {
      await userAdminService.deactivateUser(id);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "error_desactivando_usuario");
    } finally {
      setUserSaving(false);
    }
  }

  async function handleUnlockUser(id: number) {
    if (!window.confirm("¿Desbloquear usuario y resetear intentos fallidos?")) return;
    setUserSaving(true);
    setUsersError(null);
    try {
      await userAdminService.unlockUser(id);
      await loadUsers();
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "error_desbloqueando_usuario");
    } finally {
      setUserSaving(false);
    }
  }

  if (loading && !isSuperAdmin) {
    return (
      <div className="page">
        <div className="hint">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="page">
      <div
        className="pageHeader"
        style={{ borderBottom: "1px solid var(--border)", paddingBottom: 24, marginBottom: 12 }}
      >
        <div>
          <h1 className="pageTitle">Configuración</h1>
          <div className="pageSubtitle" style={{ marginTop: 8 }}>
            Ajustes globales del sistema
          </div>
        </div>
      </div>

      <div className="pageTabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={["pageTabPill", tab.key === activeTab ? "pageTabPill--active" : ""].join(
              " "
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" ? (
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
              <Button
                disabled={saving}
                onClick={() => void handleSave()}
                style={{ background: "#18181b", color: "#fff", border: "none", minWidth: 120 }}
              >
                {saving ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </div>

            {message ? (
              <div
                className={message.type === "error" ? "error" : "success"}
                style={message.type === "success" ? { fontSize: 14, fontWeight: 500 } : {}}
              >
                {message.text}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "users" && canManageUsers ? (
        <div className="settingsWideCard">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 className="settingsSectionTitle" style={{ borderBottom: "none", paddingBottom: 0 }}>
                Usuarios
              </h2>
              <div className="hint">
                Administración de usuarios{user?.empresaNombre ? ` · ${user.empresaNombre}` : ""}
              </div>
            </div>

            <div className="row">
              <label className="row hint" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={usersIncludeInactive}
                  onChange={(e) => setUsersIncludeInactive(e.target.checked)}
                />
                Incluir inactivos
              </label>
              <Button
                className="btn--primary"
                onClick={() => {
                  setCreatingUser(true);
                  closeEditUser();
                  setUsersError(null);
                }}
              >
                + Nuevo usuario
              </Button>
            </div>
          </div>

          {isSuperAdmin ? (
            <div className="row" style={{ marginTop: 12 }}>
              <label className="field" style={{ width: 280 }}>
                <span className="label">Filtrar por empresa</span>
                <select
                  className="select"
                  value={userCompanyFilter === "all" ? "all" : String(userCompanyFilter)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setUserCompanyFilter(v === "all" ? "all" : Number(v));
                  }}
                >
                  <option value="all">Todas</option>
                  {companies.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          {creatingUser ? (
            <div className="card" style={{ padding: 16, marginTop: 16 }}>
              <div className="sectionTitle">Nuevo usuario</div>
              <div className="formGrid formGrid--2" style={{ marginTop: 10 }}>
                <label className="field">
                  <span className="label">Nombre</span>
                  <input
                    className="input"
                    value={newUserNombre}
                    onChange={(e) => setNewUserNombre(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    className="input"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Contraseña</span>
                  <input
                    className="input"
                    type="password"
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Rol</span>
                  <select
                    className="select"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  >
                    {isSuperAdmin ? (
                      <>
                        <option value="Admin">Admin</option>
                        <option value="Vendedor">Vendedor</option>
                        <option value="SuperAdmin">SuperAdmin</option>
                      </>
                    ) : (
                      <>
                        <option value="Vendedor">Vendedor</option>
                        <option value="Admin">Admin</option>
                      </>
                    )}
                  </select>
                </label>
                {isSuperAdmin ? (
                  <label className="field">
                    <span className="label">Empresa</span>
                    <select
                      className="select"
                      value={newUserCompanyId === "" ? "" : String(newUserCompanyId)}
                      onChange={(e) => setNewUserCompanyId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">Seleccionar...</option>
                      {companies.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
                <Button onClick={() => setCreatingUser(false)} className="btn--ghost" disabled={userSaving}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleCreateUser()} className="btn--primary" disabled={userSaving}>
                  {userSaving ? "Guardando..." : "Crear"}
                </Button>
              </div>
            </div>
          ) : null}

          {editingUserId ? (
            <div className="card" style={{ padding: 16, marginTop: 16 }}>
              <div className="sectionTitle">Editar usuario</div>
              <div className="formGrid formGrid--2" style={{ marginTop: 10 }}>
                <label className="field">
                  <span className="label">Nombre</span>
                  <input
                    className="input"
                    value={editUserNombre}
                    onChange={(e) => setEditUserNombre(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Email</span>
                  <input
                    className="input"
                    value={editUserEmail}
                    onChange={(e) => setEditUserEmail(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Nueva contraseña (opcional)</span>
                  <input
                    className="input"
                    type="password"
                    value={editUserPassword}
                    onChange={(e) => setEditUserPassword(e.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="label">Rol</span>
                  <select
                    className="select"
                    value={editUserRole}
                    onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                  >
                    {isSuperAdmin ? (
                      <>
                        <option value="Admin">Admin</option>
                        <option value="Vendedor">Vendedor</option>
                        <option value="SuperAdmin">SuperAdmin</option>
                      </>
                    ) : (
                      <>
                        <option value="Admin">Admin</option>
                        <option value="Vendedor">Vendedor</option>
                      </>
                    )}
                  </select>
                </label>
                {isSuperAdmin ? (
                  <label className="field">
                    <span className="label">Empresa</span>
                    <select
                      className="select"
                      value={editUserCompanyId === "" ? "" : String(editUserCompanyId)}
                      onChange={(e) => setEditUserCompanyId(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">Sin empresa</option>
                      {companies.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <label className="row hint" style={{ gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={editUserActivo}
                    onChange={(e) => setEditUserActivo(e.target.checked)}
                  />
                  Activo
                </label>
              </div>

              <div className="row" style={{ marginTop: 12, justifyContent: "flex-end" }}>
                <Button onClick={() => closeEditUser()} className="btn--ghost" disabled={userSaving}>
                  Cancelar
                </Button>
                <Button onClick={() => void handleUpdateUser()} className="btn--primary" disabled={userSaving}>
                  {userSaving ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </div>
          ) : null}

          {usersError ? <div className="error" style={{ marginTop: 12 }}>{usersError}</div> : null}
          {usersLoading ? <div className="hint" style={{ marginTop: 12 }}>Cargando...</div> : null}

          <div className="tableWrap" style={{ marginTop: 16 }}>
            <table className="table table--min820">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Empresa</th>
                  <th>Estado</th>
                  <th>Seguridad</th>
                  <th className="nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const lockStatus = getUserLockStatus(u);
                  const canUnlock = lockStatus.locked || u.failed_login_attempts > 0 || u.lock_level > 0;
                  return (
                    <tr key={u.id}>
                      <td>{u.nombre}</td>
                      <td className="cellMuted">{u.email}</td>
                      <td>{roleLabel(u.rol)}</td>
                      <td className="cellMuted">{u.empresa_nombre ?? "-"}</td>
                      <td>{u.activo ? "Activo" : "Inactivo"}</td>
                      <td>
                        <span
                          className={[
                            "securityBadge",
                            lockStatus.tone === "locked"
                              ? "securityBadge--locked"
                              : lockStatus.tone === "warning"
                                ? "securityBadge--warning"
                                : "securityBadge--ok"
                          ].join(" ")}
                        >
                          {lockStatus.label}
                        </span>
                      </td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 8 }}>
                          <Button className="btn--sm" onClick={() => openEditUser(u)} disabled={userSaving}>
                            Editar
                          </Button>
                          {canUnlock ? (
                            <Button
                              className="btn--sm"
                              onClick={() => void handleUnlockUser(u.id)}
                              disabled={userSaving}
                            >
                              Desbloquear
                            </Button>
                          ) : null}
                          {u.activo ? (
                            <Button
                              className="btn--sm btn--danger"
                              onClick={() => void handleDeactivateUser(u.id)}
                              disabled={userSaving}
                            >
                              Desactivar
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!users.length && !usersLoading ? (
                  <tr>
                    <td className="cellEmpty" colSpan={7}>
                      No hay usuarios para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {activeTab === "companies" && isSuperAdmin ? (
        <div className="settingsWideCard">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <h2 className="settingsSectionTitle" style={{ borderBottom: "none", paddingBottom: 0 }}>
                Empresas
              </h2>
              <div className="hint">Creación, lectura, modificación y desactivación</div>
            </div>

            <label className="row hint" style={{ gap: 8 }}>
              <input
                type="checkbox"
                checked={companiesIncludeInactive}
                onChange={(e) => setCompaniesIncludeInactive(e.target.checked)}
              />
              Incluir inactivas
            </label>
          </div>

          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <div className="sectionTitle">Nueva empresa</div>
            <div className="row" style={{ marginTop: 10 }}>
              <label className="field" style={{ flex: 1, minWidth: 260 }}>
                <span className="label">Nombre</span>
                <input
                  className="input"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                />
              </label>
              <Button
                className="btn--primary"
                disabled={companySaving}
                onClick={() => void handleCreateCompany()}
              >
                {companySaving ? "Guardando..." : "Crear"}
              </Button>
            </div>
          </div>

          {companiesError ? <div className="error" style={{ marginTop: 12 }}>{companiesError}</div> : null}
          {companiesLoading ? <div className="hint" style={{ marginTop: 12 }}>Cargando...</div> : null}

          <div className="tableWrap" style={{ marginTop: 16 }}>
            <table className="table table--min720">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Estado</th>
                  <th className="nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => {
                  const isEditing = editingCompanyId === c.id;
                  return (
                    <tr key={c.id}>
                      <td className="cellMuted">{c.id}</td>
                      <td>
                        {isEditing ? (
                          <input
                            className="input"
                            value={editingCompanyName}
                            onChange={(e) => setEditingCompanyName(e.target.value)}
                          />
                        ) : (
                          c.nombre
                        )}
                      </td>
                      <td>{c.activo ? "Activa" : "Inactiva"}</td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 8 }}>
                          {isEditing ? (
                            <>
                              <Button
                                className="btn--sm"
                                onClick={() => {
                                  setEditingCompanyId(null);
                                  setEditingCompanyName("");
                                }}
                                disabled={companySaving}
                              >
                                Cancelar
                              </Button>
                              <Button
                                className="btn--sm btn--primary"
                                onClick={() => void handleUpdateCompany(c.id)}
                                disabled={companySaving}
                              >
                                Guardar
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                className="btn--sm"
                                onClick={() => {
                                  setEditingCompanyId(c.id);
                                  setEditingCompanyName(c.nombre);
                                  setCompaniesError(null);
                                }}
                                disabled={companySaving}
                              >
                                Editar
                              </Button>
                              {c.activo ? (
                                <Button
                                  className="btn--sm btn--danger"
                                  onClick={() => void handleDeactivateCompany(c.id)}
                                  disabled={companySaving}
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
                {!companies.length && !companiesLoading ? (
                  <tr>
                    <td className="cellEmpty" colSpan={4}>
                      No hay empresas para mostrar.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

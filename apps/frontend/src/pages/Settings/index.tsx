import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "../../components/common/Button";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { useAuth } from "../../context/AuthContext";
import type { Company, ManagedUser, UserRole } from "../../types";
import * as companyService from "../../services/company.service";
import * as configService from "../../services/config.service";
import * as userAdminService from "../../services/userAdmin.service";
import { getErrorMessage } from "../../utils/feedback";
import { CompanyFormDialog, createEmptyCompanyDraft, type CompanyDraft } from "./CompanyFormDialog";
import { GeneralCatalogManager } from "./GeneralCatalogManager";
import "../../styles/settings.css";

function toNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function revokeBlobUrl(url: string | null | undefined) {
  if (url?.startsWith("blob:")) {
    URL.revokeObjectURL(url);
  }
}

function roleLabel(value: UserRole) {
  if (value === "SuperAdmin") return "SuperAdmin";
  if (value === "Admin") return "Admin";
  return "Vendedor";
}

const companyErrorMessages: Record<string, string> = {
  nombre_required: "El nombre de la empresa es obligatorio.",
  cuit_required: "El CUIT es obligatorio.",
  razon_social_required: "La razón social es obligatoria.",
  direccion_required: "La dirección es obligatoria.",
  provincia_required: "La provincia es obligatoria.",
  codigo_postal_required: "El código postal es obligatorio.",
  pais_required: "El país es obligatorio.",
  telefono_contacto_required: "El teléfono de contacto es obligatorio.",
  email_required: "El email es obligatorio.",
  email_invalido: "Ingresá un email válido.",
  website_url_invalida: "Ingresá una URL válida para la página web.",
  duplicate_nombre: "Ya existe una empresa con ese nombre.",
  duplicate_cuit: "Ya existe una empresa con ese CUIT.",
  logo_extension_invalida: "El logo debe ser JPG, PNG o ICO.",
  logo_mime_invalido: "El archivo del logo no tiene un formato válido.",
  logo_too_large: "El logo no puede superar los 5MB."
};

function companyToDraft(company: Company): CompanyDraft {
  return {
    nombre: company.nombre ?? "",
    cuit: company.cuit ?? "",
    razon_social: company.razon_social ?? "",
    direccion: company.direccion ?? "",
    provincia: company.provincia ?? "",
    codigo_postal: company.codigo_postal ?? "",
    pais: company.pais ?? "Argentina",
    telefono_contacto: company.telefono_contacto ?? "",
    email: company.email ?? "",
    website_url: company.website_url ?? "",
    footer_text: company.footer_text ?? "",
    logoFile: null,
    logoPreviewUrl: companyService.getCompanyLogoUrl(company.logo_url),
    removeLogo: false
  };
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

type TabKey = "general" | "accessibility" | "users" | "companies";

export default function SettingsPage() {
  const { user } = useAuth();

  const isSuperAdmin = user?.rol === "SuperAdmin";
  const canManageUsers = user?.rol === "SuperAdmin" || user?.rol === "Admin";
  const canManageQuoteCatalogs = user?.rol === "Admin";

  const tabs = useMemo(() => {
    const items: Array<{ key: TabKey; label: string }> = [];
    if (!isSuperAdmin) items.push({ key: "general", label: "Ajustes de Cotización" });
    items.push({ key: "accessibility", label: "Accesibilidad" });
    if (canManageUsers) items.push({ key: "users", label: "Usuarios" });
    if (isSuperAdmin) items.push({ key: "companies", label: "Empresas" });
    return items;
  }, [canManageUsers, isSuperAdmin]);

  const [activeTab, setActiveTab] = useState<TabKey>(() => (isSuperAdmin ? "accessibility" : "general"));

  const [fontSize, setFontSize] = useState(() => localStorage.getItem("app-font-size") || "medium");
  const [reduceAnimations, setReduceAnimations] = useState(() => localStorage.getItem("app-reduce-animations") === "true");

  useEffect(() => {
    localStorage.setItem("app-font-size", fontSize);
    if (fontSize === "small") document.documentElement.style.fontSize = "14px";
    else if (fontSize === "large") document.documentElement.style.fontSize = "18px";
    else document.documentElement.style.fontSize = "16px";
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("app-reduce-animations", String(reduceAnimations));
    if (reduceAnimations) document.documentElement.classList.add("reduce-animations");
    else document.documentElement.classList.remove("reduce-animations");
  }, [reduceAnimations]);

  const [exchangeRate, setExchangeRate] = useState("1000");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [confirm, setConfirm] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    confirmTone: "default" | "danger";
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesIncludeInactive, setCompaniesIncludeInactive] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyDialogMode, setCompanyDialogMode] = useState<"create" | "edit" | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [companyDraft, setCompanyDraft] = useState<CompanyDraft>(() => createEmptyCompanyDraft());

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

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const lowerQ = searchQuery.toLowerCase();
    return users.filter(u => 
      (u.nombre || "").toLowerCase().includes(lowerQ) ||
      (u.email || "").toLowerCase().includes(lowerQ) ||
      (u.empresa_nombre || "").toLowerCase().includes(lowerQ)
    );
  }, [users, searchQuery]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery) return companies;
    const lowerQ = searchQuery.toLowerCase();
    return companies.filter(c => 
      (c.nombre || "").toLowerCase().includes(lowerQ)
    );
  }, [companies, searchQuery]);

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
    setCompanySaving(true);
    setCompaniesError(null);
    try {
      await companyService.createCompany({
        nombre: companyDraft.nombre.trim(),
        cuit: companyDraft.cuit.trim(),
        razon_social: companyDraft.razon_social.trim(),
        direccion: companyDraft.direccion.trim(),
        provincia: companyDraft.provincia.trim(),
        codigo_postal: companyDraft.codigo_postal.trim(),
        pais: companyDraft.pais.trim(),
        telefono_contacto: companyDraft.telefono_contacto.trim(),
        email: companyDraft.email.trim(),
        website_url: companyDraft.website_url.trim() || null,
        footer_text: companyDraft.footer_text.trim() || null,
        logo: companyDraft.logoFile
      });
      revokeBlobUrl(companyDraft.logoPreviewUrl);
      setCompanyDraft(createEmptyCompanyDraft());
      setCompanyDialogMode(null);
      await loadCompanies();
    } catch (err) {
      setCompaniesError(getErrorMessage(err, companyErrorMessages, "No se pudo crear la empresa"));
    } finally {
      setCompanySaving(false);
    }
  }

  async function handleUpdateCompany(id: number) {
    setCompanySaving(true);
    setCompaniesError(null);
    try {
      await companyService.updateCompany(id, {
        nombre: companyDraft.nombre.trim(),
        cuit: companyDraft.cuit.trim(),
        razon_social: companyDraft.razon_social.trim(),
        direccion: companyDraft.direccion.trim(),
        provincia: companyDraft.provincia.trim(),
        codigo_postal: companyDraft.codigo_postal.trim(),
        pais: companyDraft.pais.trim(),
        telefono_contacto: companyDraft.telefono_contacto.trim(),
        email: companyDraft.email.trim(),
        website_url: companyDraft.website_url.trim() || null,
        footer_text: companyDraft.footer_text.trim() || null,
        logo: companyDraft.logoFile,
        remove_logo: companyDraft.removeLogo
      });
      revokeBlobUrl(companyDraft.logoPreviewUrl);
      setEditingCompanyId(null);
      setCompanyDraft(createEmptyCompanyDraft());
      setCompanyDialogMode(null);
      await loadCompanies();
    } catch (err) {
      setCompaniesError(getErrorMessage(err, companyErrorMessages, "No se pudo actualizar la empresa"));
    } finally {
      setCompanySaving(false);
    }
  }

  function updateCompanyDraft<K extends keyof CompanyDraft>(field: K, value: CompanyDraft[K]) {
    setCompanyDraft((current) => ({ ...current, [field]: value }));
  }

  function handleCompanyLogoChange(file: File | null) {
    setCompanyDraft((current) => {
      revokeBlobUrl(current.logoPreviewUrl);
      return {
        ...current,
        logoFile: file,
        logoPreviewUrl: file ? URL.createObjectURL(file) : null,
        removeLogo: file ? false : current.removeLogo
      };
    });
  }

  function openCreateCompanyDialog() {
    revokeBlobUrl(companyDraft.logoPreviewUrl);
    setCompaniesError(null);
    setEditingCompanyId(null);
    setCompanyDraft(createEmptyCompanyDraft());
    setCompanyDialogMode("create");
  }

  function openEditCompanyDialog(company: Company) {
    revokeBlobUrl(companyDraft.logoPreviewUrl);
    setCompaniesError(null);
    setEditingCompanyId(company.id);
    setCompanyDraft(companyToDraft(company));
    setCompanyDialogMode("edit");
  }

  function closeCompanyDialog() {
    revokeBlobUrl(companyDraft.logoPreviewUrl);
    setCompanyDialogMode(null);
    setEditingCompanyId(null);
    setCompanyDraft(createEmptyCompanyDraft());
  }

  function handleDeactivateCompany(id: number) {
    setConfirm({
      title: "Desactivar empresa",
      message: "No se elimina, solo queda inactiva.",
      confirmLabel: "Desactivar",
      confirmTone: "danger",
      onConfirm: async () => {
        setConfirm(null);
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
    });
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

  function handleDeactivateUser(id: number) {
    setConfirm({
      title: "Desactivar usuario",
      message: "No se elimina, solo queda inactivo.",
      confirmLabel: "Desactivar",
      confirmTone: "danger",
      onConfirm: async () => {
        setConfirm(null);
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
    });
  }

  function handleUnlockUser(id: number) {
    setConfirm({
      title: "Desbloquear usuario",
      message: "Se resetearán los intentos fallidos y se quitará el bloqueo.",
      confirmLabel: "Desbloquear",
      confirmTone: "default",
      onConfirm: async () => {
        setConfirm(null);
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
    });
  }

  if (loading && !isSuperAdmin) {
    return (
      <div className="page">
        <div className="hint">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div className="page" style={{ height: "calc(100vh - 100px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <div
        className="pageHeader"
        style={{ borderBottom: "1px solid var(--border)", paddingBottom: 16, flexShrink: 0 }}
      >
        <div>
          <h1 className="pageTitle">Configuración</h1>
          <div className="pageSubtitle" style={{ marginTop: 8 }}>
            Ajustes globales del sistema
          </div>
        </div>
        <div className="pageHeaderSearch">
          <Search size={18} className="pageHeaderSearchIcon" />
          <input
            type="text"
            placeholder="Buscar en configuración..."
            className="pageHeaderSearchInput"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: "32px" }}>
        {/* Sidebar */}
        <div style={{ width: "240px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto", paddingBottom: "32px" }}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                textAlign: "left",
                padding: "12px 16px",
                borderRadius: "12px",
                border: "none",
                background: activeTab === tab.key ? "rgba(125, 57, 235, 0.08)" : "transparent",
                color: activeTab === tab.key ? "var(--primary)" : "var(--text-muted)",
                fontWeight: activeTab === tab.key ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              {tab.label}
              {activeTab === tab.key && <span>›</span>}
            </button>
          ))}
        </div>

        {/* Content Pane */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 32px" }}>

      {activeTab === "general" ? (
        <div className="stack">
          <div>
            <h2 style={{ fontSize: "1.5rem", margin: "0 0 8px 0" }}>Ajustes de Cotización</h2>
            <p className="hint" style={{ margin: "0 0 24px 0" }}>
              {canManageQuoteCatalogs
                ? "Configurá la tasa de cambio y las opciones predeterminadas para los catálogos y atributos de las cotizaciones."
                : "Como vendedor, solo podés configurar la tasa de cambio. Los demás catálogos quedan reservados para administradores."}
            </p>
            
            {/* Navigation Pills */}
            <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", msOverflowStyle: "none", scrollbarWidth: "none" }} className="hide-scrollbar">
              <button onClick={() => document.getElementById("section-moneda")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 }}>Moneda y Cotización</button>
              {canManageQuoteCatalogs ? (
                <>
                  <button onClick={() => document.getElementById("section-forma_pago")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 }}>Forma de Pago</button>
                  <button onClick={() => document.getElementById("section-lugar_entrega")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 }}>Lugar de Entrega</button>
                  <button onClick={() => document.getElementById("section-tipo_cliente")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 }}>Tipo de Cliente</button>
                  <button onClick={() => document.getElementById("section-tipo_producto")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 }}>Tipo de Producto</button>
                  <button onClick={() => document.getElementById("section-tipo_iva")?.scrollIntoView({ behavior: "smooth" })} style={{ padding: "8px 16px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", whiteSpace: "nowrap", fontWeight: 500 }}>Tipo de IVA</button>
                </>
              ) : null}
            </div>
          </div>

          <div id="section-moneda" className="card" style={{ padding: 24, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div className="sectionTitle" style={{ fontSize: "1.1rem", borderBottom: "none", paddingBottom: 0 }}>Moneda y Cotización</div>
            <div className="hint" style={{ marginTop: 4, marginBottom: 20 }}>Define la tasa de cambio global a utilizar por defecto en nuevas cotizaciones.</div>

            <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--text-primary)" }}>Actualizar cotización</div>
              <div style={{ display: "flex", gap: "16px", alignItems: "flex-end" }}>
                <label className="field" style={{ flex: 1, maxWidth: "300px", margin: 0 }}>
                  <span className="label">Tasa de Cambio (1 USD = ? ARS)</span>
                  <input
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="input"
                    style={{ background: "var(--surface)" }}
                  />
                </label>
                <Button
                  className="btn--primary"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  style={{ height: "42px", minWidth: "120px" }}
                >
                  {saving ? "Guardando..." : "Guardar"}
                </Button>
              </div>

              {message ? (
                <div
                  className={message.type === "error" ? "error" : "success"}
                  style={message.type === "success" ? { fontSize: 14, fontWeight: 500, marginTop: "-4px" } : { marginTop: "-4px" }}
                >
                  {message.text}
                </div>
              ) : null}
            </div>
          </div>

          {canManageQuoteCatalogs ? <GeneralCatalogManager /> : null}
        </div>
      ) : null}

      {activeTab === "users" && canManageUsers ? (
        <div className="stack">
          <div>
            <h2 style={{ fontSize: "1.5rem", margin: "0 0 8px 0" }}>Usuarios del Sistema</h2>
            <p className="hint" style={{ margin: "0 0 32px 0" }}>Administrá los accesos, roles y contraseñas de los usuarios de tu empresa.</p>
          </div>

          <div className="card" style={{ padding: 24, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="sectionTitle" style={{ fontSize: "1.1rem", borderBottom: "none", paddingBottom: 0 }}>
                  Usuarios Activos
                </div>
                <div className="hint" style={{ marginTop: 4 }}>
                  Listado y permisos{user?.empresaNombre ? ` · ${user.empresaNombre}` : ""}
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
                {filteredUsers.map((u) => {
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
      </div>
      ) : null}

      {activeTab === "companies" && isSuperAdmin ? (
        <div className="stack">
          <div>
            <h2 style={{ fontSize: "1.5rem", margin: "0 0 8px 0" }}>Empresas Registradas</h2>
            <p className="hint" style={{ margin: "0 0 32px 0" }}>Gestioná las distintas empresas que utilizan la plataforma y sus configuraciones.</p>
          </div>

          <div className="card" style={{ padding: 24, border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div className="sectionTitle" style={{ fontSize: "1.1rem", borderBottom: "none", paddingBottom: 0 }}>
                  Directorio de Empresas
                </div>
                <div className="hint" style={{ marginTop: 4 }}>Creación, lectura, modificación y desactivación</div>
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
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div>
                <div className="sectionTitle" style={{ marginBottom: 0 }}>Nueva empresa</div>
                <div className="hint">Cargá los datos fiscales, comerciales y el logo institucional.</div>
              </div>
              <Button
                className="btn--primary"
                disabled={companySaving}
                onClick={openCreateCompanyDialog}
              >
                + Crear empresa
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
                {filteredCompanies.map((c) => {
                  return (
                    <tr key={c.id}>
                      <td className="cellMuted">{c.id}</td>
                      <td>
                        <div className="companyNameCell">
                          <div className="companyNameCell__logo">
                            {c.logo_url ? <img src={companyService.getCompanyLogoUrl(c.logo_url) ?? ""} alt={c.nombre} /> : "Logo"}
                          </div>
                          <div className="companyNameCell__meta">
                            <div className="companyNameCell__name">{c.nombre}</div>
                            <div className="companyNameCell__sub">{c.razon_social || c.email || "-"}</div>
                          </div>
                        </div>
                      </td>
                      <td>{c.activo ? "Activa" : "Inactiva"}</td>
                      <td className="nowrap">
                        <div className="row" style={{ gap: 8 }}>
                          <Button
                            className="btn--sm"
                            onClick={() => openEditCompanyDialog(c)}
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
      </div>
      ) : null}
      <CompanyFormDialog
        open={companyDialogMode !== null}
        title={companyDialogMode === "edit" ? "Editar empresa" : "Nueva empresa"}
        submitLabel={companyDialogMode === "edit" ? "Guardar cambios" : "Crear empresa"}
        saving={companySaving}
        error={companyDialogMode ? companiesError : null}
        draft={companyDraft}
        onClose={closeCompanyDialog}
        onSubmit={() => companyDialogMode === "edit" && editingCompanyId ? handleUpdateCompany(editingCompanyId) : handleCreateCompany()}
        onChange={updateCompanyDraft}
        onLogoChange={handleCompanyLogoChange}
      />
      {activeTab === "accessibility" ? (
        <div className="stack">
          <div>
            <h2 style={{ fontSize: "1.5rem", margin: "0 0 8px 0" }}>Accesibilidad</h2>
            <p className="hint" style={{ margin: "0 0 32px 0" }}>Personalizá la experiencia visual de la plataforma para que te resulte más cómoda.</p>
          </div>

          <div className="card" style={{ padding: 24, border: "1px solid var(--border)", boxShadow: "var(--shadow)", display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
              <div className="sectionTitle" style={{ fontSize: "1.1rem", borderBottom: "none", paddingBottom: 0 }}>Tamaño de la letra</div>
              <div className="hint" style={{ marginTop: 4, marginBottom: 20 }}>Ajustá el tamaño base del texto en toda la aplicación.</div>
              
              <div style={{ display: "flex", gap: "16px" }}>
                {[
                  { value: "small", label: "Pequeño", px: "14px" },
                  { value: "medium", label: "Mediano", px: "16px" },
                  { value: "large", label: "Grande", px: "18px" }
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFontSize(opt.value)}
                    style={{
                      flex: 1,
                      padding: "20px",
                      borderRadius: "12px",
                      border: fontSize === opt.value ? "2px solid var(--primary)" : "1px solid var(--border)",
                      background: fontSize === opt.value ? "rgba(125, 57, 235, 0.04)" : "transparent",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s"
                    }}
                  >
                    <span style={{ fontSize: opt.px, fontWeight: 500, color: fontSize === opt.value ? "var(--primary)" : "var(--text-primary)" }}>Aa</span>
                    <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 32 }}>
              <div className="sectionTitle" style={{ fontSize: "1.1rem", borderBottom: "none", paddingBottom: 0 }}>Movimiento y Animaciones</div>
              <div className="hint" style={{ marginTop: 4, marginBottom: 20 }}>Reduce o elimina las transiciones y animaciones de la interfaz.</div>
              
              <label style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "16px 0" }}>
                <input 
                  type="checkbox" 
                  checked={reduceAnimations} 
                  onChange={(e) => setReduceAnimations(e.target.checked)}
                  style={{ width: "20px", height: "20px", accentColor: "var(--primary)" }}
                />
                <span style={{ fontWeight: 500 }}>Reducir animaciones en toda la aplicación</span>
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        message={confirm?.message ?? ""}
        confirmLabel={confirm?.confirmLabel ?? "Confirmar"}
        confirmTone={confirm?.confirmTone ?? "danger"}
        loading={companySaving || userSaving || saving}
        onCancel={() => setConfirm(null)}
        onConfirm={() => confirm?.onConfirm()}
      />
        </div>
      </div>
    </div>
  );
}

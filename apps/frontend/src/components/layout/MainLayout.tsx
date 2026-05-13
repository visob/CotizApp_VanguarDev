import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowMark,
  ClientsIcon,
  HelpIcon,
  HomeIcon,
  LogoutIcon,
  MetricsIcon,
  ProductsIcon,
  QuotesIcon,
  SettingsIcon
} from "../common/Icons";
import { useAuth } from "../../context/AuthContext";

type NavItem = {
  key: string;
  label: string;
  to?: string;
  icon: (props: { size?: number; color?: string }) => ReactNode;
};

export function SideNav(props: { onLogout: () => void; userLabel: string }) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  const itemsTop: NavItem[] = [
    { key: "home", label: "Inicio", to: "/", icon: HomeIcon },
    { key: "quotes", label: "Cotizaciones", to: "/quotes", icon: QuotesIcon },
    { key: "clients", label: "Clientes", to: "/clients", icon: ClientsIcon },
    { key: "products", label: "Productos", to: "/products", icon: ProductsIcon },
    { key: "metrics", label: "Métricas", icon: MetricsIcon }
  ];

  const itemsBottom: NavItem[] = [
    { key: "settings", label: "Configuración", icon: SettingsIcon },
    { key: "support", label: "Soporte", icon: HelpIcon }
  ];

  const width = expanded ? 240 : 76;

  function isActive(to?: string) {
    if (!to) return false;
    if (to === "/") return location.pathname === "/";
    return location.pathname.startsWith(to);
  }

  const iconColor = "#111827";

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        width,
        transition: "width 180ms ease",
        background: "rgba(255,255,255,0.6)",
        border: "1px solid rgba(17,24,39,0.08)",
        borderRadius: 26,
        padding: 14,
        boxSizing: "border-box",
        boxShadow: "0 14px 40px rgba(15, 23, 42, 0.12)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: 14,
        backdropFilter: "blur(10px)"
      }}
    >
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ArrowMark size={42} color="#111827" />
        </div>
      </div>

      <div style={{ display: "grid", alignContent: "start", gap: 8 }}>
        {itemsTop.map((item) => {
          const active = isActive(item.to);
          const commonStyle = {
            height: 44,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: expanded ? "0 12px" : "0 10px",
            borderRadius: 14,
            textDecoration: "none",
            color: "inherit",
            background: active ? "rgba(17,24,39,0.08)" : "transparent",
            transition: "background 140ms ease",
            cursor: item.to ? "pointer" : "default",
            userSelect: "none"
          } as const;

          const content = (
            <>
              <div style={{ width: 28, display: "grid", placeItems: "center" }}>
                <item.icon size={20} color={iconColor} />
              </div>
              {expanded ? <div style={{ fontSize: 14, opacity: 0.9 }}>{item.label}</div> : null}
              {expanded ? <div style={{ marginLeft: "auto", opacity: 0.4 }}>&rsaquo;</div> : null}
            </>
          );

          return item.to ? (
            <Link
              key={item.key}
              to={item.to}
              aria-current={active ? "page" : undefined}
              title={expanded ? undefined : item.label}
              style={commonStyle}
            >
              {content}
            </Link>
          ) : (
            <div key={item.key} title={expanded ? undefined : item.label} style={{ ...commonStyle, opacity: 0.55 }}>
              {content}
            </div>
          );
        })}

        <div style={{ height: 1, background: "rgba(17,24,39,0.08)", margin: "10px 6px" }} />

        {itemsBottom.map((item) => {
          const commonStyle = {
            height: 44,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: expanded ? "0 12px" : "0 10px",
            borderRadius: 14,
            textDecoration: "none",
            color: "inherit",
            background: "transparent",
            opacity: 0.65,
            userSelect: "none"
          } as const;

          return (
            <div key={item.key} title={expanded ? undefined : item.label} style={commonStyle}>
              <div style={{ width: 28, display: "grid", placeItems: "center" }}>
                <item.icon size={20} color={iconColor} />
              </div>
              {expanded ? <div style={{ fontSize: 14 }}>{item.label}</div> : null}
              {expanded ? <div style={{ marginLeft: "auto", opacity: 0.35 }}>&rsaquo;</div> : null}
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ height: 1, background: "rgba(17,24,39,0.08)", margin: "0 6px" }} />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: expanded ? "10px 10px" : "10px 8px",
            borderRadius: 18,
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(17,24,39,0.08)"
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              background: "rgba(17,24,39,0.12)",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              color: "#111827"
            }}
          >
            {props.userLabel.trim().slice(0, 1).toUpperCase()}
          </div>
          {expanded ? (
            <div style={{ display: "grid", lineHeight: 1.1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{props.userLabel}</div>
            </div>
          ) : null}

          <button
            onClick={props.onLogout}
            title="Salir"
            style={{
              marginLeft: "auto",
              height: 34,
              width: 34,
              borderRadius: 12,
              border: "1px solid rgba(17,24,39,0.12)",
              background: "transparent",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              padding: 0
            }}
          >
            <LogoutIcon size={18} color={iconColor} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function MainLayout(props: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const userLabel = user ? `${user.nombre}` : "Usuario";

  return (
    <div style={{ minHeight: "100vh", padding: 24, boxSizing: "border-box" }}>
      <div style={{ display: "flex", gap: 18, alignItems: "stretch" }}>
        <SideNav onLogout={logout} userLabel={userLabel} />
        <main style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              minHeight: "calc(100vh - 48px)",
              borderRadius: 28,
              background:
                "radial-gradient(1200px 600px at 30% 30%, #f8fafc 0%, #f1f5f9 55%, #eef2f7 100%)",
              border: "1px solid rgba(17,24,39,0.08)",
              boxShadow: "0 18px 70px rgba(15, 23, 42, 0.12)",
              padding: 26,
              boxSizing: "border-box"
            }}
          >
            {props.children}
          </div>
        </main>
      </div>
    </div>
  );
}

import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
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
  const [expanded, setExpanded] = useState(false);

  const itemsTop: NavItem[] = [
    { key: "home", label: "Inicio", to: "/", icon: HomeIcon },
    { key: "quotes", label: "Cotizaciones", to: "/quotes", icon: QuotesIcon },
    { key: "clients", label: "Clientes", to: "/clients", icon: ClientsIcon },
    { key: "products", label: "Productos", to: "/products", icon: ProductsIcon },
    { key: "metrics", label: "Métricas", icon: MetricsIcon }
  ];

  const itemsBottom: NavItem[] = [
    { key: "settings", label: "Configuración", to: "/settings", icon: SettingsIcon },
    { key: "support", label: "Soporte", icon: HelpIcon }
  ];

  const iconColor = "currentColor";

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={["sidenav", expanded ? "sidenav--expanded" : "sidenav--collapsed"].join(" ")}
    >
      <div className="sidenavLogo">
        <ArrowMark size={32} color={iconColor} />
      </div>

      <div className="sidenavSection">
        {itemsTop.map((item) => {
          const content = (
            <>
              <div className="sidenavItemIcon">
                <item.icon size={20} color={iconColor} />
              </div>
              {expanded ? <div className="sidenavItemLabel">{item.label}</div> : null}
              {expanded ? <div className="sidenavItemArrow">&rsaquo;</div> : null}
            </>
          );

          return item.to ? (
            <NavLink
              key={item.key}
              to={item.to}
              title={expanded ? undefined : item.label}
              className="sidenavItem"
            >
              {content}
            </NavLink>
          ) : (
            <div
              key={item.key}
              title={expanded ? undefined : item.label}
              className="sidenavItem sidenavItem--inactive"
            >
              {content}
            </div>
          );
        })}

        <div className="sidenavDivider" />

        {itemsBottom.map((item) => {
          const content = (
            <>
              <div className="sidenavItemIcon">
                <item.icon size={20} color={iconColor} />
              </div>
              {expanded ? <div className="sidenavItemLabel">{item.label}</div> : null}
              {expanded ? <div className="sidenavItemArrow">&rsaquo;</div> : null}
            </>
          );

          return item.to ? (
            <NavLink
              key={item.key}
              to={item.to}
              title={expanded ? undefined : item.label}
              className="sidenavItem"
            >
              {content}
            </NavLink>
          ) : (
            <div
              key={item.key}
              title={expanded ? undefined : item.label}
              className="sidenavItem sidenavItem--inactive"
            >
              {content}
            </div>
          );
        })}
      </div>

      <div className="sidenavSection">
        <div className="sidenavFooterDivider" />

        <div className="userCard">
          <div className="userAvatar">
            {props.userLabel.trim().slice(0, 1).toUpperCase()}
          </div>
          {expanded ? (
            <div className="userInfo">
              <div className="userName">{props.userLabel}</div>
            </div>
          ) : null}

          <button
            onClick={props.onLogout}
            title="Salir"
            className="logoutBtn"
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
    <div className="layoutRoot">
      <div className="layoutRow">
        <SideNav onLogout={logout} userLabel={userLabel} />
        <main className="layoutMain">
          <div className="layoutMainCard">{props.children}</div>
        </main>
      </div>
    </div>
  );
}

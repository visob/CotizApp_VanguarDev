import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function MainLayout(props: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div style={{ display: "grid", gridTemplateRows: "56px 1fr", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        <nav style={{ display: "flex", gap: 12 }}>
          <Link to="/" style={{ color: "inherit", textDecoration: "none" }}>
            Dashboard
          </Link>
          <Link to="/clients" style={{ color: "inherit", textDecoration: "none" }}>
            Clientes
          </Link>
          <Link to="/products" style={{ color: "inherit", textDecoration: "none" }}>
            Productos
          </Link>
          <Link to="/quotes" style={{ color: "inherit", textDecoration: "none" }}>
            Cotizaciones
          </Link>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ opacity: 0.85 }}>{user ? `${user.nombre} (${user.rol})` : "Sin sesión"}</span>
          <button
            onClick={logout}
            style={{
              padding: "8px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer"
            }}
          >
            Salir
          </button>
        </div>
      </header>
      <main style={{ padding: 24 }}>{props.children}</main>
    </div>
  );
}


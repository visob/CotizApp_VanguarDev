import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { useAuth } from "./context/AuthContext";
import ClientsPage from "./pages/Clients";
import DashboardPage from "./pages/Dashboard";
import LandingPage from "./pages/Landing";
import LoginPage from "./pages/Login";
import ProductsPage from "./pages/Products";
import QuotesPage from "./pages/Quotes";
import SettingsPage from "./pages/Settings";
import SupportPage from "./pages/Support";

export default function App() {
  const { token, user } = useAuth();

  if (!token) {
    return (
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  if (user?.rol === "SuperAdmin") {
    return (
      <MainLayout>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/" element={<Navigate to="/settings" replace />} />
          <Route path="*" element={<Navigate to="/settings" replace />} />
        </Routes>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients/*" element={<ClientsPage />} />
        <Route path="/products/*" element={<ProductsPage />} />
        <Route path="/quotes/*" element={<QuotesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}

import { Navigate, Route, Routes } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { useAuth } from "./context/AuthContext";
import ClientsPage from "./pages/Clients";
import DashboardPage from "./pages/Dashboard";
import LoginPage from "./pages/Login";
import ProductsPage from "./pages/Products";
import QuotesPage from "./pages/Quotes";

export default function App() {
  const { token } = useAuth();

  if (!token) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <MainLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/clients/*" element={<ClientsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/quotes" element={<QuotesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MainLayout>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import ClientDetail from "@/pages/ClientDetail";
import NewLoan from "@/pages/NewLoan";
import LoanDetail from "@/pages/LoanDetail";
import Loans from "@/pages/Loans";
import Cash from "@/pages/Cash";
import Finances from "@/pages/Finances";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Cargando…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
          <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
          <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
          <Route path="/reset-password" element={<PublicOnly><ResetPassword /></PublicOnly>} />
          <Route path="/" element={<Protected><Dashboard /></Protected>} />
          <Route path="/clientes" element={<Protected><Clients /></Protected>} />
          <Route path="/clientes/:id" element={<Protected><ClientDetail /></Protected>} />
          <Route path="/prestamos" element={<Protected><Loans /></Protected>} />
          <Route path="/prestamos/nuevo" element={<Protected><NewLoan /></Protected>} />
          <Route path="/prestamos/:id" element={<Protected><LoanDetail /></Protected>} />
          <Route path="/caja" element={<Protected><Cash /></Protected>} />
          <Route path="/finanzas" element={<Protected><Finances /></Protected>} />
          <Route path="/reportes" element={<Protected><Reports /></Protected>} />
          <Route path="/configuracion" element={<Protected><Settings /></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

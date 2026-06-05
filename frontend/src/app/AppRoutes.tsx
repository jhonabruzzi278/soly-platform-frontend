import { Navigate, Route, Routes, Outlet } from "react-router-dom";
import { useAuth, RequireAuth } from "../app/auth";
import { useTenant } from "../hooks/useTenant";
import { MainLayout } from "../components/layout/MainLayout";
import { FeatureGate } from "../components/common/FeatureGate";
import { LoginPage } from "../features/auth/LoginPage";
import { PasswordRecoveryPage } from "../features/auth/PasswordRecoveryPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ExcelUploadPage } from "../features/files/ExcelUploadPage";
import { CustomersPage } from "../features/customers/CustomersPage";
import { AppointmentsPage } from "../features/appointments/AppointmentsPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { BillingPage } from "../features/billing/BillingPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { Profile } from "../lib/types";

function TenantLayout() {
  const { session } = useAuth();
  const { tenant } = useTenant();

  if (!tenant || !session) {
    return <div className="theme-shell grid min-h-screen place-items-center">Configurando tu espacio...</div>;
  }

  const profile: Profile = {
    id: session.userId,
    email: session.email,
    full_name: session.name,
    role: session.role === "owner" ? "admin" : "user"
  };

  return (
    <MainLayout tenant={tenant} profile={profile}>
      <Outlet />
    </MainLayout>
  );
}

export const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/recuperar-password" element={<PasswordRecoveryPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<TenantLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/archivos" element={<ExcelUploadPage />} />
          <Route path="/clientes" element={<FeatureGate feature="customers"><CustomersPage /></FeatureGate>} />
          <Route path="/citas" element={<FeatureGate feature="appointments"><AppointmentsPage /></FeatureGate>} />
          <Route path="/reportes" element={<FeatureGate feature="reports"><ReportsPage /></FeatureGate>} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/configuracion" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

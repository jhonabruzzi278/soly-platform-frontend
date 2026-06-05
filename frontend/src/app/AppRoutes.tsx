import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useTenant } from "../hooks/useTenant";
import { MainLayout } from "../components/layout/MainLayout";
import { FeatureGate } from "../components/common/FeatureGate";
import { LoginPage } from "../features/auth/LoginPage";
import { OnboardingPage } from "../features/auth/OnboardingPage";
import { PasswordRecoveryPage } from "../features/auth/PasswordRecoveryPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { ExcelUploadPage } from "../features/files/ExcelUploadPage";
import { CustomersPage } from "../features/customers/CustomersPage";
import { AppointmentsPage } from "../features/appointments/AppointmentsPage";
import { ReportsPage } from "../features/reports/ReportsPage";
import { BillingPage } from "../features/billing/BillingPage";
import { SettingsPage } from "../features/settings/SettingsPage";

export const AppRoutes = () => {
  const { loading, session, profile } = useAuth();
  const { loading: tenantLoading, tenant } = useTenant();

  const isLoading = loading || tenantLoading;

  if (isLoading) {
    return <div className="theme-shell grid min-h-screen place-items-center">Cargando...</div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/recuperar-password" element={<PasswordRecoveryPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (!profile) {
    return (
      <div className="theme-shell grid min-h-screen place-items-center px-4">
        <div className="theme-warning-panel max-w-xl rounded-2xl p-8 text-center">
          Tu sesion existe, pero no se pudo cargar tu perfil. Intenta cerrar sesion y volver a ingresar.
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  const isAdmin = profile.role === "admin" || profile.role === "user";

  return (
    <MainLayout profile={profile} tenant={tenant}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/recuperar-password" element={<PasswordRecoveryPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/archivos" element={<ExcelUploadPage />} />
        <Route path="/clientes" element={<FeatureGate feature="customers"><CustomersPage /></FeatureGate>} />
        <Route path="/citas" element={<FeatureGate feature="appointments"><AppointmentsPage /></FeatureGate>} />
        <Route path="/reportes" element={<FeatureGate feature="reports"><ReportsPage /></FeatureGate>} />
        <Route path="/billing" element={<BillingPage />} />
        {isAdmin ? (
          <Route path="/configuracion" element={<SettingsPage />} />
        ) : null}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </MainLayout>
  );
};

import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, Outlet } from "react-router-dom";
import { useAuth, RequireAuth } from "../app/auth";
import { useTenant } from "../hooks/useTenant";
import { MainLayout } from "../components/layout/MainLayout";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { FeatureGate } from "../components/common/FeatureGate";
import { LoginPage } from "../features/auth/LoginPage";
import { PasswordRecoveryPage } from "../features/auth/PasswordRecoveryPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { Profile } from "../lib/types";

const ExcelUploadPage = lazy(() => import("../features/files/ExcelUploadPage").then(m => ({ default: m.ExcelUploadPage })));
const CustomersPage = lazy(() => import("../features/customers/CustomersPage").then(m => ({ default: m.CustomersPage })));
const AppointmentsPage = lazy(() => import("../features/appointments/AppointmentsPage").then(m => ({ default: m.AppointmentsPage })));
const ReportsPage = lazy(() => import("../features/reports/ReportsPage").then(m => ({ default: m.ReportsPage })));
const BillingPage = lazy(() => import("../features/billing/BillingPage").then(m => ({ default: m.BillingPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then(m => ({ default: m.SettingsPage })));

const PageLoader = () => (
  <div className="theme-shell grid min-h-[200px] place-items-center">
    <p className="text-sm text-[var(--muted-foreground)]">Cargando...</p>
  </div>
);

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
    role: (session.role === "owner" || session.role === "admin") ? "admin" : "user"
  };

  return (
    <MainLayout tenant={tenant} profile={profile}>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </MainLayout>
  );
}

export const AppRoutes = () => {
  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
};

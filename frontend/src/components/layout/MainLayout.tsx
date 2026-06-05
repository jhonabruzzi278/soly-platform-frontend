import { ReactNode, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { signOutCurrentSession } from "../../lib/authSession";
import { Tenant, Profile } from "../../lib/types";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { MobileNavigation } from "./MobileNavigation";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";

type MainLayoutProps = {
  profile: Profile;
  tenant: Tenant;
  children: ReactNode;
};

export const MainLayout = ({ profile, tenant, children }: MainLayoutProps) => {
  const location = useLocation();

  const title = useMemo(() => {
    const p = location.pathname;
    if (p.includes("dashboard")) return "Dashboard";
    if (p.includes("archivos")) return "Archivos";
    if (p.includes("clientes")) return "Clientes";
    if (p.includes("citas")) return "Citas";
    if (p.includes("inventario")) return "Inventario";
    if (p.includes("reportes")) return "Reportes";
    if (p.includes("configuracion")) return "Configuracion";
    if (p.includes("billing")) return "Planes y facturacion";
    return "Plataforma";
  }, [location.pathname]);

  const handleLogout = async () => {
    await signOutCurrentSession();
  };

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
        <Sidebar role={profile.role} tenant={tenant} />
        <SidebarInset>
          <Header profile={profile} title={title} onLogout={handleLogout} />
          <main id="main-content" className="mx-auto w-full max-w-[1600px] px-3 pb-20 pt-4 md:px-4 lg:px-6 lg:pb-8" tabIndex={-1}>
            {children}
          </main>
        </SidebarInset>
        <MobileNavigation role={profile.role} plan={tenant.plan} onLogout={handleLogout} />
      </div>
    </SidebarProvider>
  );
};

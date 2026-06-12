import { PlanKey, hasFeature, FeatureKey } from "../../lib/features";

export type AppNavLink = {
  to: string;
  label: string;
  icon: string;
  group?: "core" | "secondary";
  adminOnly?: boolean;
  mobilePrimary?: boolean;
  feature?: FeatureKey;
};

export const APP_NAV_LINKS: AppNavLink[] = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard", mobilePrimary: true, group: "core" },
  { to: "/archivos", label: "Archivos", icon: "folder", mobilePrimary: false, group: "core" },
  { to: "/clientes", label: "Clientes", icon: "people", group: "core", feature: "customers" },
  { to: "/citas", label: "Citas", icon: "event", group: "core", feature: "appointments" },
  { to: "/reportes", label: "Reportes", icon: "bar_chart", group: "core", feature: "reports" },
  { to: "/billing", label: "Planes", icon: "workspace_premium", group: "core" },
  { to: "/configuracion", label: "Configuracion", icon: "tune", adminOnly: true, group: "secondary" }
];

export const getNavLinksForRole = (plan: PlanKey, isAdmin: boolean) =>
  APP_NAV_LINKS.filter((link) => {
    if (link.adminOnly && !isAdmin) return false;
    if (link.feature && !hasFeature(plan, link.feature)) return false;
    return true;
  });

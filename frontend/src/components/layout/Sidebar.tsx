import { NavLink } from "react-router-dom";
import { useWorkspace } from "../../app/WorkspaceProvider";
import { Tenant, UserRole } from "../../lib/types";
import { PLAN_META } from "../../lib/features";
import { cn } from "../../lib/cn";
import { MaterialIcon } from "../common/MaterialIcon";
import { Card } from "../ui/card";
import {
  Sidebar as SidebarShell,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar
} from "../ui/sidebar";
import { getNavLinksForRole } from "./navLinks";

type SidebarProps = {
  role: UserRole;
  tenant: Tenant;
};

export const Sidebar = ({ role, tenant }: SidebarProps) => {
  const { open, setOpenMobile } = useSidebar();
  const links = getNavLinksForRole(tenant.plan, role === "admin");
  const coreLinks = links.filter((link) => link.group !== "secondary");
  const secondaryLinks = links.filter((link) => link.group === "secondary");
  const { settings } = useWorkspace();
  const businessLogo = settings.business_logo_url ?? "/1.jpg";
  const initials = settings.business_name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() ?? "")
    .join("");

  const planMeta = PLAN_META[tenant.plan];

  return (
    <SidebarShell>
      <SidebarHeader className={cn("p-3", !open && "p-2")}>
        <Card className={cn("mx-auto rounded-2xl border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]", open ? "w-full" : "w-[3.75rem]")}>
          <div className={cn("space-y-3 p-3", !open && "p-2")}>
            <div className={cn("flex items-center gap-3", !open && "justify-center")}>
              {businessLogo ? (
                <img
                  src={businessLogo}
                  alt={`Logo de ${settings.business_name}`}
                  className={cn("h-10 w-10 rounded-lg border border-transparent object-cover shadow-[var(--neu-shadow-raised)]", !open && "h-9 w-9")}
                />
              ) : (
                <div
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-lg bg-[var(--primary)] text-sm font-semibold text-[var(--primary-foreground)]",
                    !open && "h-9 w-9"
                  )}
                >
                  {initials || "EH"}
                </div>
              )}

              {open ? (
                <div className="min-w-0 text-center">
                  <h1 className="truncate text-sm font-semibold">{settings.business_name}</h1>
                  <p className="truncate text-xs text-[var(--muted-foreground)]">
                    {settings.business_subtitle ?? "Gestión inteligente"}
                  </p>
                  <span className="mt-1 inline-block rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                    {planMeta.label}
                  </span>
                </div>
              ) : null}
            </div>

            {open ? (
              <p className="text-center text-xs leading-5 text-[var(--muted-foreground)]">
                Gestión inteligente, simplificada.
              </p>
            ) : null}
          </div>
        </Card>
      </SidebarHeader>

      <SidebarContent className={cn("p-2", !open && "p-1.5")}>
        <SidebarGroup className={cn("mx-auto w-full", open ? "max-w-[15.5rem]" : "max-w-[3.5rem]")}>
          {open ? <SidebarGroupLabel className="text-center">Principal</SidebarGroupLabel> : null}
          <SidebarGroupContent>
            <SidebarMenu>
              {coreLinks.map((link) => (
                <SidebarMenuItem key={link.to}>
                  <NavLink to={link.to} onClick={() => setOpenMobile(false)}>
                    {({ isActive }) => (
                      <SidebarMenuButton isActive={isActive} className={cn(!open && "justify-center px-0")}>
                        <MaterialIcon name={link.icon} size={18} filled={isActive} />
                        {open ? <span className="truncate">{link.label}</span> : <span className="sr-only">{link.label}</span>}
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {secondaryLinks.length > 0 ? (
          <SidebarGroup className={cn("mx-auto w-full", open ? "max-w-[15.5rem]" : "max-w-[3.5rem]")}>
            {open ? <SidebarGroupLabel className="text-center">Administración</SidebarGroupLabel> : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryLinks.map((link) => (
                  <SidebarMenuItem key={link.to}>
                    <NavLink to={link.to} onClick={() => setOpenMobile(false)}>
                      {({ isActive }) => (
                        <SidebarMenuButton isActive={isActive} className={cn(!open && "justify-center px-0")}>
                          <MaterialIcon name={link.icon} size={18} filled={isActive} />
                          {open ? <span className="truncate">{link.label}</span> : <span className="sr-only">{link.label}</span>}
                        </SidebarMenuButton>
                      )}
                    </NavLink>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>
    </SidebarShell>
  );
};

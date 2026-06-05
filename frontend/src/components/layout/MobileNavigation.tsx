import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useWorkspace } from "../../app/WorkspaceProvider";
import { UserRole } from "../../lib/types";
import { PlanKey } from "../../lib/features";
import { cn } from "../../lib/cn";
import { MaterialIcon } from "../common/MaterialIcon";
import { ThemeToggleButton } from "../common/ThemeToggleButton";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { getNavLinksForRole } from "./navLinks";

type MobileNavigationProps = {
  role: UserRole;
  plan: string;
  onLogout: () => Promise<void>;
};

export const MobileNavigation = ({ role, plan, onLogout }: MobileNavigationProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const allLinks = getNavLinksForRole(plan as PlanKey, role === "admin");
  const { settings } = useWorkspace();

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 border-t border-transparent bg-[var(--background)]/95 shadow-[var(--neu-shadow-raised)] px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 backdrop-blur lg:hidden">
        <nav className="pointer-events-auto grid grid-cols-2 gap-1">
          {allLinks.slice(0, 1).map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
                  isActive
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                    : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                )
              }
            >
              <MaterialIcon name={link.icon} size={18} filled />
              <span className="w-full truncate px-1 text-center leading-tight">{link.label}</span>
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex min-h-[52px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
            aria-label="Abrir menú"
          >
            <MaterialIcon name="grid_view" size={18} filled />
            <span className="w-full truncate px-1 text-center leading-tight">Menú</span>
          </button>
        </nav>
      </div>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-3 lg:hidden" onClick={() => setMenuOpen(false)}>
          <Card className="max-h-[85vh] w-full overflow-y-auto rounded-2xl p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                  {settings.business_name}
                </p>
                <h3 className="text-base font-semibold">Accesos</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
                <MaterialIcon name="close" size={18} />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {allLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex min-h-[64px] items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-sm font-medium shadow-[var(--neu-shadow-raised)] transition-colors",
                        isActive ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "hover:bg-[var(--secondary)]"
                      )
                    }
                  >
                    <MaterialIcon name={link.icon} size={18} filled />
                    <span className="min-w-0 truncate">{link.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <ThemeToggleButton />
            </div>

            <Button
              variant="outline"
              onClick={() => {
                setMenuOpen(false);
                void onLogout();
              }}
              className="mt-4 w-full"
            >
              <MaterialIcon name="logout" size={18} />
              Salir
            </Button>
          </Card>
        </div>
      ) : null}
    </>
  );
};

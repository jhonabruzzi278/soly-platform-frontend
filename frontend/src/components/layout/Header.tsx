import { useState } from "react";
import { useWorkspace } from "../../app/WorkspaceProvider";
import { changeCurrentUserPassword } from "../../lib/api";
import { Profile } from "../../lib/types";
import { InstallPwaButton } from "../common/InstallPwaButton";
import { MaterialIcon } from "../common/MaterialIcon";
import { Modal } from "../common/Modal";
import { SurfaceMessage } from "../common/SurfaceMessage";
import { ThemeToggleButton } from "../common/ThemeToggleButton";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { SidebarTrigger } from "../ui/sidebar";

type HeaderProps = {
  profile: Profile;
  title: string;
  onLogout: () => Promise<void>;
};

export const Header = ({ profile, title, onLogout }: HeaderProps) => {
  const { settings } = useWorkspace();
  const initials = (profile.full_name ?? profile.email).trim().charAt(0).toUpperCase();

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  const businessLogo = settings.business_logo_url ?? "/1.jpg";

  const savePassword = async () => {
    setAccountError(null);
    setAccountMessage(null);

    const normalized = password.trim();
    if (normalized.length < 8) {
      setAccountError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== passwordConfirm) {
      setAccountError("Las contraseñas no coinciden.");
      return;
    }

    setSavingPassword(true);
    try {
      await changeCurrentUserPassword(password);
      setPassword("");
      setPasswordConfirm("");
      setAccountMessage("Contraseña actualizada correctamente.");
    } catch (error) {
      setAccountError(error instanceof Error ? error.message : "No se pudo actualizar la contraseña.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-transparent bg-[var(--background)]/95 shadow-[var(--neu-shadow-raised)] backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/80">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-3 py-3 md:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger showLabel className="rounded-lg bg-[var(--background)]" />
            <img
              src={businessLogo}
              alt={`Logo de ${settings.business_name}`}
               className="h-10 w-10 flex-none rounded-lg border border-transparent object-cover shadow-[var(--neu-shadow-raised)]"
            />
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                {settings.business_name}
              </p>
              <h2 className="truncate text-lg font-semibold tracking-tight">{title}</h2>
              <p className="hidden truncate text-xs text-[var(--muted-foreground)] md:block">
                {profile.full_name ?? profile.email} · {profile.role}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <InstallPwaButton />
            <ThemeToggleButton />
            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-[var(--muted)] text-sm font-semibold shadow-[var(--neu-shadow-raised)]"
              aria-label="Mi cuenta"
            >
              {initials}
            </button>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setAccountModalOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent bg-[var(--muted)] text-sm font-semibold shadow-[var(--neu-shadow-raised)]"
              aria-label="Mi cuenta"
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <Modal open={accountModalOpen} title="Mi perfil" onClose={() => setAccountModalOpen(false)} size="md">
        <div className="space-y-4">
          <Card className="rounded-xl border border-transparent bg-[var(--muted)]/35 p-4 shadow-[var(--neu-shadow-raised)]">
            <p className="text-sm font-semibold">{profile.full_name ?? "Usuario"}</p>
            <p className="theme-muted text-sm">{profile.email}</p>
            <p className="theme-muted mt-1 text-xs uppercase tracking-[0.2em]">{profile.role}</p>
          </Card>

          <div className="space-y-2">
            <label className="theme-soft-text flex flex-col gap-1 text-sm">
              <span>Nueva contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="theme-input rounded-lg px-3 py-2"
                placeholder="Mínimo 8 caracteres"
              />
            </label>
            <label className="theme-soft-text flex flex-col gap-1 text-sm">
              <span>Confirmar contraseña</span>
              <input
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                className="theme-input rounded-lg px-3 py-2"
                placeholder="Repite la contraseña"
              />
            </label>
          </div>

          {accountError ? <SurfaceMessage tone="danger" title="No se pudo actualizar" description={accountError} /> : null}
          {accountMessage ? <SurfaceMessage title="Perfil actualizado" description={accountMessage} /> : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
            <Button variant="outline" onClick={() => void onLogout()}>
              <MaterialIcon name="logout" size={16} />
              Cerrar sesión
            </Button>
            <Button onClick={() => void savePassword()} disabled={savingPassword}>
              {savingPassword ? "Guardando..." : "Actualizar contraseña"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

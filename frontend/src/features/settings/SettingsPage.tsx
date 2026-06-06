import { useState } from "react";
import { useWorkspace } from "../../app/WorkspaceProvider";
import { useTenant } from "../../hooks/useTenant";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { WorkspaceHeader } from "../../components/common/WorkspaceHeader";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { changeCurrentUserPassword, fetchTenantMembers, inviteMember, removeMember, countTenantSeats } from "../../lib/api";
import { Membership, MemberRole, WorkspaceSettings } from "../../lib/types";
import { PlanKey, PLAN_LIMITS, PLAN_META } from "../../lib/features";

const DEFAULT_SETTINGS: WorkspaceSettings = {
  business_name: "Soly",
  business_subtitle: "Gestion inteligente, simplificada",
  business_logo_url: null,
  login_image_url: null,
  support_email: null
};

export const SettingsPage = () => {
  const { settings, updateSettings } = useWorkspace();
  const { tenant, isAdmin, refetch: refetchTenant } = useTenant();
  const [workspaceDraft, setWorkspaceDraft] = useState<WorkspaceSettings>(settings);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "default" | "danger";
    title: string;
    description: string;
  } | null>(null);

  const [myPassword, setMyPassword] = useState("");
  const [myPasswordConfirm, setMyPasswordConfirm] = useState("");

  const [members, setMembers] = useState<Membership[]>([]);
  const [seatsCount, setSeatsCount] = useState<number>(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<MemberRole>("member");
  const [inviting, setInviting] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const saveWorkspaceBranding = async () => {
    setBusyKey("workspace-save");
    setFeedback(null);
    try {
      await updateSettings({
        business_name: workspaceDraft.business_name.trim() || DEFAULT_SETTINGS.business_name,
        business_subtitle: workspaceDraft.business_subtitle?.trim() || null
      });
      setFeedback({ tone: "default", title: "Cambios guardados", description: "La configuración del negocio quedó actualizada." });
    } catch (error) {
      setFeedback({
        tone: "danger",
        title: "No se pudo completar",
        description: error instanceof Error ? error.message : "Error desconocido."
      });
    } finally {
      setBusyKey(null);
    }
  };

  const updateMyPassword = async () => {
    if (myPassword.trim().length < 8) {
      setFeedback({ tone: "danger", title: "Error", description: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }

    if (myPassword !== myPasswordConfirm) {
      setFeedback({ tone: "danger", title: "Error", description: "Las contraseñas no coinciden." });
      return;
    }

    setBusyKey("my-password");
    setFeedback(null);
    try {
      await changeCurrentUserPassword(myPassword);
      setMyPassword("");
      setMyPasswordConfirm("");
      setFeedback({ tone: "default", title: "Contraseña actualizada", description: "Contraseña actualizada correctamente." });
    } catch (error) {
      setFeedback({
        tone: "danger",
        title: "No se pudo completar",
        description: error instanceof Error ? error.message : "Error desconocido."
      });
    } finally {
      setBusyKey(null);
    }
  };

  const loadMembers = async () => {
    if (!tenant) return;
    try {
      const [m, seats] = await Promise.all([
        fetchTenantMembers(tenant.id),
        countTenantSeats(tenant.id)
      ]);
      setMembers(m);
      setSeatsCount(seats);
      setMembersLoaded(true);
    } catch {
      // ignore
    }
  };

  const handleInvite = async () => {
    if (!tenant || !inviteEmail.trim()) return;
    setInviting(true);
    setFeedback(null);
    try {
      await inviteMember(tenant.id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      setFeedback({ tone: "default", title: "Invitación enviada", description: `Se envió la invitación a ${inviteEmail}.` });
      await loadMembers();
    } catch (err) {
      setFeedback({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo enviar la invitación." });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!tenant) return;
    setFeedback(null);
    try {
      await removeMember(tenant.id, userId);
      await loadMembers();
      setFeedback({ tone: "default", title: "Miembro eliminado", description: "El usuario fue removido de la organización." });
    } catch (err) {
      setFeedback({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo remover el miembro." });
    }
  };

  const plan = (tenant?.plan ?? "starter") as PlanKey;
  const planMeta = PLAN_META[plan];
  const seatLimit = PLAN_LIMITS[plan].seats;

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Configuración"
        title="Negocio y branding"
        description="Personaliza la apariencia de la plataforma."
      />

      {feedback ? (
        <div role="alert" aria-live="polite">
          <SurfaceMessage tone={feedback.tone} title={feedback.title} description={feedback.description} />
        </div>
      ) : null}

      <section className="grid gap-4">
        <Card className="rounded-xl">
          <CardHeader className="gap-2 pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle>Marca</CardTitle>
                <CardDescription>Define nombre comercial y subtítulo.</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveWorkspaceBranding} disabled={busyKey === "workspace-save"}>
                  <MaterialIcon name="save" size={18} filled />
                  {busyKey === "workspace-save" ? "Guardando..." : "Guardar configuración"}
                </Button>
                <Button variant="outline" onClick={() => setWorkspaceDraft(DEFAULT_SETTINGS)} disabled={busyKey === "workspace-save"}>
                  Restaurar base
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                label="Nombre del negocio"
                value={workspaceDraft.business_name}
                onChange={(value) => setWorkspaceDraft((prev) => ({ ...prev, business_name: value }))}
                placeholder="Soly"
              />
              <FormInput
                label="Subtítulo"
                value={workspaceDraft.business_subtitle ?? ""}
                onChange={(value) => setWorkspaceDraft((prev) => ({ ...prev, business_subtitle: value }))}
                placeholder="Gestión inteligente"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl">
          <CardHeader className="gap-2 pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-1">
                <CardTitle>Seguridad de cuenta</CardTitle>
                <CardDescription>Cambia la contraseña de tu cuenta desde la sesión activa.</CardDescription>
              </div>
              <Button onClick={updateMyPassword} disabled={busyKey === "my-password"}>
                <MaterialIcon name="lock_reset" size={18} />
                {busyKey === "my-password" ? "Actualizando..." : "Actualizar contraseña"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput
                label="Nueva contraseña"
                type="password"
                value={myPassword}
                onChange={setMyPassword}
                placeholder="Mínimo 8 caracteres"
              />
              <FormInput
                label="Confirmar contraseña"
                type="password"
                value={myPasswordConfirm}
                onChange={setMyPasswordConfirm}
                placeholder="Repite la contraseña"
              />
            </div>
          </CardContent>
        </Card>

        {isAdmin && (
          <Card className="rounded-xl">
            <CardHeader className="gap-2 pb-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>Equipo</CardTitle>
                  <CardDescription>
                    Gestiona los miembros de tu organización. Plan actual:{" "}
                    <strong>{planMeta.label}</strong> ({seatsCount}/{seatLimit === Infinity ? "∞" : seatLimit} seats).
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadMembers()}
                >
                  <MaterialIcon name="refresh" size={16} />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              {!membersLoaded ? (
                <button
                  type="button"
                  onClick={() => void loadMembers()}
                  className="w-full rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)]/30 px-4 py-6 text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]/50"
                >
                  Cargar miembros del equipo
                </button>
              ) : (
                <div className="space-y-2">
                  {members.map((m) => (
                    <div key={m.user_id} className="flex items-center justify-between rounded-xl border border-transparent bg-[var(--muted)]/35 px-4 py-3 shadow-[var(--neu-shadow-raised)]">
                      <div>
                        <p className="text-sm font-medium">{m.user_id}</p>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          <span className="rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                            {m.role}
                          </span>
                        </p>
                      </div>
                      {m.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => void handleRemoveMember(m.user_id)}
                          className="text-[var(--destructive)]"
                        >
                          <MaterialIcon name="person_remove" size={16} />
                          Quitar
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {seatsCount >= seatLimit && seatLimit !== Infinity ? (
                <SurfaceMessage
                  tone="default"
                  title="Límite de seats alcanzado"
                  description={`Tu plan ${planMeta.label} permite hasta ${seatLimit} usuarios. Haz upgrade para agregar más.`}
                  action={
                    <Button size="sm" onClick={() => window.location.href = "/billing"}>
                      <MaterialIcon name="workspace_premium" size={16} />
                      Upgrade
                    </Button>
                  }
                />
              ) : (
                <div className="flex gap-2">
                  <FormInput
                    label="Invitar por email"
                    type="email"
                    value={inviteEmail}
                    onChange={setInviteEmail}
                    placeholder="email@negocio.com"
                  />
                  <div className="flex items-end gap-2">
                    <Button onClick={() => void handleInvite()} disabled={inviting || !inviteEmail.trim()}>
                      <MaterialIcon name="person_add" size={16} />
                      {inviting ? "Enviando..." : "Invitar"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className="rounded-xl">
          <CardHeader className="gap-2 pb-3">
            <div className="space-y-1">
              <CardTitle>Tu plan</CardTitle>
              <CardDescription>
                Plan actual: <strong>{planMeta.label}</strong> — {planMeta.priceLabel}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="outline" onClick={() => window.location.href = "/billing"}>
              <MaterialIcon name="workspace_premium" size={18} />
              Ver planes disponibles
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

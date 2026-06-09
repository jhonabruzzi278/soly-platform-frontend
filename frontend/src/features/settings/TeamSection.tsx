import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../../hooks/useTenant";
import { fetchTenantMembers, inviteMember, removeMember, countTenantSeats } from "../../lib/api";
import { Membership, MemberRole } from "../../lib/types";
import { PlanKey, PLAN_LIMITS, PLAN_META } from "../../lib/features";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

type Props = {
  onFeedback: (fb: { tone: "default" | "danger"; title: string; description: string } | null) => void;
};

export const TeamSection = ({ onFeedback }: Props) => {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [members, setMembers] = useState<Membership[]>([]);
  const [seatsCount, setSeatsCount] = useState(0);
  const [inviteEmail, setInviteEmail] = useState("");
  const inviteRole: MemberRole = "member";
  const [inviting, setInviting] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);

  const plan = (tenant?.plan ?? "starter") as PlanKey;
  const planMeta = PLAN_META[plan];
  const seatLimit = PLAN_LIMITS[plan].seats;

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
    onFeedback(null);
    try {
      await inviteMember(tenant.id, { email: inviteEmail.trim(), role: inviteRole });
      setInviteEmail("");
      onFeedback({ tone: "default", title: "Invitacion enviada", description: `Se envio la invitacion a ${inviteEmail}.` });
      await loadMembers();
    } catch (err) {
      onFeedback({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo enviar la invitacion." });
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!tenant) return;
    onFeedback(null);
    try {
      await removeMember(tenant.id, userId);
      await loadMembers();
      onFeedback({ tone: "default", title: "Miembro eliminado", description: "El usuario fue removido de la organizacion." });
    } catch (err) {
      onFeedback({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo remover el miembro." });
    }
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="gap-2 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle>Equipo</CardTitle>
            <CardDescription>
              Gestiona los miembros de tu organizacion. Plan actual:{" "}
              <strong>{planMeta.label}</strong> ({seatsCount}/{seatLimit === Infinity ? "\u221E" : seatLimit} seats).
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadMembers()}>
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
                  <p className="text-sm font-medium">{m.full_name || m.email || m.user_id}</p>
                  {m.full_name && m.email && (
                    <p className="text-xs text-[var(--muted-foreground)]">{m.email}</p>
                  )}
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    <span className="rounded-full border border-[var(--primary)]/20 bg-[var(--primary)]/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                      {m.role}
                    </span>
                  </p>
                </div>
                {m.role !== "owner" && (
                  <Button variant="ghost" size="sm" onClick={() => void handleRemoveMember(m.user_id)} className="text-[var(--destructive)]">
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
            title="Limite de seats alcanzado"
            description={`Tu plan ${planMeta.label} permite hasta ${seatLimit} usuarios. Haz upgrade para agregar mas.`}
            action={
              <Button size="sm" onClick={() => navigate("/billing")}>
                <MaterialIcon name="workspace_premium" size={16} />
                Upgrade
              </Button>
            }
          />
        ) : (
          <div className="flex gap-2">
            <FormInput label="Invitar por email" type="email" value={inviteEmail} onChange={setInviteEmail} placeholder="email@negocio.com" />
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
  );
};

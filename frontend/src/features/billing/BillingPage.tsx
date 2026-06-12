import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/auth";
import { createFlowSubscription, cancelFlowSubscription, fetchUserSubscription } from "../../lib/api";
import { PLAN_META, PLAN_LIMITS } from "../../lib/features";
import { Subscription } from "../../lib/types";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

const PLAN_FEATURES = [
  "Hasta 20 usuarios",
  "Hasta 10.000 archivos",
  "Gestión de clientes",
  "Citas y agenda",
  "Reportes y KPIs",
  "Inventario",
  "Dashboard avanzado",
  "Soporte prioritario"
];

const STATUS_LABELS: Record<string, { label: string; tone: "default" | "success" | "warning" | "danger" }> = {
  active: { label: "Activa", tone: "success" },
  trialing: { label: "En prueba", tone: "warning" },
  cancelled: { label: "Cancelada", tone: "danger" },
  expired: { label: "Expirada", tone: "danger" }
};

export const BillingPage = () => {
  const { session } = useAuth();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "default" | "danger"; title: string; description: string } | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [subLoading, setSubLoading] = useState(true);

  const loadSubscription = useCallback(async () => {
    if (!session?.userId) { setSubLoading(false); return; }
    try {
      const sub = await fetchUserSubscription(session.userId);
      setSubscription(sub);
    } catch {
      // ignore
    } finally {
      setSubLoading(false);
    }
  }, [session?.userId]);

  useEffect(() => { void loadSubscription(); }, [loadSubscription]);

  useEffect(() => {
    const status = searchParams.get("billing");
    if (status === "success") {
      setMessage({ tone: "default", title: "Suscripcion activada!", description: "Tu plan fue actualizado." });
      void loadSubscription();
    } else if (status === "cancelled") {
      setMessage({ tone: "default", title: "Operacion cancelada", description: "No se realizo ningun cargo." });
    }
  }, [searchParams]);

  const handleSubscribe = async () => {
    setLoading("subscribe");
    setMessage(null);
    try {
      const { url } = await createFlowSubscription("business");
      window.location.href = url;
    } catch (err) {
      setMessage({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo iniciar el pago." });
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;
    if (!window.confirm("Cancelar tu suscripcion? Perderas el acceso al fin del periodo.")) return;
    setLoading("cancel");
    try {
      await cancelFlowSubscription(subscription.id);
      setMessage({ tone: "default", title: "Cancelada", description: "Tu cuenta quedara inactiva al final del periodo." });
      await loadSubscription();
    } catch (err) {
      setMessage({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo cancelar." });
    } finally {
      setLoading(null);
    }
  };

  const planMeta = PLAN_META.business;
  const limits = PLAN_LIMITS.business;
  const statusInfo = subscription?.status ? STATUS_LABELS[subscription.status] : null;
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  const getTrialDaysLeft = () => {
    if (!subscription?.trial_ends_at) return null;
    const now = new Date();
    const trialEnd = new Date(subscription.trial_ends_at);
    const diffMs = trialEnd.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 0;
  };

  const trialDaysLeft = getTrialDaysLeft();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planes y facturacion</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">Gestiona tu suscripcion via Flow.cl.</p>
      </div>

      {message ? <SurfaceMessage tone={message.tone} title={message.title} description={message.description} /> : null}

      {!subLoading && subscription ? (
        <Card className="rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)]">
          <CardHeader>
            <CardTitle>Tu suscripcion</CardTitle>
            <CardDescription>
              Plan: <strong>{planMeta.label}</strong> ({planMeta.priceLabel})
              {statusInfo && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--muted)] px-2 py-0.5 text-xs font-medium">
                  {statusInfo.label}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {subscription.status === "trialing" && trialDaysLeft !== null && (
              <p className="text-sm text-[var(--muted-foreground)]">
                <MaterialIcon name="schedule" size={14} className="inline mr-1" />
                {trialDaysLeft > 0 ? `${trialDaysLeft} dias restantes de prueba` : "Prueba finalizada"}
              </p>
            )}
            {subscription.current_period_end && subscription.status === "active" && (
              <p className="text-sm text-[var(--muted-foreground)]">
                Proximo cobro: {new Date(subscription.current_period_end).toLocaleDateString("es-CL")}
              </p>
            )}
            {subscription.status !== "cancelled" && (
              <Button variant="outline" onClick={() => void handleCancel()} disabled={loading === "cancel"}>
                <MaterialIcon name="cancel" size={18} />
                {loading === "cancel" ? "Cancelando..." : "Cancelar suscripcion"}
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}

      {!isActive && (
        <Card className="relative rounded-xl border border-[var(--primary)]/50 shadow-[var(--neu-shadow-raised)]">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-[var(--primary)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            Plan unico
          </div>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl">{planMeta.label}</CardTitle>
            </div>
            <p className="mt-1 text-3xl font-bold">{planMeta.priceLabel}</p>
            <CardDescription className="mt-2 text-sm">{planMeta.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {PLAN_FEATURES.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <MaterialIcon name="check_circle" size={14} className="mt-0.5 text-[var(--primary)]" />
                  <span>{feature}</span>
                </li>
              ))}
              <li className="flex items-start gap-2">
                <MaterialIcon name="group" size={14} className="mt-0.5 text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">
                  Hasta {limits.seats} usuarios
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MaterialIcon name="folder" size={14} className="mt-0.5 text-[var(--muted-foreground)]" />
                <span className="text-[var(--muted-foreground)]">
                  Hasta {limits.files.toLocaleString()} archivos
                </span>
              </li>
            </ul>
            <Button
              onClick={() => void handleSubscribe()}
              disabled={loading !== null}
              variant="default"
              className="w-full"
            >
              {loading === "subscribe" ? "Procesando..." : "Suscribirse"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)]">
        <CardHeader>
          <CardTitle>Pagos seguros via Flow.cl</CardTitle>
          <CardDescription>
            Flow.cl es la pasarela de pagos lider en Chile. Acepta tarjetas de credito, debito y transferencias bancarias.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
            <div className="flex items-center gap-1">
              <MaterialIcon name="lock" size={14} />
              <span>Pagos seguros</span>
            </div>
            <div className="flex items-center gap-1">
              <MaterialIcon name="autorenew" size={14} />
              <span>Cancela cuando quieras</span>
            </div>
            <div className="flex items-center gap-1">
              <MaterialIcon name="support_agent" size={14} />
              <span>Soporte en espanol</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

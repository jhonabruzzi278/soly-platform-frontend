import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../app/auth";
import { createFlowSubscription, cancelFlowSubscription, fetchUserSubscription } from "../../lib/api";
import { PLAN_META, PLAN_LIMITS } from "../../lib/features";
import { Subscription } from "../../lib/types";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";

const PLAN_FEATURES = [
  "Hasta 20 usuarios",
  "Hasta 10.000 archivos",
  "Gestión de clientes",
  "Citas y agenda",
  "Reportes y KPIs",
  "Inventario",
  "Dashboard avanzado",
  "Soporte prioritario",
];

const STATUS_CONFIG: Record<string, { label: string; icon: string; cls: string }> = {
  active: {
    label: "Activa",
    icon: "check_circle",
    cls: "text-[var(--success)] bg-[var(--success)]/10 border-[var(--success)]/25",
  },
  trialing: {
    label: "En prueba",
    icon: "schedule",
    cls: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800",
  },
  cancelled: {
    label: "Cancelada",
    icon: "cancel",
    cls: "text-[var(--destructive)] bg-[var(--destructive)]/8 border-[var(--destructive)]/20",
  },
  expired: {
    label: "Expirada",
    icon: "timer_off",
    cls: "text-[var(--muted-foreground)] bg-[var(--muted)] border-[var(--border)]",
  },
};

const TRIAL_DAYS = 14;

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
      setMessage({ tone: "default", title: "Suscripción activada", description: "Tu plan fue actualizado correctamente." });
      void loadSubscription();
    } else if (status === "cancelled") {
      setMessage({ tone: "default", title: "Operación cancelada", description: "No se realizó ningún cargo." });
    }
  }, [searchParams]);

  const handleSubscribe = async () => {
    setLoading("subscribe");
    setMessage(null);
    try {
      const { url } = await createFlowSubscription("business");
      if (url) {
        window.location.href = url;
      } else {
        // Trial subscription: Flow activates it directly, no payment redirect needed
        window.location.href = window.location.pathname + "?billing=success";
      }
    } catch (err) {
      setMessage({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo iniciar el pago." });
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!subscription) return;
    if (!window.confirm("¿Cancelar tu suscripción? Perderás el acceso al final del período activo.")) return;
    setLoading("cancel");
    try {
      await cancelFlowSubscription(subscription.id);
      setMessage({ tone: "default", title: "Suscripción cancelada", description: "Tu cuenta quedará inactiva al final del período." });
      await loadSubscription();
    } catch (err) {
      setMessage({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo cancelar." });
    } finally {
      setLoading(null);
    }
  };

  const planMeta = PLAN_META.business;
  const limits = PLAN_LIMITS.business;
  const statusInfo = subscription?.status ? STATUS_CONFIG[subscription.status] : null;
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  const getTrialDaysLeft = () => {
    if (!subscription?.trial_ends_at) return null;
    const diff = new Date(subscription.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const trialDaysLeft = getTrialDaysLeft();
  const trialProgress = trialDaysLeft !== null ? Math.min(100, (trialDaysLeft / TRIAL_DAYS) * 100) : 0;

  if (subLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="h-8 w-48 rounded-xl bg-[var(--muted)] animate-pulse" />
        <div className="h-48 rounded-2xl bg-[var(--muted)] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">Plan y facturación</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Gestiona tu suscripción via Flow.cl.
        </p>
      </div>

      {message ? (
        <SurfaceMessage tone={message.tone} title={message.title} description={message.description} />
      ) : null}

      {/* Active subscription */}
      {subscription && isActive ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--neu-shadow-raised)] p-5 space-y-4 animate-in">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--muted-foreground)]">Suscripción actual</p>
              <p className="mt-1 text-lg font-semibold">{planMeta.label}</p>
              <p className="text-sm text-[var(--muted-foreground)]">{planMeta.priceLabel} / mes</p>
            </div>
            {statusInfo ? (
              <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusInfo.cls}`}>
                <MaterialIcon name={statusInfo.icon} size={12} />
                {statusInfo.label}
              </span>
            ) : null}
          </div>

          {subscription.status === "trialing" && trialDaysLeft !== null ? (
            <div>
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">Período de prueba</span>
                <span className="font-medium tabular-nums text-amber-600 dark:text-amber-400">
                  {trialDaysLeft > 0 ? `${trialDaysLeft} días restantes` : "Prueba finalizada"}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--muted)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-400 transition-all duration-700 ease-out"
                  style={{ width: `${trialProgress}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">
                Flow enviará un email para registrar tu método de pago antes del vencimiento.
              </p>
            </div>
          ) : null}

          {subscription.current_period_end && subscription.status === "active" ? (
            <p className="flex items-center gap-1.5 text-sm text-[var(--muted-foreground)]">
              <MaterialIcon name="autorenew" size={14} />
              Próximo cobro:{" "}
              <span className="font-medium tabular-nums text-[var(--foreground)]">
                {new Date(subscription.current_period_end).toLocaleDateString("es-CL", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </p>
          ) : null}

          {subscription.status !== "cancelled" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleCancel()}
              disabled={loading === "cancel"}
              className="text-[var(--destructive)] border-[var(--destructive)]/30 hover:bg-[var(--destructive)]/5 hover:border-[var(--destructive)]/50"
            >
              <MaterialIcon name="cancel" size={16} />
              {loading === "cancel" ? "Cancelando..." : "Cancelar suscripción"}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Plan card — shown only when not active */}
      {!isActive ? (
        <div className="relative rounded-2xl border-2 border-[var(--primary)]/50 bg-[var(--card)] shadow-[var(--neu-shadow-raised)] overflow-hidden animate-in">
          <div className="bg-[var(--primary)] px-4 py-2.5 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary-foreground)]">
              Plan único · Todo incluido
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Price hero */}
            <div className="flex items-end gap-3">
              <p className="text-5xl font-bold tracking-tight tabular-nums">$49.000</p>
              <div className="pb-1 text-sm text-[var(--muted-foreground)] leading-snug">
                CLP<br />/ mes
              </div>
            </div>

            {/* Trial pill */}
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-900/20">
              <MaterialIcon name="card_giftcard" size={16} className="text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                {TRIAL_DAYS} días de prueba gratis — sin tarjeta requerida
              </p>
            </div>

            {/* Features */}
            <ul className="grid grid-cols-1 gap-y-2.5 sm:grid-cols-2 sm:gap-x-6">
              {PLAN_FEATURES.map((feature, i) => (
                <li key={i} className="flex items-center gap-2.5 text-sm">
                  <MaterialIcon name="check" size={14} className="shrink-0 text-[var(--primary)]" />
                  <span>{feature}</span>
                </li>
              ))}
              <li className="flex items-center gap-2.5 text-sm text-[var(--muted-foreground)]">
                <MaterialIcon name="group" size={14} className="shrink-0" />
                <span>Hasta {limits.seats} usuarios</span>
              </li>
              <li className="flex items-center gap-2.5 text-sm text-[var(--muted-foreground)]">
                <MaterialIcon name="folder" size={14} className="shrink-0" />
                <span>Hasta {limits.files.toLocaleString()} archivos</span>
              </li>
            </ul>

            {/* CTA */}
            <Button
              onClick={() => void handleSubscribe()}
              disabled={loading !== null}
              variant="default"
              className="w-full h-12 text-base font-semibold gap-2"
            >
              {loading === "subscribe" ? (
                <>
                  <MaterialIcon name="progress_activity" size={18} className="animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  <MaterialIcon name="credit_card" size={18} />
                  Comenzar prueba gratis
                </>
              )}
            </Button>

            <p className="text-center text-xs text-[var(--muted-foreground)]">
              Sin cargo durante {TRIAL_DAYS} días · Cancela cuando quieras
            </p>
          </div>
        </div>
      ) : null}

      {/* Trust bar */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-[var(--neu-shadow-raised)] p-4">
        <div className="grid grid-cols-3 divide-x divide-[var(--border)]">
          <div className="flex flex-col items-center gap-1 px-3 text-center">
            <MaterialIcon name="lock" size={20} className="text-[var(--primary)]" />
            <p className="text-xs font-medium">Pago seguro</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">SSL 256-bit</p>
          </div>
          <div className="flex flex-col items-center gap-1 px-3 text-center">
            <MaterialIcon name="autorenew" size={20} className="text-[var(--primary)]" />
            <p className="text-xs font-medium">Sin permanencia</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">Cancela cuando quieras</p>
          </div>
          <div className="flex flex-col items-center gap-1 px-3 text-center">
            <MaterialIcon name="support_agent" size={20} className="text-[var(--primary)]" />
            <p className="text-xs font-medium">Soporte local</p>
            <p className="text-[11px] text-[var(--muted-foreground)]">En español · Chile</p>
          </div>
        </div>
        <p className="mt-3 border-t border-[var(--border)] pt-3 text-center text-[11px] text-[var(--muted-foreground)]">
          Pagos procesados por{" "}
          <span className="font-semibold text-[var(--foreground)]">Flow.cl</span>
          {" "}· Pasarela líder en Chile · Acepta tarjetas y transferencias bancarias
        </p>
      </div>
    </div>
  );
};

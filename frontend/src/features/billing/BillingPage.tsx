import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTenant } from "../../hooks/useTenant";
import { createFlowSubscription, cancelFlowSubscription } from "../../lib/api";
import { PlanKey, PLAN_META } from "../../lib/features";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export const BillingPage = () => {
  const { tenant, refetch } = useTenant();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "default" | "danger"; title: string; description: string } | null>(null);

  useEffect(() => {
    const billingStatus = searchParams.get("billing");
    if (billingStatus === "success") {
      setMessage({ tone: "default", title: "Suscripcion activada!", description: "Tu plan fue actualizado correctamente." });
      void refetch();
    } else if (billingStatus === "cancelled") {
      setMessage({ tone: "default", title: "Operacion cancelada", description: "No se realizo ningun cargo." });
    }
  }, [searchParams]);

  const handleUpgrade = async (planKey: string) => {
    if (!tenant) return;
    setLoading(planKey);
    setMessage(null);
    try {
      const { url } = await createFlowSubscription(tenant.id, planKey);
      window.location.href = url;
    } catch (err) {
      setMessage({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo iniciar el pago." });
    } finally {
      setLoading(null);
    }
  };

  const handleCancel = async () => {
    if (!tenant) return;
    if (!window.confirm("Cancelar tu suscripcion? Perderas el acceso a fin del periodo actual.")) return;
    setLoading("cancel");
    setMessage(null);
    try {
      await cancelFlowSubscription(tenant.id);
      setMessage({ tone: "default", title: "Suscripcion cancelada", description: "Volveras al plan Starter al final del periodo." });
      await refetch();
    } catch (err) {
      setMessage({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo cancelar." });
    } finally {
      setLoading(null);
    }
  };

  const plan = (tenant?.plan ?? "starter") as PlanKey;
  const currentPlanMeta = PLAN_META[plan];
  const hasSubscription = Boolean(tenant?.flow_subscription_id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planes y facturacion</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Gestiona tu suscripcion via Flow.cl.
        </p>
      </div>

      {message ? (
        <SurfaceMessage tone={message.tone} title={message.title} description={message.description} />
      ) : null}

      {hasSubscription ? (
        <Card className="rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)]">
          <CardHeader>
            <CardTitle>Tu suscripcion</CardTitle>
            <CardDescription>
              Plan actual: <strong>{currentPlanMeta.label}</strong> ({currentPlanMeta.priceLabel})
              {tenant?.flow_customer_email ? (
                <> · Email Flow: {tenant.flow_customer_email}</>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {plan !== "starter" && (
                <Button variant="outline" onClick={() => void handleCancel()} disabled={loading === "cancel"}>
                  <MaterialIcon name="cancel" size={18} />
                  {loading === "cancel" ? "Cancelando..." : "Cancelar suscripcion"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {(["business"] as const).map((planKey) => {
          const meta = PLAN_META[planKey];
          const isCurrent = plan === planKey;

          return (
            <Card
              key={planKey}
              className={`rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)] ${
                isCurrent ? "border-[var(--primary)] bg-[var(--primary)]/5" : ""
              }`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{meta.label}</CardTitle>
                  {isCurrent && (
                    <span className="rounded-full border border-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)]">
                      Actual
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-bold">{meta.priceLabel}</p>
                <CardDescription className="mt-2 text-sm">{meta.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={() => void handleUpgrade(planKey)}
                  disabled={isCurrent || loading !== null}
                  variant={isCurrent ? "outline" : "default"}
                  className="w-full"
                >
                  {isCurrent ? "Plan actual" : "Upgrade"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)]">
        <CardHeader>
          <CardTitle>Plan Starter (Gratis)</CardTitle>
          <CardDescription>{PLAN_META.starter.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--muted-foreground)]">
            Siempre puedes comenzar con el plan gratuito. Pago procesado via Flow.cl.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

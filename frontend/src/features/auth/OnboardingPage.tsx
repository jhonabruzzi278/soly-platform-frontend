import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { createTenant } from "../../lib/api";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { PLAN_META } from "../../lib/features";

export const OnboardingPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string>("starter");

  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    const generated = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 30);
    setSlug(generated);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (!slug || !businessName.trim()) {
      setError("El nombre del negocio es requerido.");
      return;
    }
    if (!email.trim()) {
      setError("El email es requerido.");
      return;
    }

    setLoading(true);

    try {
      await createTenant({
        email: email.trim().toLowerCase(),
        password,
        business_name: businessName.trim(),
        slug,
        plan: selectedPlan
      });

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (signInError) throw signInError;

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,102,102,0.16),transparent_45%)]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-4 py-8">
        <Card className="w-full rounded-3xl border border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-transparent bg-[var(--secondary)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)] shadow-[var(--neu-shadow-raised)]">
              <MaterialIcon name="rocket_launch" size={14} />
              Comenzar con Soly
            </div>
            <CardTitle className="mt-4 text-3xl font-semibold tracking-tight">
              Crea tu espacio de trabajo
            </CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">
              Configura tu cuenta y empieza a gestionar tu negocio en minutos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput
                  label="Nombre del negocio"
                  value={businessName}
                  onChange={handleBusinessNameChange}
                  placeholder="Mi Negocio"
                  required
                />
                <FormInput
                  label="URL del espacio"
                  value={slug}
                  onChange={setSlug}
                  placeholder="mi-negocio"
                  hint={`soly.app/t/${slug || "..."}`}
                  required
                />
              </div>

              <FormInput label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" required />
              <div className="grid gap-4 md:grid-cols-2">
                <FormInput label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="Mínimo 8 caracteres" required />
                <FormInput label="Confirmar contraseña" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Repite la contraseña" required />
              </div>

              <div>
                <p className="mb-3 text-sm font-medium">Plan inicial</p>
                <div className="grid gap-3 md:grid-cols-2">
                  {(["starter", "pro", "business"] as const).map((planKey) => {
                    const meta = PLAN_META[planKey];
                    const isSelected = selectedPlan === planKey;
                    return (
                      <button
                        key={planKey}
                        type="button"
                        onClick={() => setSelectedPlan(planKey)}
                        className={`rounded-xl border p-4 text-left transition-all ${
                          isSelected
                            ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-[var(--neu-shadow-pressed)]"
                            : "border-[var(--border)] bg-[var(--muted)]/30 shadow-[var(--neu-shadow-raised)] hover:border-[var(--primary)]/40"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{meta.label}</span>
                          <span className="text-sm font-bold text-[var(--primary)]">{meta.priceLabel}</span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)]">{meta.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error ? (
                <SurfaceMessage tone="danger" title="No se pudo completar" description={error} />
              ) : null}

              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-base shadow-lg">
                <MaterialIcon name="arrow_forward" size={20} filled />
                {loading ? "Creando cuenta..." : "Crear mi cuenta"}
              </Button>

              <p className="text-center text-sm text-[var(--muted-foreground)]">
                Ya tienes cuenta?{" "}
                <a href="/login" className="font-medium text-[var(--primary)] underline underline-offset-4">
                  Iniciar sesión
                </a>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

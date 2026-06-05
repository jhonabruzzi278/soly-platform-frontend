import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { createTenant } from "../../lib/api";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export const OnboardingPage = () => {
  const [businessName, setBusinessName] = useState("");
  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 30));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!businessName.trim() || !email.trim() || !password) { setError("Completa todos los campos."); return; }
    if (password.length < 6) { setError("Minimo 6 caracteres."); return; }

    setLoading(true);
    setError(null);
    try {
      console.log("[Onboarding] creating:", email.trim().toLowerCase());
      const pwd = password;
      await createTenant({
        email: email.trim().toLowerCase(),
        password: pwd,
        business_name: businessName.trim(),
        slug: slug || businessName.trim().toLowerCase().replace(/\s+/g, "-"),
        plan: "starter"
      });

      console.log("[Onboarding] tenant created, signing in...");
      const { error: signError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: pwd });
      if (signError) throw signError;
      console.log("[Onboarding] done");
      setDone(true);
    } catch (err) {
      console.error("[Onboarding] error:", err);
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
          <Card className="w-full rounded-3xl border border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)]/10">
                <MaterialIcon name="check_circle" size={28} className="text-[var(--primary)]" />
              </div>
              <CardTitle className="text-xl">Listo</CardTitle>
              <CardDescription>Redirigiendo a tu espacio...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <Card className="w-full rounded-3xl border border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-transparent bg-[var(--secondary)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)] shadow-[var(--neu-shadow-raised)]">
              <MaterialIcon name="rocket_launch" size={14} />
              Comenzar
            </div>
            <CardTitle className="mt-4 text-2xl font-semibold">Crear cuenta</CardTitle>
            <CardDescription className="mt-2 text-sm">3 campos y listo.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormInput label="Nombre del negocio" value={businessName} onChange={handleBusinessNameChange} placeholder="Mi Negocio" required />
              <FormInput label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" required />
              <FormInput label="Contraseña" type="password" value={password} onChange={setPassword} placeholder="Minimo 6 caracteres" required />
              {slug ? <p className="text-xs text-[var(--muted-foreground)]">soly.app/t/<strong>{slug}</strong></p> : null}
              {error ? <SurfaceMessage tone="danger" title="Error" description={error} /> : null}
              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl">
                {loading ? "Creando..." : "Crear mi cuenta"}
              </Button>
              <p className="text-center text-sm text-[var(--muted-foreground)]">
                Ya tienes cuenta? <Link to="/login" className="text-[var(--primary)] underline underline-offset-4">Ingresar</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

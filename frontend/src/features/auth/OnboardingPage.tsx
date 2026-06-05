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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleBusinessNameChange = (value: string) => {
    setBusinessName(value);
    setSlug(value.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 30));
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!businessName.trim() || !email.trim()) { setError("Completa todos los campos."); return; }

    setLoading(true);
    try {
      const password = crypto.randomUUID() + crypto.randomUUID();
      await createTenant({ email: email.trim().toLowerCase(), password, business_name: businessName.trim(), slug: slug || businessName.trim().toLowerCase().replace(/\s+/g, "-"), plan: "starter" });
      const { error: linkError } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { emailRedirectTo: window.location.origin + "/dashboard" } });
      if (linkError) throw linkError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,102,102,0.16),transparent_45%)]" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
          <Card className="w-full rounded-3xl border border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--primary)]/10">
                <MaterialIcon name="mail" size={28} className="text-[var(--primary)]" />
              </div>
              <CardTitle className="text-xl">Revisa tu email</CardTitle>
              <CardDescription className="mt-2">Enviamos un enlace a <strong>{email}</strong>. Haz clic para empezar.</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,102,102,0.16),transparent_45%)]" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <Card className="w-full rounded-3xl border border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]">
          <CardHeader>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-transparent bg-[var(--secondary)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)] shadow-[var(--neu-shadow-raised)]">
              <MaterialIcon name="rocket_launch" size={14} />
              Comenzar
            </div>
            <CardTitle className="mt-4 text-2xl font-semibold tracking-tight">Crea tu espacio</CardTitle>
            <CardDescription className="mt-2 text-sm leading-6">Solo tu email y el nombre de tu negocio. Sin contraseñas.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormInput label="Nombre del negocio" value={businessName} onChange={handleBusinessNameChange} placeholder="Mi Negocio" required />
              <FormInput label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" required />
              {slug ? <p className="text-xs text-[var(--muted-foreground)]">soly.app/t/<strong>{slug}</strong></p> : null}
              {error ? <SurfaceMessage tone="danger" title="No se pudo completar" description={error} /> : null}
              <Button type="submit" disabled={loading} className="h-12 w-full rounded-xl text-base">
                <MaterialIcon name="arrow_forward" size={20} />
                {loading ? "Creando..." : "Crear mi cuenta"}
              </Button>
              <p className="text-center text-sm text-[var(--muted-foreground)]">
                Ya tienes cuenta? <Link to="/login" className="font-medium text-[var(--primary)] underline underline-offset-4">Ingresar</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

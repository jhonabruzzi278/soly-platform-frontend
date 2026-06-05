import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../app/WorkspaceProvider";
import { supabase } from "../../lib/supabase";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export const LoginPage = () => {
  const { settings } = useWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      setError("Completa todos los campos.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      console.log("[Login] signing in:", normalizedEmail);
      const { error: signError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signError) {
        console.error("[Login] error:", signError.message);
        throw signError;
      }
      console.log("[Login] success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ingresar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,102,102,0.16),transparent_45%)]" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4">
        <Card className="w-full rounded-3xl border border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]">
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-transparent bg-[var(--secondary)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)] shadow-[var(--neu-shadow-raised)]">
              <MaterialIcon name="lock" size={14} />
              Acceso
            </div>
            <CardTitle className="text-2xl font-semibold">Ingresar</CardTitle>
            <CardDescription className="text-sm">{settings.business_name}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormInput label="Email" type="email" value={email} onChange={setEmail} required />
              <FormInput label="Contraseña" type="password" value={password} onChange={setPassword} required />
              {error ? <div role="alert" className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">{error}</div> : null}
              <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg">
                {loading ? "Ingresando..." : "Entrar"}
              </Button>
              <p className="text-center text-sm text-[var(--muted-foreground)]">
                <Link to="/onboarding" className="text-[var(--primary)] underline underline-offset-4">Crear cuenta</Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

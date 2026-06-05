import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useWorkspace } from "../../app/WorkspaceProvider";
import { supabase } from "../../lib/supabase";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { ThemeToggleButton } from "../../components/common/ThemeToggleButton";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

export const LoginPage = () => {
  const { settings } = useWorkspace();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const businessLogo = settings.business_logo_url ?? "/1.jpg";
  const subtitle = settings.business_subtitle ?? "File Manager";

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) {
        setError("Ingresa un email valido.");
        setLoading(false);
        return;
      }

      const { error: signError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password
      });

      if (signError) {
        setError(signError.message);
        setLoading(false);
        return;
      }
    } catch {
      setError("Error inesperado en el flujo de login.");
      setLoading(false);
    }
  };

  return (
    <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,102,102,0.16),transparent_45%)]" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-end gap-2 px-4 py-4 md:px-6 md:py-6">
        <ThemeToggleButton />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-6xl items-center justify-center px-4 pb-6 md:px-6">
        <Card className="w-full max-w-md rounded-3xl border border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]">
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-transparent bg-[var(--secondary)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)] shadow-[var(--neu-shadow-raised)]">
              <MaterialIcon name="lock" size={14} />
              Acceso privado
            </div>
            <div className="flex items-center gap-3">
              <img
                src={businessLogo}
                alt={`Logo de ${settings.business_name}`}
                className="h-12 w-12 rounded-xl border border-transparent object-cover shadow-[var(--neu-shadow-raised)]"
              />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">
                  {settings.business_name}
                </p>
                <p className="text-sm font-medium text-[var(--foreground)]">{subtitle}</p>
              </div>
            </div>
            <div>
              <CardTitle className="text-3xl font-semibold tracking-tight">Iniciar sesión</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6">
                Ingresa con tu email y contraseña.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormInput label="Email" type="email" value={email} onChange={setEmail} required />
              <FormInput label="Contraseña" type="password" value={password} onChange={setPassword} required />

              {error ? (
                <div role="alert" className="rounded-lg border border-transparent bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)] shadow-[var(--neu-shadow-raised)]">
                  {error}
                </div>
              ) : null}

              <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg shadow-lg">
                <MaterialIcon name="arrow_forward" size={18} filled />
                {loading ? "Ingresando..." : "Entrar a la plataforma"}
              </Button>

              <div className="flex items-center justify-between text-sm">
                <Link to="/recuperar-password" className="font-medium text-[var(--primary)] underline underline-offset-4">
                  Olvidé mi contraseña
                </Link>
                <Link to="/onboarding" className="font-medium text-[var(--primary)] underline underline-offset-4">
                  Crear cuenta
                </Link>
              </div>
            </form>

            {settings.support_email ? (
              <p className="mt-4 text-xs text-[var(--muted-foreground)]">
                Soporte: <span className="font-medium text-[var(--foreground)]">{settings.support_email}</span>
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

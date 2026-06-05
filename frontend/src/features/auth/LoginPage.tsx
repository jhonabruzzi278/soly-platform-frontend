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
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Ingresa un email valido.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { error: linkError } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: { emailRedirectTo: window.location.origin + "/dashboard" }
      });
      if (linkError) throw linkError;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el enlace.");
    } finally {
      setLoading(false);
    }
  };

  const signInWithPassword = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (!normalizedEmail) { setError("Ingresa un email valido."); setLoading(false); return; }
      const { error: signError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (signError) throw signError;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ingresar.");
      setLoading(false);
    }
  };

  const businessLogo = settings.business_logo_url ?? "/1.jpg";
  const subtitle = settings.business_subtitle ?? "File Manager";

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
              <CardDescription className="mt-2">Enviamos un enlace magico a <strong>{email}</strong>. Haz clic en el enlace para ingresar.</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button variant="outline" onClick={() => { setSent(false); setError(null); }}>
                Usar otro email
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              <img src={businessLogo} alt={`Logo de ${settings.business_name}`} className="h-12 w-12 rounded-xl border border-transparent object-cover shadow-[var(--neu-shadow-raised)]" />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted-foreground)]">{settings.business_name}</p>
                <p className="text-sm font-medium text-[var(--foreground)]">{subtitle}</p>
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight">Ingresa a tu espacio</CardTitle>
              <CardDescription className="mt-2 text-sm leading-6">
                {showPassword ? "Email y contraseña." : "Te enviamos un enlace magico. Sin contraseña."}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {showPassword ? (
              <form onSubmit={signInWithPassword} className="space-y-4">
                <FormInput label="Email" type="email" value={email} onChange={setEmail} required />
                <FormInput label="Contraseña" type="password" value={password} onChange={setPassword} required />
                {error ? <div role="alert" className="rounded-lg border border-transparent bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">{error}</div> : null}
                <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg">
                  {loading ? "Ingresando..." : "Entrar"}
                </Button>
                <button type="button" onClick={() => setShowPassword(false)} className="w-full text-center text-sm text-[var(--primary)] underline underline-offset-4">
                  Usar enlace magico
                </button>
              </form>
            ) : (
              <form onSubmit={sendMagicLink} className="space-y-4">
                <FormInput label="Email" type="email" value={email} onChange={setEmail} placeholder="tu@email.com" required />
                {error ? <div role="alert" className="rounded-lg border border-transparent bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">{error}</div> : null}
                <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg">
                  <MaterialIcon name="mail" size={18} />
                  {loading ? "Enviando..." : "Enviar enlace magico"}
                </Button>
                <button type="button" onClick={() => setShowPassword(true)} className="w-full text-center text-sm text-[var(--muted-foreground)] underline underline-offset-4">
                  Usar contraseña
                </button>
              </form>
            )}
            <div className="mt-4 flex items-center justify-between text-sm">
              <Link to="/recuperar-password" className="text-[var(--primary)] underline underline-offset-4">Olvide mi contraseña</Link>
              <Link to="/onboarding" className="text-[var(--primary)] underline underline-offset-4">Crear cuenta</Link>
            </div>
            {settings.support_email ? <p className="mt-4 text-xs text-[var(--muted-foreground)]">Soporte: <span className="font-medium text-[var(--foreground)]">{settings.support_email}</span></p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

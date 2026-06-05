import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { changeCurrentUserPassword, sendPasswordRecoveryEmail } from "../../lib/api";
import { supabase } from "../../lib/supabase";

const getRecoveryHintFromHash = () => {
  if (typeof window === "undefined") return false;

  const rawHash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(rawHash);
  const type = (hashParams.get("type") ?? "").toLowerCase();
  const accessToken = hashParams.get("access_token");

  return type === "recovery" || Boolean(accessToken);
};

export const PasswordRecoveryPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"request" | "update">(getRecoveryHintFromHash() ? "update" : "request");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const redirectTo = useMemo(() => {
    if (typeof window === "undefined") return "";
    const appUrl = (import.meta.env.VITE_PUBLIC_APP_URL ?? "").trim();
    const baseUrl = appUrl || window.location.origin;
    return `${baseUrl.replace(/\/+$/, "")}/recuperar-password`;
  }, []);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session && getRecoveryHintFromHash()) {
        setMode("update");
      }
    };

    void boot();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        setMode("update");
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const submitRecoveryEmail = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await sendPasswordRecoveryEmail(email, redirectTo);
      setSuccess("Te enviamos un correo para recuperar contraseña. Revisa bandeja principal y spam.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo enviar el correo de recuperación.");
    } finally {
      setLoading(false);
    }
  };

  const submitPasswordUpdate = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (newPassword.trim().length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    try {
      await changeCurrentUserPassword(newPassword);
      setSuccess("Contraseña actualizada. Vuelve a iniciar sesión.");
      await supabase.auth.signOut();
      window.setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1100);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="theme-shell grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md rounded-3xl">
        <CardHeader className="space-y-3">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--secondary)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)]">
            <MaterialIcon name="lock_reset" size={14} />
            Seguridad
          </div>
          <div>
            <CardTitle>{mode === "request" ? "Recuperar contraseña" : "Nueva contraseña"}</CardTitle>
            <CardDescription className="mt-2">
              {mode === "request"
                ? "Ingresa tu email y te enviaremos un enlace seguro."
                : "Define una nueva contraseña para tu cuenta."}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "request" ? (
            <form onSubmit={submitRecoveryEmail} className="space-y-4">
              <FormInput
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="tu@email.com"
                required
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Enviando..." : "Enviar enlace de recuperacion"}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitPasswordUpdate} className="space-y-4">
              <FormInput
                label="Nueva contraseña"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="Mínimo 8 caracteres"
                required
              />
              <FormInput
                label="Confirmar contraseña"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="Repite la contraseña"
                required
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Guardando..." : "Actualizar contraseña"}
              </Button>
            </form>
          )}

          {error ? (
            <div className="rounded-lg border border-[var(--destructive)]/30 bg-[var(--destructive)]/5 px-3 py-2 text-sm text-[var(--destructive)]">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
              {success}
            </div>
          ) : null}

          <div className="text-sm">
            <Link to="/login" className="text-[var(--primary)] underline underline-offset-4">
              Volver al login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};


import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../app/auth";
import { FormInput } from "../../components/common/FormInput";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";

type Tab = "login" | "signup";

export const LoginPage = () => {
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Signup fields
  const [sName, setSName] = useState("");
  const [sBusiness, setSBusiness] = useState("");
  const [sEmail, setSEmail] = useState("");
  const [sPassword, setSPassword] = useState("");
  const [sConfirm, setSConfirm] = useState("");

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const passwordStrength = (p: string): { label: string; color: string; width: string } => {
    if (!p) return { label: "", color: "", width: "0%" };
    if (p.length < 4) return { label: "Debil", color: "var(--destructive)", width: "25%" };
    if (p.length < 6) return { label: "Regular", color: "#f59e0b", width: "50%" };
    if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /[0-9]/.test(p)) return { label: "Fuerte", color: "var(--success)", width: "100%" };
    if (p.length >= 6) return { label: "Buena", color: "var(--primary)", width: "75%" };
    return { label: "Debil", color: "var(--destructive)", width: "25%" };
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) { setError("Completa todos los campos."); return; }
    if (!isValidEmail(email)) { setError("Email no valido."); return; }
    setLoading(true); setError(null);
    try {
      await login({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al ingresar.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (event: FormEvent) => {
    event.preventDefault();
    const fieldErrors: string[] = [];
    if (!sName.trim()) fieldErrors.push("Nombre requerido.");
    if (!sBusiness.trim()) fieldErrors.push("Nombre del negocio requerido.");
    if (!sEmail.trim()) fieldErrors.push("Email requerido.");
    if (!isValidEmail(sEmail)) fieldErrors.push("Email no valido.");
    if (!sPassword) fieldErrors.push("Contrasena requerida.");
    if (sPassword.length < 6) fieldErrors.push("Minimo 6 caracteres.");
    if (sPassword !== sConfirm) fieldErrors.push("Las contrasenas no coinciden.");
    if (fieldErrors.length > 0) { setError(fieldErrors[0]); return; }

    setLoading(true); setError(null);
    try {
      await signup({ email: sEmail, password: sPassword, name: sName, businessName: sBusiness });
      setSuccess("Cuenta creada. Redirigiendo...");
      setTimeout(() => navigate("/dashboard", { replace: true }), 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al crear cuenta.");
    } finally {
      setLoading(false);
    }
  };

  const strength = passwordStrength(sPassword);

  return (
    <div className="login-theme relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.55),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(0,102,102,0.16),transparent_45%)]" aria-hidden="true" />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-4 py-8">
        <Card className="w-full rounded-3xl border border-transparent bg-[var(--card)] shadow-[var(--neu-shadow-raised)]">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-transparent bg-[var(--secondary)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted-foreground)] shadow-[var(--neu-shadow-raised)]">
              <MaterialIcon name={tab === "login" ? "lock" : "rocket_launch"} size={14} />
              {tab === "login" ? "Acceso" : "Nuevo espacio"}
            </div>
            <CardTitle className="text-2xl font-semibold">{tab === "login" ? "Ingresar" : "Crear cuenta"}</CardTitle>
            <CardDescription className="mt-1 text-sm">Soly · CRM inteligente</CardDescription>
          </CardHeader>

          <CardContent>
            {/* Tabs */}
            <div className="mb-5 flex rounded-xl bg-[var(--muted)]/40 p-1 shadow-[var(--neu-shadow-pressed)]">
              <button onClick={() => { setTab("login"); setError(null); setSuccess(null); }} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "login" ? "bg-[var(--card)] shadow-[var(--neu-shadow-raised)] text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>Login</button>
              <button onClick={() => { setTab("signup"); setError(null); setSuccess(null); }} className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all ${tab === "signup" ? "bg-[var(--card)] shadow-[var(--neu-shadow-raised)] text-[var(--foreground)]" : "text-[var(--muted-foreground)]"}`}>Crear Cuenta</button>
            </div>

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <FormInput label="Email" type="email" value={email} onChange={setEmail} required />
                <FormInput label="Contrasena" type="password" value={password} onChange={setPassword} required />
                {error ? <div role="alert" className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">{error}</div> : null}
                <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg">
                  {loading ? "Ingresando..." : "Entrar"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSignup} className="space-y-3">
                <FormInput label="Tu nombre" value={sName} onChange={setSName} placeholder="Como te llamas" required />
                <FormInput label="Nombre del negocio" value={sBusiness} onChange={setSBusiness} placeholder="Mi Negocio" required />
                <FormInput label="Email" type="email" value={sEmail} onChange={setSEmail} placeholder="tu@email.com" required />
                <FormInput label="Contrasena" type="password" value={sPassword} onChange={setSPassword} placeholder="Minimo 6 caracteres" required />
                {sPassword ? (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full rounded-full bg-[var(--muted)]">
                      <div className="h-1.5 rounded-full transition-all" style={{ width: strength.width, background: strength.color }} />
                    </div>
                    <p className="text-xs" style={{ color: strength.color }}>{strength.label}</p>
                  </div>
                ) : null}
                <FormInput label="Confirmar contrasena" type="password" value={sConfirm} onChange={setSConfirm} placeholder="Repite la contrasena" required />
                {error ? <div role="alert" className="rounded-lg bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--destructive)]">{error}</div> : null}
                {success ? <div role="alert" className="rounded-lg bg-[var(--success)]/10 px-3 py-2 text-sm text-[var(--success)]">{success}</div> : null}
                <Button type="submit" disabled={loading} className="h-11 w-full rounded-lg">
                  <MaterialIcon name="rocket_launch" size={16} />
                  {loading ? "Creando..." : "Crear mi cuenta"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

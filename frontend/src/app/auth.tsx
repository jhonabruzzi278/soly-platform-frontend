import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Session as SupabaseSession, User } from "@supabase/supabase-js";

type SolyRole = "owner" | "admin" | "member";

interface Session {
  userId: string;
  role: SolyRole;
  name: string;
  email: string;
  tenantId: string;
  tenantName: string;
  tenantPlan: string;
}

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<Session>;
  signup: (data: { email: string; password: string; name: string; businessName: string }) => Promise<Session>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function translateAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("user already registered") || lower.includes("already been registered"))
    return "Este correo ya esta registrado. Inicia sesion.";
  if (lower.includes("invalid login credentials"))
    return "Email o contrasena incorrectos.";
  if (lower.includes("password") && (lower.includes("weak") || lower.includes("short")))
    return "La contrasena es muy debil. Minimo 6 caracteres.";
  if (lower.includes("email") && lower.includes("invalid"))
    return "El formato del correo electronico no es valido.";
  if (lower.includes("rate limit") || lower.includes("too many requests"))
    return "Demasiados intentos. Espera unos segundos.";
  if (lower.includes("network") || lower.includes("fetch"))
    return "Error de conexion. Verifica tu internet.";
  if (lower.includes("500") || lower.includes("internal"))
    return "Error del servidor. Intenta de nuevo.";
  if (lower.includes("database"))
    return "Error al guardar tus datos.";
  return message;
}

function buildSession(user: User | null, supabaseSession: SupabaseSession | null): Session | null {
  if (!user || !supabaseSession) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  return {
    userId: user.id,
    role: ((meta.role as string) || "member") as SolyRole,
    name: (meta.name as string) || user.email?.split("@")[0] || "Usuario",
    email: user.email ?? "",
    tenantId: (meta.tenant_id as string) ?? "",
    tenantName: (meta.tenant_name as string) ?? (meta.name as string) ?? "",
    tenantPlan: (meta.plan as string) ?? "starter"
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: sbSession } }) => {
      if (sbSession?.user) setSession(buildSession(sbSession.user, sbSession));
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sbSession) => {
      setSession(sbSession?.user ? buildSession(sbSession.user, sbSession!) : null);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session, loading, error,
    async login({ email, password }) {
      setLoading(true);
      setError(null);
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (loginErr || !data.session) {
        const msg = translateAuthError(loginErr?.message ?? "Error al iniciar sesion");
        setError(msg); setLoading(false);
        throw new Error(msg);
      }
      const s = buildSession(data.session.user, data.session);
      if (!s) { setError("No se pudo iniciar sesion"); setLoading(false); throw new Error("No session"); }
      setSession(s); setLoading(false);
      return s;
    },
    async signup({ email, password, name, businessName }) {
      setLoading(true);
      setError(null);
      const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);
      await supabase.auth.signUp({
        email: email.trim().toLowerCase(), password,
        options: { data: { name, tenant_name: businessName, tenant_id: slug, plan: "starter", role: "owner" } }
      });
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (loginErr || !data.session) {
        const msg = translateAuthError(loginErr?.message ?? "Cuenta creada pero no se pudo iniciar sesion.");
        setError(msg); setLoading(false);
        throw new Error(msg);
      }
      const s = buildSession(data.session.user, data.session);
      if (!s) { setError("No session"); setLoading(false); throw new Error("No session"); }
      setSession(s); setLoading(false);
      return s;
    },
    async logout() {
      await supabase.auth.signOut();
      setSession(null); setError(null);
    }
  }), [session, loading, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}

export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="theme-shell grid min-h-screen place-items-center">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

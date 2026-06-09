import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase, supabaseUrl, supabaseAnonKey } from "../lib/supabase";
import { fetchUserSession, type UserSession } from "../lib/api";
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
  refreshSession: () => Promise<void>;
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
  if (lower.includes("email") && (lower.includes("invalid")))
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

function buildSessionFromMetadata(user: User | null): Session | null {
  if (!user) return null;
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

function buildSessionFromDb(dbSession: UserSession): Session {
  return {
    userId: dbSession.user_id,
    role: (dbSession.membership_role as SolyRole) || "member",
    name: dbSession.full_name || dbSession.email?.split("@")[0] || "Usuario",
    email: dbSession.email,
    tenantId: dbSession.tenant_id ?? "",
    tenantName: dbSession.tenant_name ?? "",
    tenantPlan: dbSession.tenant_plan ?? "starter"
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessionFromDb = async (user: User | null): Promise<Session | null> => {
    if (!user) return null;
    try {
      const dbSession = await fetchUserSession();
      if (dbSession) {
        return buildSessionFromDb(dbSession);
      }
    } catch {
      // Fall back to metadata if DB call fails
    }
    return buildSessionFromMetadata(user);
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: sbSession } }) => {
      if (sbSession?.user) {
        const s = await loadSessionFromDb(sbSession.user);
        setSession(s);
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, sbSession) => {
      if (sbSession?.user) {
        const s = await loadSessionFromDb(sbSession.user);
        setSession(s);
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, []);

  const refreshSession = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const s = await loadSessionFromDb(user);
      setSession(s);
    }
  };

  const value = useMemo<AuthContextValue>(() => ({
    session, loading, error,
    refreshSession,
    async login({ email, password }) {
      setLoading(true);
      setError(null);
      const { data, error: loginErr } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (loginErr || !data.session) {
        const msg = translateAuthError(loginErr?.message ?? "Error al iniciar sesion");
        setError(msg); setLoading(false);
        throw new Error(msg);
      }
      const s = await loadSessionFromDb(data.session.user);
      if (!s) { setError("No se pudo iniciar sesion"); setLoading(false); throw new Error("No session"); }
      setSession(s); setLoading(false);
      return s;
    },
    async signup({ email, password, name, businessName }) {
      setLoading(true);
      setError(null);
      const normalizedEmail = email.trim().toLowerCase();
      const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30);

      const { error: signUpErr } = await supabase.auth.signUp({
        email: normalizedEmail, password,
        options: { data: { name, tenant_name: businessName, tenant_id: slug, plan: "starter", role: "owner" } }
      });

      if (signUpErr && signUpErr.message.includes("already")) {
        const resp = await fetch(`${supabaseUrl}/functions/v1/create-organization`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
          body: JSON.stringify({ email: normalizedEmail, password, business_name: businessName, slug, plan: "starter" })
        });
        if (!resp.ok) {
          const { error: apiErr } = await resp.json();
          throw new Error(apiErr || "Error al crear tu espacio");
        }
      } else if (signUpErr) {
        throw new Error(translateAuthError(signUpErr.message));
      }

      const { data: loginData, error: loginErr } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (loginErr || !loginData.session) {
        throw new Error("Cuenta lista. Inicia sesion en la pestana Login.");
      }
      const s = await loadSessionFromDb(loginData.session.user);
      if (!s) throw new Error("No se pudo iniciar sesion");
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

const EXEMPT_PATHS = ["/login", "/billing", "/recuperar-password"];

export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [hasSub, setHasSub] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session?.userId) {
      setHasSub(false);
      return;
    }
    if (EXEMPT_PATHS.some(p => location.pathname.startsWith(p))) {
      setHasSub(true);
      return;
    }
    let cancelled = false;
    supabase.rpc("has_active_subscription", { p_user_id: session.userId, p_product: "soly" })
      .then(({ data }) => { if (!cancelled) setHasSub(!!data); });
    return () => { cancelled = true; };
  }, [session?.userId, location.pathname]);

  if (loading) return <div className="theme-shell grid min-h-screen place-items-center">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (hasSub === null) return <div className="theme-shell grid min-h-screen place-items-center">Cargando...</div>;
  if (!hasSub && !EXEMPT_PATHS.some(p => location.pathname.startsWith(p))) return <Navigate to="/billing" replace />;
  return <Outlet />;
}

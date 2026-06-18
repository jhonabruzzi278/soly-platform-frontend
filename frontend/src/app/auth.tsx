import * as Sentry from "@sentry/react";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { fetchUserSession, type UserSession } from "../lib/api";
import type { User } from "@supabase/supabase-js";

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
    return "Email o contraseña incorrectos.";
  if (lower.includes("email not confirmed"))
    return "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja (y spam).";
  if (lower.includes("password") && (lower.includes("weak") || lower.includes("short") || lower.includes("at least")))
    return "La contraseña es muy débil. Mínimo 8 caracteres.";
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

  useEffect(() => {
    if (session) {
      Sentry.setUser({ id: session.userId, email: session.email, username: session.name });
    } else {
      Sentry.setUser(null);
    }
  }, [session]);

  const loadSessionFromDb = async (user: User | null): Promise<Session | null> => {
    if (!user) return null;
    try {
      // La RPC no puede colgar el login: si tarda más de 6s caemos a metadata.
      const dbSession = await Promise.race([
        fetchUserSession(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("session timeout")), 6000))
      ]);
      if (dbSession) {
        return buildSessionFromDb(dbSession);
      }
    } catch {
      // Fall back to metadata if DB call fails
    }
    return buildSessionFromMetadata(user);
  };

  useEffect(() => {
    let active = true;

    const applyUser = async (user: User | null) => {
      if (!user) {
        if (active) { setSession(null); setLoading(false); }
        return;
      }
      const s = await loadSessionFromDb(user);
      if (active) { setSession(s); setLoading(false); }
    };

    supabase.auth.getSession().then(({ data: { session: sbSession } }) => {
      void applyUser(sbSession?.user ?? null);
    }).catch(() => {
      if (active) setLoading(false);
    });

    // El callback debe ser síncrono: awaitear llamadas de Supabase aquí dentro
    // deadlockea el lock interno de auth (login colgado en "Cargando...").
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sbSession) => {
      if (event === "TOKEN_REFRESHED") return; // la sesión de app no cambia
      setTimeout(() => {
        if (active) void applyUser(sbSession?.user ?? null);
      }, 0);
    });

    return () => {
      active = false;
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
        options: { data: { name, tenant_name: businessName, tenant_id: slug } }
      });

      if (signUpErr) {
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
      .then(({ data, error }) => {
        // Un error de red no debe dejar la app colgada en "Cargando...";
        // RLS en la base de datos sigue siendo la barrera real de escritura.
        if (!cancelled) setHasSub(error ? true : !!data);
      });
    return () => { cancelled = true; };
  }, [session?.userId, location.pathname]);

  if (loading) return <div className="theme-shell grid min-h-screen place-items-center">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (hasSub === null) return <div className="theme-shell grid min-h-screen place-items-center">Cargando...</div>;
  if (!hasSub && !EXEMPT_PATHS.some(p => location.pathname.startsWith(p))) return <Navigate to="/billing" replace />;
  return <Outlet />;
}

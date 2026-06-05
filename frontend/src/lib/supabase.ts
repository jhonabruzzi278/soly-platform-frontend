import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan variables VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

const isJwtLike = (token: string | null | undefined): token is string =>
  Boolean(token && token.split(".").length === 3);

const toSafeEdgeErrorMessage = (status: number, rawMessage: string) => {
  const normalized = (rawMessage ?? "").trim();
  const lower = normalized.toLowerCase();

  if (status >= 500) {
    return "Error interno del servidor. Intenta nuevamente en unos segundos.";
  }

  if (status === 429) {
    return normalized || "Demasiadas solicitudes. Espera unos segundos e intenta otra vez.";
  }

  if (status === 401) {
    return normalized || "Sesión no válida. Vuelve a iniciar sesión.";
  }

  if (lower.includes("sqlstate") || lower.includes("constraint") || lower.includes("setmore_") || lower.includes("service_role")) {
    return "La solicitud no pudo completarse. Revisa la configuración y vuelve a intentar.";
  }

  return normalized || `Error en Edge Function (${status})`;
};

const extractApiErrorMessage = (parsed: unknown, fallback: string) => {
  const base =
    (typeof parsed === "object" && parsed !== null && "error" in parsed && typeof (parsed as any).error === "string"
      ? (parsed as any).error
      : null) ??
    (typeof parsed === "object" && parsed !== null && "message" in parsed && typeof (parsed as any).message === "string"
      ? (parsed as any).message
      : null) ??
    (typeof parsed === "string" ? parsed : null) ??
    fallback;

  const codes =
    typeof parsed === "object" && parsed !== null && "errorCodes" in parsed && Array.isArray((parsed as any).errorCodes)
      ? (parsed as any).errorCodes.filter((item: unknown) => typeof item === "string")
      : [];

  if (codes.length > 0) {
    return `${base} [${codes.join(", ")}]`;
  }

  return base;
};

const getAccessToken = async (forceRefresh = false) => {
  if (forceRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    const refreshed = data.session?.access_token;
    if (error || !isJwtLike(refreshed)) {
      await supabase.auth.signOut();
      throw new Error("Sesión inválida. Vuelve a iniciar sesión.");
    }
    return refreshed;
  }

  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token || !isJwtLike(session.access_token)) {
    return getAccessToken(true);
  }

  const expiresAtMs = (session.expires_at ?? 0) * 1000;
  if (expiresAtMs !== 0 && expiresAtMs < Date.now() + 60_000) {
    return getAccessToken(true);
  }

  return session.access_token;
};

export const invokeEdgeFunction = async <TBody extends Record<string, unknown>, TResponse = unknown>(
  functionName: string,
  body: TBody
): Promise<TResponse> => {
  const call = async (accessToken: string) => {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });

    const text = await response.text();
    let parsed: unknown = null;

    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }

    return { response, parsed };
  };

  let accessToken = await getAccessToken(false);
  let { response, parsed } = await call(accessToken);

  const errorMessage =
    (typeof parsed === "object" && parsed !== null && "error" in parsed && typeof (parsed as any).error === "string"
      ? (parsed as any).error
      : null) ??
    (typeof parsed === "object" && parsed !== null && "message" in parsed && typeof (parsed as any).message === "string"
      ? (parsed as any).message
      : null) ??
    (typeof parsed === "string" ? parsed : null) ??
    "";

  const shouldRetryWithFreshToken =
    response.status === 401 &&
    (errorMessage.toLowerCase().includes("invalid jwt") || errorMessage.toLowerCase().includes("missing authorization"));

  if (shouldRetryWithFreshToken) {
    accessToken = await getAccessToken(true);
    const retry = await call(accessToken);
    response = retry.response;
    parsed = retry.parsed;
  }

  if (!response.ok) {
    const rawMessage = extractApiErrorMessage(parsed, `Edge Function error (${response.status})`);
    const message = toSafeEdgeErrorMessage(response.status, rawMessage);

    if (response.status === 401 && rawMessage.toLowerCase().includes("invalid jwt")) {
      await supabase.auth.signOut();
      throw new Error("JWT inválido. Se cerró tu sesión; vuelve a iniciar sesión.");
    }

    throw new Error(message);
  }

  return parsed as TResponse;
};


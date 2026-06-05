const FLOW_API_URL = "https://www.flow.cl/api";

export const getFlowCredentials = () => {
  const apiKey = Deno.env.get("FLOW_API_KEY");
  const secretKey = Deno.env.get("FLOW_SECRET_KEY");
  if (!apiKey || !secretKey) throw new Error("FLOW_API_KEY y FLOW_SECRET_KEY son requeridos");
  return { apiKey, secretKey };
};

export const getPlanId = (plan: string): string => {
  const map: Record<string, string | undefined> = {
    pro: Deno.env.get("FLOW_PRO_PLAN_ID"),
    business: Deno.env.get("FLOW_BUSINESS_PLAN_ID"),
    enterprise: Deno.env.get("FLOW_ENTERPRISE_PLAN_ID")
  };
  const id = map[plan];
  if (!id) {
    const fallback = Deno.env.get("FLOW_BUSINESS_PLAN_ID");
    if (fallback) return fallback;
    throw new Error(`Plan ID no configurado para: ${plan}`);
  }
  return id;
};

export const buildSignature = (params: Record<string, string>, secretKey: string): string => {
  const keys = Object.keys(params).sort();
  const message = keys.map((k) => `${k}=${params[k]}`).join("&");
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const msgData = encoder.encode(message);

  return crypto.subtle
    .importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then((key) => crypto.subtle.sign("HMAC", key, msgData))
    .then((sig) => {
      const hex = Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      return hex;
    });
};

export const flowApiCall = async (
  endpoint: string,
  params: Record<string, string>,
  secretKey: string
): Promise<unknown> => {
  const signature = await buildSignature(params, secretKey);
  const formBody = new URLSearchParams({ ...params, s: signature }).toString();

  const response = await fetch(`${FLOW_API_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formBody
  });

  const text = await response.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const msg = typeof parsed === "object" && parsed !== null && "message" in parsed
      ? (parsed as any).message
      : `Flow API error (${response.status})`;
    throw new Error(msg);
  }

  return parsed;
};

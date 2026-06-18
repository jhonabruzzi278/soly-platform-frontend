import { supabase, supabaseUrl, supabaseAnonKey, invokeEdgeFunction } from "./supabase";
import { StorageFile, Tenant, Membership, InviteMemberPayload, DashboardKpi, Customer, AppointmentEnriched, Subscription } from "./types";
import { track } from "./monitoring";

const BUCKET_NAME = import.meta.env.VITE_SUPABASE_BUCKET ?? "excel-files";

// Signed URL lifetime for tenant files. The bucket is PRIVATE — access is
// granted only through short-lived signed URLs scoped to the requesting user
// (storage RLS still enforces tenant isolation on the underlying object).
const SIGNED_URL_TTL_SECONDS = 60 * 10;

const tenantPath = (tenantId: string, filename: string) => `${tenantId}/${filename}`;

export const uploadExcelFile = async (tenantId: string, file: File): Promise<StorageFile> => {
  const path = tenantPath(tenantId, `${Date.now()}-${file.name}`);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  if (error) throw error;

  const { data: urlData } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(data.path, SIGNED_URL_TTL_SECONDS);

  return {
    name: file.name,
    id: data.id ?? data.path,
    created_at: new Date().toISOString(),
    size: file.size,
    url: urlData?.signedUrl ?? ""
  };
};

export const listExcelFiles = async (tenantId: string): Promise<StorageFile[]> => {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(tenantId, {
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error) throw error;

  const items = (data ?? []).filter(
    (item) => item.name.endsWith(".xlsx") || item.name.endsWith(".xls") || item.name.endsWith(".csv")
  );

  if (items.length === 0) return [];

  const paths = items.map((item) => tenantPath(tenantId, item.name));
  const { data: signed, error: signError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);

  if (signError) throw signError;

  const urlByPath = new Map((signed ?? []).map((s) => [s.path ?? "", s.signedUrl ?? ""]));

  return items.map((item, i) => ({
    name: item.name,
    id: item.id ?? item.name,
    created_at: item.created_at ?? new Date().toISOString(),
    size: item.metadata?.size ?? 0,
    url: urlByPath.get(paths[i]) ?? ""
  }));
};

export const deleteExcelFile = async (tenantId: string, fileName: string) => {
  const path = tenantPath(tenantId, fileName);
  const { error } = await supabase.storage.from(BUCKET_NAME).remove([path]);
  if (error) throw error;
};

export const sendPasswordRecoveryEmail = async (email: string, redirectTo: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email requerido.");

  const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo });
  if (error) throw error;
};

export const changeCurrentUserPassword = async (newPassword: string) => {
  const password = newPassword.trim();
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
};

// =========================
// SaaS / Tenant
// =========================

export const updateTenant = async (tenantId: string, payload: Partial<Tenant>) => {
  const { data, error } = await supabase
    .from("tenants")
    .update(payload)
    .eq("id", tenantId)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const fetchTenantMembers = async (tenantId: string): Promise<Membership[]> => {
  const { data, error } = await supabase
    .from("memberships")
    .select("*, tenants(*), profiles:user_id(id, email, full_name)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  type MembershipRow = {
    tenant_id: string;
    user_id: string;
    role: string;
    created_at: string;
    tenants: Tenant | null;
    profiles: { email: string | null; full_name: string | null } | null;
  };
  return ((data ?? []) as MembershipRow[]).map((row) => ({
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    role: row.role,
    created_at: row.created_at,
    tenant: row.tenants,
    email: row.profiles?.email ?? null,
    full_name: row.profiles?.full_name ?? null
  })) as Membership[];
};

export const inviteMember = async (tenantId: string, payload: InviteMemberPayload) => {
  await invokeEdgeFunction("invite-member", {
    tenant_id: tenantId,
    email: payload.email,
    role: payload.role
  });
};

export const removeMember = async (tenantId: string, userId: string) => {
  const { error } = await supabase
    .from("memberships")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("user_id", userId);

  if (error) throw error;
};

export const countTenantSeats = async (tenantId: string): Promise<number> => {
  const { count, error } = await supabase
    .from("tenant_seats")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  if (error) throw error;
  return count ?? 0;
};

// =========================
// Flow.cl Billing (subscriptions)
// =========================

export const createFlowSubscription = async (plan: string, skipTrial = false) => {
  const data = await invokeEdgeFunction<Record<string, unknown>, { url: string | null }>(
    "flow-create-subscription",
    { plan, skipTrial }
  );
  track.subscriptionStarted();
  return data;
};

export const cancelFlowSubscription = async (subId: string) => {
  await invokeEdgeFunction("flow-cancel-subscription", { subscription_id: subId });
  track.subscriptionCancelled();
};

export const fetchUserSubscription = async (userId: string): Promise<Subscription | null> => {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("product", "soly")
    .in("status", ["active", "trialing", "pending_payment"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
};

export const hasActiveSubscription = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc("has_active_subscription", {
    p_user_id: userId,
    p_product: "soly"
  });
  if (error) throw error;
  return data;
};

// =========================
// Onboarding
// =========================

export const createTenant = async (payload: {
  email: string;
  password: string;
  business_name: string;
  slug: string;
  plan?: string;
}) => {
  const response = await fetch(`${supabaseUrl}/functions/v1/create-organization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey
    },
    body: JSON.stringify(payload)
  });

  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }

  if (!response.ok) {
    const msg = typeof parsed === "object" && parsed !== null && "error" in parsed
      ? String((parsed as Record<string, unknown>).error)
      : `Error (${response.status})`;
    throw new Error(msg);
  }

  return parsed as { tenant_id: string };
};

// =========================
// Dashboard
// =========================

export const fetchDashboardKpis = async (): Promise<DashboardKpi> => {
  const { data, error } = await supabase.rpc("get_dashboard_kpis", {
    p_profile_id: (await supabase.auth.getSession()).data.session?.user.id,
    p_role: "admin"
  });

  if (error) throw error;
  return (data?.[0] ?? {
    appointments_today: 0,
    appointments_week: 0,
    appointments_month: 0,
    revenue_month: 0,
    avg_ticket: 0,
    occupancy: 0,
    new_customers: 0,
    recurring_customers: 0
  }) as DashboardKpi;
};

// =========================
// Customers
// =========================

export interface PaginatedResponse<T> {
  data: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export const fetchCustomers = async (tenantId: string): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const fetchCustomersPaginated = async (
  tenantId: string,
  cursor: string | null = null,
  limit: number = 50
): Promise<PaginatedResponse<Customer>> => {
  const { data, error } = await supabase.rpc("get_customers_paginated", {
    p_tenant_id: tenantId,
    p_cursor: cursor,
    p_limit: limit
  });

  if (error) throw error;
  return data as PaginatedResponse<Customer>;
};

export const createCustomer = async (tenantId: string, payload: Partial<Customer>) => {
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...payload, tenant_id: tenantId })
    .select()
    .single();

  if (error) throw error;
  track.customerCreated();
  return data;
};

export const updateCustomer = async (id: string, payload: Partial<Customer>) => {
  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteCustomer = async (id: string) => {
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) throw error;
  track.customerDeleted();
};

export const deleteCustomersBatch = async (ids: string[]) => {
  if (ids.length === 0) return;
  const { error } = await supabase.from("customers").delete().in("id", ids);
  if (error) throw error;
  track.customerBulkDeleted(ids.length);
};

// =========================
// Appointments
// =========================

export const fetchAppointments = async (tenantId: string): Promise<AppointmentEnriched[]> => {
  const { data, error } = await supabase
    .from("vw_appointments_enriched")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("appointment_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const fetchAppointmentsPaginated = async (
  tenantId: string,
  cursor: string | null = null,
  limit: number = 50
): Promise<PaginatedResponse<AppointmentEnriched>> => {
  const { data, error } = await supabase.rpc("get_appointments_paginated", {
    p_tenant_id: tenantId,
    p_cursor: cursor,
    p_limit: limit
  });

  if (error) throw error;
  return data as PaginatedResponse<AppointmentEnriched>;
};

export const createAppointment = async (tenantId: string, payload: Partial<AppointmentEnriched>) => {
  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...payload, tenant_id: tenantId })
    .select()
    .single();

  if (error) throw error;
  track.appointmentCreated();
  return data;
};

export const updateAppointment = async (id: string, payload: Partial<AppointmentEnriched>) => {
  const { data, error } = await supabase
    .from("appointments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  track.appointmentUpdated();
  return data;
};

// =========================
// User Session (from DB - source of truth)
// =========================

export interface UserSession {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  tenant_id: string | null;
  tenant_slug: string | null;
  tenant_name: string | null;
  tenant_plan: string | null;
  membership_role: string | null;
}

export const fetchUserSession = async (): Promise<UserSession | null> => {
  const { data, error } = await supabase.rpc("get_user_session");

  if (error) throw error;
  return data as UserSession | null;
};

// =========================
// Reports
// =========================

type RevenueRow = { barber_name?: string; service_name?: string; revenue: number; day?: string; total?: number; appointment_date?: string };

export const fetchRevenueByBarber = async () => {
  const { data, error } = await supabase
    .from("vw_revenue_by_barber")
    .select("*")
    .order("revenue", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RevenueRow[];
};

export const fetchRevenueByService = async () => {
  const { data, error } = await supabase
    .from("vw_revenue_by_service")
    .select("*")
    .order("revenue", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RevenueRow[];
};

export const fetchAppointmentsPerDay = async () => {
  const { data, error } = await supabase
    .from("vw_appointments_per_day")
    .select("*")
    .order("appointment_date", { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data ?? []) as RevenueRow[];
};

// =========================
// Import data
// =========================

export type ImportAnalysis = {
  dry_run: true;
  table: string;
  total_rows: number;
  valid_rows: number;
  headers: string[];
  mapping: Record<string, string>;
  unmapped: string[];
  mapping_source: "heuristic" | "ai" | "mixed" | "manual";
  ai_error: string | null;
  sample: Record<string, unknown>[];
  errors: string[];
};

export type ImportResult = {
  imported: number;
  skipped_duplicates: number;
  total: number;
  errors: string[];
  mapping: Record<string, string>;
  mapping_source: string;
  table: string;
};

export const analyzeImportFile = async (filePath: string, table: string) => {
  return invokeEdgeFunction<Record<string, unknown>, ImportAnalysis>(
    "import-data",
    { file_path: filePath, table, dry_run: true }
  );
};

export const importDataFromExcel = async (filePath: string, table: string, mapping?: Record<string, string>) => {
  try {
    const result = await invokeEdgeFunction<Record<string, unknown>, ImportResult>(
      "import-data",
      mapping ? { file_path: filePath, table, mapping } : { file_path: filePath, table }
    );
    track.importCompleted(result.imported, result.skipped_duplicates, result.mapping_source);
    return result;
  } catch (err) {
    track.importFailed();
    throw err;
  }
};

// =========================
// AI settings (smart import)
// =========================

export type AiSettings = {
  tenant_id: string;
  provider: "anthropic" | "openai";
  base_url: string | null;
  model: string;
  updated_at: string;
};

export const fetchAiSettings = async (tenantId: string): Promise<AiSettings | null> => {
  // api_key is write-only at the DB level (column grant); never request it.
  const { data, error } = await supabase
    .from("ai_settings")
    .select("tenant_id, provider, base_url, model, updated_at")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const saveAiSettings = async (
  tenantId: string,
  payload: { provider: string; base_url: string | null; model: string; api_key?: string }
) => {
  const existing = await fetchAiSettings(tenantId);
  if (existing) {
    const update: Record<string, unknown> = {
      provider: payload.provider,
      base_url: payload.base_url,
      model: payload.model
    };
    if (payload.api_key) update.api_key = payload.api_key;
    const { error } = await supabase.from("ai_settings").update(update).eq("tenant_id", tenantId);
    if (error) throw error;
  } else {
    if (!payload.api_key) throw new Error("Ingresa la API key.");
    const { error } = await supabase.from("ai_settings").insert({
      tenant_id: tenantId,
      provider: payload.provider,
      base_url: payload.base_url,
      model: payload.model,
      api_key: payload.api_key
    });
    if (error) throw error;
  }
};

export const deleteAiSettings = async (tenantId: string) => {
  const { error } = await supabase.from("ai_settings").delete().eq("tenant_id", tenantId);
  if (error) throw error;
};

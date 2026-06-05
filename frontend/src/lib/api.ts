import { supabase, supabaseUrl, supabaseAnonKey, invokeEdgeFunction } from "./supabase";
import { StorageFile, Tenant, Membership, InviteMemberPayload, DashboardKpi, Customer, AppointmentEnriched } from "./types";

const BUCKET_NAME = import.meta.env.VITE_SUPABASE_BUCKET ?? "excel-files";

const tenantPath = (tenantId: string, filename: string) => `${tenantId}/${filename}`;

export const uploadExcelFile = async (tenantId: string, file: File): Promise<StorageFile> => {
  const path = tenantPath(tenantId, `${Date.now()}-${file.name}`);
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, file, { contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(data.path);

  return {
    name: file.name,
    id: data.id ?? data.path,
    created_at: new Date().toISOString(),
    size: file.size,
    url: urlData.publicUrl
  };
};

export const listExcelFiles = async (tenantId: string): Promise<StorageFile[]> => {
  const { data, error } = await supabase.storage.from(BUCKET_NAME).list(tenantId, {
    sortBy: { column: "created_at", order: "desc" }
  });

  if (error) throw error;

  return (data ?? [])
    .filter((item) => item.name.endsWith(".xlsx") || item.name.endsWith(".xls") || item.name.endsWith(".csv"))
    .map((item) => {
      const filePath = tenantPath(tenantId, item.name);
      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(filePath);

      return {
        name: item.name,
        id: item.id ?? item.name,
        created_at: item.created_at ?? new Date().toISOString(),
        size: item.metadata?.size ?? 0,
        url: urlData.publicUrl
      };
    });
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
    .select("*, tenant:tenants(*)")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Membership[];
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
// Flow.cl Billing
// =========================

export const createFlowSubscription = async (tenantId: string, plan: string) => {
  const data = await invokeEdgeFunction<Record<string, unknown>, { url: string }>(
    "flow-create-subscription",
    { tenant_id: tenantId, plan }
  );
  return data;
};

export const cancelFlowSubscription = async (tenantId: string) => {
  await invokeEdgeFunction("flow-cancel-subscription", { tenant_id: tenantId });
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
      ? (parsed as any).error
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

export const fetchCustomers = async (tenantId: string): Promise<Customer[]> => {
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
};

export const createCustomer = async (tenantId: string, payload: Partial<Customer>) => {
  const { data, error } = await supabase
    .from("customers")
    .insert({ ...payload, tenant_id: tenantId })
    .select()
    .single();

  if (error) throw error;
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

export const createAppointment = async (tenantId: string, payload: Partial<AppointmentEnriched>) => {
  const { data, error } = await supabase
    .from("appointments")
    .insert({ ...payload, tenant_id: tenantId })
    .select()
    .single();

  if (error) throw error;
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
  return data;
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

export const importDataFromExcel = async (tenantId: string, filePath: string, table: string) => {
  const data = await invokeEdgeFunction<Record<string, unknown>, { imported: number; total: number; errors: string[]; headers: string[]; mapping: Record<string, string> }>(
    "import-data",
    { tenant_id: tenantId, file_path: filePath, table }
  );
  return data;
};

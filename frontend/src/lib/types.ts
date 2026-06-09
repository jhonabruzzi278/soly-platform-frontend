import { PlanKey } from "./features";

export type UserRole = "admin" | "user";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  tenant_id?: string | null;
};

export type WorkspaceSettings = {
  business_name: string;
  business_subtitle: string | null;
  business_logo_url: string | null;
  login_image_url: string | null;
  support_email: string | null;
};

export type StorageFile = {
  name: string;
  id: string;
  created_at: string;
  size: number;
  url: string;
};

export type Tenant = {
  id: string;
  slug: string;
  business_name: string;
  business_subtitle: string | null;
  plan: PlanKey;
  product: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MemberRole = "owner" | "admin" | "member" | "viewer";

export type Membership = {
  tenant_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
  tenant?: Tenant;
  email?: string | null;
  full_name?: string | null;
};

export type InviteMemberPayload = {
  email: string;
  role: MemberRole;
};

export type DashboardKpi = {
  appointments_today: number;
  appointments_week: number;
  appointments_month: number;
  revenue_month: number;
  avg_ticket: number;
  occupancy: number;
  new_customers: number;
  recurring_customers: number;
};

export type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  tags: string[];
  total_spent: number;
  total_appointments: number;
  last_appointment_at: string | null;
  next_appointment_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AppointmentEnriched = {
  id: string;
  customer_id: string;
  barber_id: string | null;
  customer_name: string;
  barber_name: string | null;
  appointment_date: string;
  appointment_time: string;
  service_name: string;
  cost: number;
  status: string;
  comments: string | null;
  created_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  product: string;
  plan: PlanKey;
  status: "active" | "cancelled" | "expired" | "trialing";
  provider: string;
  provider_subscription_id: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

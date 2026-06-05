export type PlanKey = "starter" | "pro" | "business" | "enterprise";

export type FeatureKey =
  | "excel_files"
  | "customers"
  | "appointments"
  | "reports";

export const PLAN_LIMITS: Record<PlanKey, { seats: number; files: number; features: FeatureKey[] }> = {
  starter: {
    seats: 1,
    files: 100,
    features: ["excel_files"]
  },
  pro: {
    seats: 5,
    files: 1000,
    features: ["excel_files", "reports"]
  },
  business: {
    seats: 20,
    files: 10000,
    features: ["excel_files", "customers", "appointments", "reports"]
  },
  enterprise: {
    seats: Infinity,
    files: Infinity,
    features: ["excel_files", "customers", "appointments", "reports"]
  }
};

export const PLAN_META: Record<PlanKey, { label: string; price: number; priceLabel: string; description: string }> = {
  starter: {
    label: "Starter",
    price: 0,
    priceLabel: "Gratis",
    description: "Ideal para comenzar. 1 usuario, hasta 100 archivos."
  },
  pro: {
    label: "Pro",
    price: 19,
    priceLabel: "$19/mes",
    description: "Para equipos pequeños. 5 usuarios, KPIs y reportes."
  },
  business: {
    label: "Business",
    price: 49,
    priceLabel: "$49/mes",
    description: "Para negocios en crecimiento. 20 usuarios, clientes y más."
  },
  enterprise: {
    label: "Enterprise",
    price: 99,
    priceLabel: "$99/mes",
    description: "Sin límites. SSO, SLA y acceso a API."
  }
};

export const hasFeature = (plan: PlanKey, feature: FeatureKey): boolean => {
  return PLAN_LIMITS[plan].features.includes(feature);
};

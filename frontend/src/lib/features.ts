export type PlanKey = "business";

export type FeatureKey =
  | "excel_files"
  | "customers"
  | "appointments"
  | "reports";

export const PLAN_LIMITS: Record<PlanKey, { seats: number; files: number; features: FeatureKey[] }> = {
  business: {
    seats: 20,
    files: 10000,
    features: ["excel_files", "customers", "appointments", "reports"]
  }
};

export const PLAN_META: Record<PlanKey, { label: string; price: number; priceLabel: string; description: string }> = {
  business: {
    label: "Soly Business",
    price: 49000,
    priceLabel: "$49.000/mes",
    description: "CRM completo para tu negocio. Todas las features incluidas."
  }
};

export const hasFeature = (plan: PlanKey, feature: FeatureKey): boolean => {
  return PLAN_LIMITS[plan].features.includes(feature);
};

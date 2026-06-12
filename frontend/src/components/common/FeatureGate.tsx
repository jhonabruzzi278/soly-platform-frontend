import { ReactNode } from "react";
import { useTenant } from "../../hooks/useTenant";
import { FeatureKey, hasFeature } from "../../lib/features";

type FeatureGateProps = {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradeCta?: boolean;
};

export const FeatureGate = ({
  feature,
  children,
  fallback
}: FeatureGateProps) => {
  const { tenant, loading } = useTenant();

  if (loading) return null;

  // Con el plan unico business, todas las features estan disponibles
  // Pero mantenemos el gate para compatibilidad futura
  const plan = tenant?.plan ?? "business";

  if (!hasFeature(plan, feature)) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
};

import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "../../hooks/useTenant";
import { FeatureKey, hasFeature } from "../../lib/features";
import { SurfaceMessage } from "../common/SurfaceMessage";
import { Button } from "../ui/button";
import { MaterialIcon } from "../common/MaterialIcon";

type FeatureGateProps = {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
  showUpgradeCta?: boolean;
};

export const FeatureGate = ({
  feature,
  children,
  fallback,
  showUpgradeCta = true
}: FeatureGateProps) => {
  const { tenant, loading } = useTenant();
  const navigate = useNavigate();

  if (loading) return null;

  const plan = tenant?.plan ?? "starter";

  if (!hasFeature(plan, feature)) {
    if (!fallback) {
      return (
        <SurfaceMessage
          tone="default"
          title="Feature no disponible en tu plan"
          description={`Upgrade a Pro o superior para acceder a esta funcionalidad.`}
          action={
            showUpgradeCta ? (
              <Button
                size="sm"
                onClick={() => navigate("/billing")}
              >
                <MaterialIcon name="workspace_premium" size={16} />
                Hacer upgrade
              </Button>
            ) : undefined
          }
        />
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

import { useNavigate } from "react-router-dom";
import { useTenant } from "../../hooks/useTenant";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { PLAN_META } from "../../lib/features";

export const PlanSection = () => {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const planMeta = PLAN_META.business;
  const isActive = tenant?.plan === "business";

  return (
    <Card className="rounded-xl">
      <CardHeader className="gap-2 pb-3">
        <div className="space-y-1">
          <CardTitle>Tu plan</CardTitle>
          <CardDescription>
            <strong>{planMeta.label}</strong> — {planMeta.priceLabel}
            {isActive && <span className="ml-2 text-[var(--success)]">Activo</span>}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button variant="outline" onClick={() => navigate("/billing")}>
          <MaterialIcon name="workspace_premium" size={18} />
          Gestionar suscripcion
        </Button>
      </CardContent>
    </Card>
  );
};

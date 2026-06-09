import { useNavigate } from "react-router-dom";
import { useTenant } from "../../hooks/useTenant";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { PlanKey, PLAN_META } from "../../lib/features";

export const PlanSection = () => {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const plan = (tenant?.plan ?? "starter") as PlanKey;
  const planMeta = PLAN_META[plan];

  return (
    <Card className="rounded-xl">
      <CardHeader className="gap-2 pb-3">
        <div className="space-y-1">
          <CardTitle>Tu plan</CardTitle>
          <CardDescription>
            Plan actual: <strong>{planMeta.label}</strong> — {planMeta.priceLabel}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Button variant="outline" onClick={() => navigate("/billing")}>
          <MaterialIcon name="workspace_premium" size={18} />
          Ver planes disponibles
        </Button>
      </CardContent>
    </Card>
  );
};

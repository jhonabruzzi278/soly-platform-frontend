import { useQueryClient } from "@tanstack/react-query";
import { useTenant } from "../../hooks/useTenant";
import { useDashboardKpis } from "../../hooks/useDashboardKpis";
import { currency, percentage } from "../../lib/format";
import { KpiCard } from "../../components/common/KpiCard";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { Button } from "../../components/ui/button";

export const DashboardPage = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const { data: kpis, isLoading, error, refetch } = useDashboardKpis();

  const handleRefresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard", "kpis"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <MaterialIcon name="dashboard" size={24} filled />
          <h1 className="text-2xl font-semibold">Dashboard</h1>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">Cargando metricas...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MaterialIcon name="dashboard" size={24} filled />
            <h1 className="text-2xl font-semibold">Dashboard</h1>
          </div>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <MaterialIcon name="refresh" size={16} />
            Reintentar
          </Button>
        </div>
        <SurfaceMessage tone="danger" title="Error" description={error.message} />
      </div>
    );
  }

  if (!kpis) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MaterialIcon name="dashboard" size={24} filled />
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {tenant?.business_name ?? "Soly"} · {tenant?.plan ? tenant.plan.charAt(0).toUpperCase() + tenant.plan.slice(1) : "Starter"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <MaterialIcon name="refresh" size={16} />
          Actualizar
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-in"><KpiCard label="Citas hoy" value={String(kpis.appointments_today)} helper="Total de citas del día" icon={<MaterialIcon name="today" size={20} />} /></div>
        <div className="animate-in"><KpiCard label="Citas esta semana" value={String(kpis.appointments_week)} helper="Acumulado semanal" icon={<MaterialIcon name="date_range" size={20} />} /></div>
        <div className="animate-in"><KpiCard label="Citas este mes" value={String(kpis.appointments_month)} helper="Acumulado mensual" icon={<MaterialIcon name="calendar_month" size={20} />} /></div>
        <div className="animate-in"><KpiCard label="Revenue mensual" value={currency(kpis.revenue_month)} helper="Ingresos del mes" icon={<MaterialIcon name="payments" size={20} />} /></div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="animate-in"><KpiCard label="Ticket promedio" value={currency(kpis.avg_ticket)} helper="Por cita completada" icon={<MaterialIcon name="receipt_long" size={20} />} /></div>
        <div className="animate-in"><KpiCard label="Ocupación" value={percentage(kpis.occupancy)} helper="Estimado semanal" icon={<MaterialIcon name="group" size={20} />} /></div>
        <div className="animate-in"><KpiCard label="Clientes nuevos" value={String(kpis.new_customers)} helper="Este mes" icon={<MaterialIcon name="person_add" size={20} />} /></div>
        <div className="animate-in"><KpiCard label="Clientes recurrentes" value={String(kpis.recurring_customers)} helper="Con +1 cita este mes" icon={<MaterialIcon name="repeat" size={20} />} /></div>
      </div>
    </div>
  );
};

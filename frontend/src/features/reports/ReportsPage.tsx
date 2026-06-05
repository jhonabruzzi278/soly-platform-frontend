import { useCallback, useEffect, useState } from "react";
import { useTenant } from "../../hooks/useTenant";
import { currency } from "../../lib/format";
import { fetchRevenueByBarber, fetchRevenueByService, fetchAppointmentsPerDay } from "../../lib/api";
import { KpiCard } from "../../components/common/KpiCard";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

type RevenueRow = { barber_name?: string; service_name?: string; revenue: number; day?: string; total?: number; appointment_date?: string };

export const ReportsPage = () => {
  const { tenant } = useTenant();
  const [revenueByBarber, setRevenueByBarber] = useState<RevenueRow[]>([]);
  const [revenueByService, setRevenueByService] = useState<RevenueRow[]>([]);
  const [appointmentsPerDay, setAppointmentsPerDay] = useState<RevenueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [barberRes, serviceRes, dayRes] = await Promise.all([
        fetchRevenueByBarber(),
        fetchRevenueByService(),
        fetchAppointmentsPerDay()
      ]);
      setRevenueByBarber(barberRes);
      setRevenueByService(serviceRes);
      setAppointmentsPerDay(dayRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reportes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const totalRevenue = revenueByBarber.reduce((s, r) => s + (r.revenue ?? 0), 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <p className="text-sm text-[var(--muted-foreground)]">Cargando reportes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Reportes</h1>
        <SurfaceMessage tone="danger" title="Error" description={error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {tenant?.business_name ?? "Soly"} · Resumen de actividad
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Ingresos totales"
          value={currency(totalRevenue)}
          helper="Todos los tiempos"
          icon={<MaterialIcon name="payments" size={20} />}
        />
        <KpiCard
          label="Barberos activos"
          value={String(revenueByBarber.length)}
          helper="Con ingresos registrados"
          icon={<MaterialIcon name="group" size={20} />}
        />
        <KpiCard
          label="Servicios activos"
          value={String(revenueByService.length)}
          helper="Con ingresos registrados"
          icon={<MaterialIcon name="spa" size={20} />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)]">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Ingresos por barbero</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByBarber.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Sin datos.</p>
            ) : (
              <div className="space-y-2">
                {revenueByBarber.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--muted)]/30 px-3 py-2">
                    <span className="text-sm font-medium">{r.barber_name ?? "Sin asignar"}</span>
                    <span className="text-sm font-semibold">{currency(r.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)]">
          <CardHeader>
            <CardTitle className="text-sm uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Ingresos por servicio</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueByService.length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)]">Sin datos.</p>
            ) : (
              <div className="space-y-2">
                {revenueByService.map((r, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--muted)]/30 px-3 py-2">
                    <span className="text-sm font-medium">{r.service_name}</span>
                    <span className="text-sm font-semibold">{currency(r.revenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)]">
        <CardHeader>
          <CardTitle className="text-sm uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Citas por dia (ultimos 30)</CardTitle>
        </CardHeader>
        <CardContent>
          {appointmentsPerDay.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">Sin datos.</p>
          ) : (
            <div className="space-y-2">
              {appointmentsPerDay.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-[var(--muted)]/30 px-3 py-2">
                  <span className="text-sm font-medium">{r.day ?? r.appointment_date?.toString()}</span>
                  <span className="text-sm font-semibold">{r.total} citas</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

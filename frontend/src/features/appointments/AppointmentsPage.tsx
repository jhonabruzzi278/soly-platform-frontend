import { useState } from "react";
import { useTenant } from "../../hooks/useTenant";
import { useAppointments } from "../../hooks/useAppointments";
import { useCustomers } from "../../hooks/useCustomers";
import { currency } from "../../lib/format";
import { AppointmentEnriched } from "../../lib/types";
import { DataTable } from "../../components/common/DataTable";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Modal } from "../../components/common/Modal";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { FormInput } from "../../components/common/FormInput";
import { StatusBadge } from "../../components/common/StatusBadge";
import { Button } from "../../components/ui/button";

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "No asistio"
};

export const AppointmentsPage = () => {
  const { tenant } = useTenant();
  const {
    appointments,
    isLoading: loadingAppointments,
    error: appointmentsError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    createAppointment,
    updateAppointment,
    isCreating,
    isUpdating
  } = useAppointments(tenant?.id);

  const { customers, isLoading: loadingCustomers } = useCustomers(tenant?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentEnriched | null>(null);
  const [form, setForm] = useState<Partial<AppointmentEnriched>>({});
  const [feedback, setFeedback] = useState<{ tone: "default" | "danger"; title: string; description: string } | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({
      appointment_date: new Date().toISOString().slice(0, 10),
      appointment_time: "10:00",
      service_name: "",
      cost: 0,
      status: "pending"
    });
    setFeedback(null);
    setModalOpen(true);
  };

  const openEdit = (a: AppointmentEnriched) => {
    setEditing(a);
    setForm({ ...a });
    setFeedback(null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!tenant || !form.customer_id || !form.appointment_date || !form.service_name) return;
    setFeedback(null);
    try {
      const payload = {
        customer_id: form.customer_id,
        appointment_date: form.appointment_date,
        appointment_time: form.appointment_time,
        service_name: form.service_name,
        cost: Number(form.cost) || 0,
        status: form.status
      };
      if (editing) {
        await updateAppointment({ id: editing.id, payload });
      } else {
        await createAppointment(payload);
      }
      setModalOpen(false);
    } catch (err) {
      setFeedback({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo guardar." });
    }
  };

  const columns = [
    { key: "date", title: "Fecha", render: (r: AppointmentEnriched) => r.appointment_date },
    { key: "time", title: "Hora", render: (r: AppointmentEnriched) => r.appointment_time?.slice(0, 5) ?? "-" },
    { key: "customer", title: "Cliente", render: (r: AppointmentEnriched) => <span className="font-medium">{r.customer_name}</span> },
    { key: "barber", title: "Barbero", render: (r: AppointmentEnriched) => r.barber_name ?? "-" },
    { key: "service", title: "Servicio", render: (r: AppointmentEnriched) => r.service_name },
    { key: "cost", title: "Costo", render: (r: AppointmentEnriched) => currency(r.cost) },
    {
      key: "status", title: "Estado",
      render: (r: AppointmentEnriched) => (
        <StatusBadge status={statusLabels[r.status] ?? r.status} />
      )
    },
    {
      key: "actions", title: "Acciones",
      render: (r: AppointmentEnriched) => (
        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
          <MaterialIcon name="edit" size={16} />
        </Button>
      )
    }
  ];

  const isLoading = loadingAppointments || loadingCustomers;
  const error = appointmentsError;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{appointments.length} citas registradas</p>
        </div>
        <Button onClick={openCreate}>
          <MaterialIcon name="event" size={18} />
          Nueva cita
        </Button>
      </div>

      {feedback ? <SurfaceMessage tone={feedback.tone} title={feedback.title} description={feedback.description} /> : null}
      {error ? <SurfaceMessage tone="danger" title="Error" description={error.message} /> : null}

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Cargando citas...</p>
      ) : (
        <>
          <DataTable rows={appointments} columns={columns} getRowKey={(r) => r.id} emptyMessage="No hay citas registradas." />
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                <MaterialIcon name="expand_more" size={16} />
                {isFetchingNextPage ? "Cargando..." : "Cargar más"}
              </Button>
            </div>
          )}
        </>
      )}

      <Modal open={modalOpen} title={editing ? "Editar cita" : "Nueva cita"} onClose={() => setModalOpen(false)} size="md">
        <div className="space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Cliente</label>
            <select
              value={form.customer_id ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, customer_id: e.target.value }))}
              className="theme-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Seleccionar cliente</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <FormInput label="Fecha" type="date" value={form.appointment_date ?? ""} onChange={(v) => setForm((p) => ({ ...p, appointment_date: v }))} required />
          <FormInput label="Hora" type="time" value={form.appointment_time ?? ""} onChange={(v) => setForm((p) => ({ ...p, appointment_time: v }))} />
          <FormInput label="Servicio" value={form.service_name ?? ""} onChange={(v) => setForm((p) => ({ ...p, service_name: v }))} required />
          <FormInput label="Costo" type="number" value={String(form.cost ?? 0)} onChange={(v) => setForm((p) => ({ ...p, cost: Number(v) }))} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Estado</label>
            <select
              value={form.status ?? "pending"}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="theme-input rounded-lg px-3 py-2 text-sm"
            >
              {Object.entries(statusLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {feedback ? <SurfaceMessage tone={feedback.tone} title={feedback.title} description={feedback.description} /> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={() => void save()} disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

import { useState } from "react";
import { useTenant } from "../../hooks/useTenant";
import { useCustomers } from "../../hooks/useCustomers";
import { currency, shortDate } from "../../lib/format";
import { Customer } from "../../lib/types";
import { DataTable } from "../../components/common/DataTable";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Modal } from "../../components/common/Modal";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { FormInput } from "../../components/common/FormInput";
import { Button } from "../../components/ui/button";

const emptyCustomer = (): Partial<Customer> => ({
  name: "",
  email: "",
  phone: "",
  notes: ""
});

export const CustomersPage = () => {
  const { tenant } = useTenant();
  const {
    customers,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    isCreating,
    isUpdating,
    isDeleting
  } = useCustomers(tenant?.id);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(emptyCustomer());
  const [feedback, setFeedback] = useState<{ tone: "default" | "danger"; title: string; description: string } | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyCustomer());
    setFeedback(null);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ ...c });
    setFeedback(null);
    setModalOpen(true);
  };

  const save = async () => {
    if (!tenant || !form.name?.trim()) return;
    setFeedback(null);
    try {
      if (editing) {
        await updateCustomer({ id: editing.id, payload: { name: form.name, email: form.email, phone: form.phone, notes: form.notes } });
      } else {
        await createCustomer({ name: form.name, email: form.email, phone: form.phone, notes: form.notes });
      }
      setModalOpen(false);
    } catch (err) {
      setFeedback({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo guardar." });
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Eliminar a "${name}"?`)) return;
    try {
      await deleteCustomer(id);
    } catch (err) {
      setFeedback({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo eliminar." });
    }
  };

  const columns = [
    { key: "name", title: "Nombre", render: (r: Customer) => <span className="font-medium">{r.name}</span> },
    { key: "email", title: "Email", render: (r: Customer) => r.email ?? "-" },
    { key: "phone", title: "Telefono", render: (r: Customer) => r.phone ?? "-" },
    { key: "total_spent", title: "Total gastado", render: (r: Customer) => currency(r.total_spent) },
    { key: "total_appointments", title: "Citas", render: (r: Customer) => String(r.total_appointments) },
    { key: "last_appointment", title: "Ultima cita", render: (r: Customer) => shortDate(r.last_appointment_at) },
    {
      key: "actions", title: "Acciones",
      render: (r: Customer) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
            <MaterialIcon name="edit" size={16} />
          </Button>
          <Button variant="ghost" size="sm" className="text-[var(--destructive)]" onClick={() => void remove(r.id, r.name)} disabled={isDeleting}>
            <MaterialIcon name="delete" size={16} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{customers.length} clientes registrados</p>
        </div>
        <Button onClick={openCreate}>
          <MaterialIcon name="person_add" size={18} />
          Nuevo cliente
        </Button>
      </div>

      {feedback ? <SurfaceMessage tone={feedback.tone} title={feedback.title} description={feedback.description} /> : null}
      {error ? <SurfaceMessage tone="danger" title="Error" description={error.message} /> : null}

      {isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Cargando clientes...</p>
      ) : (
        <>
          <DataTable rows={customers} columns={columns} getRowKey={(r) => r.id} emptyMessage="No hay clientes registrados." />
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

      <Modal open={modalOpen} title={editing ? "Editar cliente" : "Nuevo cliente"} onClose={() => setModalOpen(false)} size="md">
        <div className="space-y-3">
          <FormInput label="Nombre" value={form.name ?? ""} onChange={(v) => setForm((p) => ({ ...p, name: v }))} required />
          <FormInput label="Email" type="email" value={form.email ?? ""} onChange={(v) => setForm((p) => ({ ...p, email: v }))} />
          <FormInput label="Telefono" value={form.phone ?? ""} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
          <FormInput label="Notas" value={form.notes ?? ""} onChange={(v) => setForm((p) => ({ ...p, notes: v }))} />

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

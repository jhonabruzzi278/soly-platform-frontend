import { useCallback, useEffect, useState } from "react";
import { useTenant } from "../../hooks/useTenant";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from "../../lib/api";
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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<Partial<Customer>>(emptyCustomer());
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "default" | "danger"; title: string; description: string } | null>(null);

  const load = useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCustomers(tenant.id);
      setCustomers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar clientes.");
    } finally {
      setLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => { void load(); }, [load]);

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
    setSaving(true);
    setFeedback(null);
    try {
      if (editing) {
        await updateCustomer(editing.id, { name: form.name, email: form.email, phone: form.phone, notes: form.notes });
      } else {
        await createCustomer(tenant.id, { name: form.name, email: form.email, phone: form.phone, notes: form.notes });
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFeedback({ tone: "danger", title: "Error", description: err instanceof Error ? err.message : "No se pudo guardar." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Eliminar a "${name}"?`)) return;
    try {
      await deleteCustomer(id);
      await load();
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
          <Button variant="ghost" size="sm" className="text-[var(--destructive)]" onClick={() => void remove(r.id, r.name)}>
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
      {error ? <SurfaceMessage tone="danger" title="Error" description={error} /> : null}

      {loading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Cargando clientes...</p>
      ) : (
        <DataTable rows={customers} columns={columns} getRowKey={(r) => r.id} emptyMessage="No hay clientes registrados." />
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
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

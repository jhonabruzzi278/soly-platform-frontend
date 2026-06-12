import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "../../hooks/useTenant";
import { DataTable } from "../../components/common/DataTable";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Modal } from "../../components/common/Modal";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { Button } from "../../components/ui/button";
import { deleteExcelFile, listExcelFiles, uploadExcelFile, importDataFromExcel } from "../../lib/api";
import { format } from "date-fns";
import { StorageFile } from "../../lib/types";

type ImportResult = {
  imported: number;
  total: number;
  errors: string[];
  headers: string[];
  mapping: Record<string, string>;
};

export const ExcelUploadPage = () => {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importing, setImporting] = useState(false);
  const [importTable, setImportTable] = useState("customers");
  const [importFile, setImportFile] = useState<string>("");
  const [importModal, setImportModal] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const files = useQuery({
    queryKey: ["storage-files", tenant?.id],
    queryFn: () => listExcelFiles(tenant!.id),
    enabled: !!tenant
  });

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls") && !file.name.endsWith(".csv")) {
      setError("Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv).");
      return;
    }

    setUploading(true);
    setError(null);
    setMessage(null);

    try {
      const uploaded = await uploadExcelFile(tenant!.id, file);
      setMessage(`Archivo "${uploaded.name}" subido.`);
      await queryClient.invalidateQueries({ queryKey: ["storage-files", tenant?.id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async (fileName: string) => {
    setError(null);
    setMessage(null);
    try {
      await deleteExcelFile(tenant!.id, fileName);
      setMessage(`Archivo "${fileName}" eliminado.`);
      await queryClient.invalidateQueries({ queryKey: ["storage-files", tenant?.id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el archivo.");
    }
  };

  const openImport = (fileName: string) => {
    setImportFile(fileName);
    setImportTable("customers");
    setResult(null);
    setImportModal(true);
  };

  const doImport = async () => {
    if (!tenant || !importFile) return;
    setImporting(true);
    setError(null);
    setMessage(null);
    try {
      // La Edge Function exige la ruta completa con prefijo del tenant.
      const data = await importDataFromExcel(tenant.id, `${tenant.id}/${importFile}`, importTable);
      setResult(data);
      setMessage(`Importado: ${data.imported} de ${data.total} registros en "${importTable}".`);
      if (data.errors.length > 0) {
        setError(`${data.errors.length} errores.`);
      }
      setImportModal(false);
      await queryClient.invalidateQueries({ queryKey: ["storage-files", tenant?.id] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar.");
    } finally {
      setImporting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd/MM/yyyy HH:mm");
    } catch {
      return dateStr;
    }
  };

  const columns = [
    {
      key: "name",
      title: "Nombre",
      render: (row: StorageFile) => (
        <div className="flex flex-col">
          <span className="font-medium">{row.name}</span>
          <span className="theme-muted text-xs">{formatSize(row.size)}</span>
        </div>
      )
    },
    {
      key: "date",
      title: "Fecha",
      render: (row: StorageFile) => (
        <span className="text-sm">{formatDate(row.created_at)}</span>
      )
    },
    {
      key: "actions",
      title: "Acciones",
      render: (row: StorageFile) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => openImport(row.name)}>
            <MaterialIcon name="publish" size={14} />
            Importar
          </Button>
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
          >
            <MaterialIcon name="download" size={14} />
            Descargar
          </a>
          <Button variant="outline" size="sm" onClick={() => handleDelete(row.name)}>
            <MaterialIcon name="delete" size={14} />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archivos</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Subi archivos Excel o CSV con datos de clientes, citas, servicios o inventario.
        </p>
      </div>

      {(message || error) ? (
        <div role="alert" aria-live="polite">
          <SurfaceMessage
            tone={error ? "danger" : "default"}
            title={error ? "Error" : "Info"}
            description={error ?? message ?? ""}
          />
        </div>
      ) : null}

      {result?.errors.length ? (
        <SurfaceMessage
          tone="danger"
          title="Errores de importacion"
          description={result.errors.slice(0, 5).join("; ") + (result.errors.length > 5 ? ` y ${result.errors.length - 5} mas...` : "")}
        />
      ) : null}

      <div className="rounded-2xl border border-transparent bg-[var(--muted)]/30 p-6 text-center shadow-[var(--neu-shadow-raised)]">
        <MaterialIcon name="upload_file" size={32} className="mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="mb-1 text-sm font-semibold">Subir archivo</p>
        <p className="mb-4 text-xs text-[var(--muted-foreground)]">
          Formatos aceptados: .xlsx, .xls, .csv
        </p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] shadow-[var(--neu-shadow-raised)] transition-opacity hover:opacity-90">
          <MaterialIcon name="add" size={18} />
          {uploading ? "Subiendo..." : "Seleccionar archivo"}
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      <div className="rounded-2xl border border-transparent bg-[var(--card)] p-4 shadow-[var(--neu-shadow-raised)]">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Formato esperado por tabla</p>
        <p className="mb-3 text-xs text-[var(--muted-foreground)]">
          La importación procesa archivos <strong>CSV separados por comas</strong> con la primera fila de
          encabezados usando exactamente estos nombres de columna:
        </p>
        <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-semibold">Clientes</p>
            <p className="text-[var(--muted-foreground)]">name, email, phone, company, notes</p>
          </div>
          <div>
            <p className="font-semibold">Citas</p>
            <p className="text-[var(--muted-foreground)]">appointment_date, appointment_time, service_name, cost, status, staff_name</p>
          </div>
          <div>
            <p className="font-semibold">Servicios</p>
            <p className="text-[var(--muted-foreground)]">name, price</p>
          </div>
          <div>
            <p className="font-semibold">Inventario</p>
            <p className="text-[var(--muted-foreground)]">name, supplier, cost, sale_price, stock</p>
          </div>
        </div>
      </div>

      {files.isLoading ? (
        <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">Cargando archivos...</p>
      ) : files.error ? (
        <SurfaceMessage tone="danger" title="Error" description={files.error instanceof Error ? files.error.message : "Error desconocido."} />
      ) : (
        <DataTable
          rows={files.data ?? []}
          columns={columns}
          emptyMessage="No hay archivos subidos todavia."
          caption={`${files.data?.length ?? 0} archivo(s)`}
        />
      )}

      <Modal open={importModal} title="Importar datos" onClose={() => setImportModal(false)} size="lg">
        <div className="space-y-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium">Importar en</label>
            <select
              value={importTable}
              onChange={(e) => { setImportTable(e.target.value); setResult(null); }}
              className="theme-input rounded-lg px-3 py-2 text-sm"
            >
              <option value="customers">Clientes</option>
              <option value="appointments">Citas</option>
              <option value="services">Servicios</option>
              <option value="inventory_products">Inventario</option>
            </select>
          </div>

          <p className="text-xs text-[var(--muted-foreground)]">
            Archivo: <strong>{importFile}</strong>
          </p>

          {result ? (
            <div className="rounded-xl bg-[var(--muted)]/30 p-3 text-sm">
              <p>{result.headers.length} columnas detectadas: {result.headers.join(", ")}</p>
              {result.imported !== undefined ? (
                <p className="mt-1 font-semibold text-[var(--success)]">{result.imported} de {result.total} registros importados</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportModal(false)}>Cancelar</Button>
            <Button onClick={() => void doImport()} disabled={importing}>
              {importing ? "Importando..." : "Importar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

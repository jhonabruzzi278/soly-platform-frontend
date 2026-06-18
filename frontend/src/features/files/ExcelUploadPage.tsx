import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTenant } from "../../hooks/useTenant";
import { DataTable } from "../../components/common/DataTable";
import { MaterialIcon } from "../../components/common/MaterialIcon";
import { Modal } from "../../components/common/Modal";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { Button } from "../../components/ui/button";
import {
  deleteExcelFile,
  listExcelFiles,
  uploadExcelFile,
  analyzeImportFile,
  importDataFromExcel,
  type ImportAnalysis,
  type ImportResult
} from "../../lib/api";
import { format } from "date-fns";
import { StorageFile } from "../../lib/types";

const COLUMN_LABELS: Record<string, string> = {
  name: "Nombre",
  email: "Email",
  email_alt: "Email alternativo",
  phone: "Teléfono",
  phone_alt_1: "Teléfono alt. 1",
  phone_alt_2: "Teléfono alt. 2",
  company: "Empresa",
  address: "Dirección",
  city: "Ciudad",
  notes: "Notas",
  tags: "Etiquetas",
  customer_name: "Cliente",
  appointment_date: "Fecha",
  appointment_time: "Hora",
  service_name: "Servicio",
  cost: "Costo",
  status: "Estado",
  staff_name: "Atendido por",
  comments: "Comentarios",
  price: "Precio",
  supplier: "Proveedor",
  sale_price: "Precio de venta",
  stock: "Stock",
  min_stock: "Stock mínimo",
  purchase_date: "Fecha de compra"
};

const colLabel = (col: string) => COLUMN_LABELS[col] ?? col;

const MAPPING_SOURCE_LABELS: Record<string, string> = {
  heuristic: "detección automática",
  ai: "asistente de IA",
  mixed: "detección automática + IA",
  manual: "mapeo manual"
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
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
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
      setMessage(`Archivo "${uploaded.name}" subido. Usa "Importar" para traer los datos al sistema.`);
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
    setAnalysis(null);
    setResult(null);
    setImportModal(true);
  };

  const runAnalysis = async () => {
    if (!tenant || !importFile) return;
    setImporting(true);
    setError(null);
    setAnalysis(null);
    setResult(null);
    try {
      const data = await analyzeImportFile(`${tenant.id}/${importFile}`, importTable);
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar el archivo.");
    } finally {
      setImporting(false);
    }
  };

  const confirmImport = async () => {
    if (!tenant || !importFile || !analysis) return;
    setImporting(true);
    setError(null);
    try {
      // Reusamos el mapeo del análisis para que lo confirmado sea lo importado.
      const data = await importDataFromExcel(`${tenant.id}/${importFile}`, importTable, analysis.mapping);
      setResult(data);
      setMessage(
        `Importado: ${data.imported} de ${data.total} registros` +
        (data.skipped_duplicates > 0 ? ` (${data.skipped_duplicates} duplicados omitidos)` : "") + "."
      );
      if (data.errors.length > 0) {
        setError(`${data.errors.length} filas con errores. Revisa el detalle en el modal.`);
      } else {
        setImportModal(false);
      }
      await queryClient.invalidateQueries();
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

  const sampleColumns = analysis ? Object.values(analysis.mapping) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Archivos</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Sube tu planilla Excel o CSV: el sistema detecta las columnas automáticamente y organiza tus datos.
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

      {result && result.imported > 0 ? (
        <div className="flex items-center justify-between rounded-2xl border border-transparent bg-[var(--success)]/10 p-4 shadow-[var(--neu-shadow-raised)]">
          <div className="flex items-center gap-2 text-sm">
            <MaterialIcon name="check_circle" size={18} className="text-[var(--success)]" />
            <span>
              {result.imported} registros importados. Tu información ya está organizada.
            </span>
          </div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
          >
            <MaterialIcon name="monitoring" size={16} />
            Ver métricas
          </Link>
        </div>
      ) : null}

      <div className="rounded-2xl border border-transparent bg-[var(--muted)]/30 p-6 text-center shadow-[var(--neu-shadow-raised)]">
        <MaterialIcon name="upload_file" size={32} className="mx-auto mb-3 text-[var(--muted-foreground)]" />
        <p className="mb-1 text-sm font-semibold">Subir archivo</p>
        <p className="mb-4 text-xs text-[var(--muted-foreground)]">
          Formatos: .xlsx, .xls, .csv · máx. 10 MB · hasta 10.000 filas
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
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Cómo funciona la importación</p>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-[var(--muted-foreground)]">
          <li>Sube tu planilla tal como la tienes: los encabezados pueden estar en español o inglés (nombre, teléfono, fecha, valor...).</li>
          <li>Presiona <strong>Importar</strong> y elige qué contiene: clientes, citas, servicios o inventario.</li>
          <li><strong>Analizar</strong> te muestra cómo se interpretó cada columna y una vista previa, sin guardar nada.</li>
          <li>Si todo se ve bien, <strong>Confirmar importación</strong> guarda los datos (los duplicados se omiten).</li>
        </ol>
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          ¿Columnas con nombres poco comunes? Configura un asistente de IA en{" "}
          <Link to="/configuracion" className="text-[var(--primary)] underline underline-offset-2">Configuración</Link>{" "}
          para que ayude a reconocerlas.
        </p>
      </div>

      {/* ---- Plantillas de ejemplo ---- */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted-foreground)]">Plantillas de ejemplo</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Clientes */}
          <div className="rounded-2xl border border-transparent bg-[var(--card)] p-4 shadow-[var(--neu-shadow-raised)] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Clientes</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">Columnas reconocidas automáticamente</p>
              </div>
              <a
                href="/plantilla-clientes.csv"
                download="plantilla-clientes.csv"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
              >
                <MaterialIcon name="download" size={13} />
                Descargar CSV
              </a>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]/40 bg-[var(--muted)]/20">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border)]/40 bg-[var(--muted)]/40">
                    {["nombre", "email", "telefono", "empresa", "notas"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-[var(--muted-foreground)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["María González", "maria@ejemplo.cl", "+56912345678", "Peluquería Rosa", "Cliente VIP"],
                    ["Carlos Pérez", "carlos@ejemplo.cl", "+56987654321", "—", "Primera visita"],
                    ["Ana Torres", "—", "+56933445566", "Spa Bella", "Fines de semana"],
                  ].map((row, i) => (
                    <tr key={i} className="border-t border-[var(--border)]/30">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1.5 text-[var(--muted-foreground)] whitespace-nowrap">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              También se reconocen: <span className="font-medium">correo, celular, whatsapp, empresa, observaciones</span> y más alias.
            </p>
          </div>

          {/* Citas */}
          <div className="rounded-2xl border border-transparent bg-[var(--card)] p-4 shadow-[var(--neu-shadow-raised)] space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">Citas</p>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">El cliente se crea automáticamente si no existe</p>
              </div>
              <a
                href="/plantilla-citas.csv"
                download="plantilla-citas.csv"
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-medium text-[var(--primary-foreground)]"
              >
                <MaterialIcon name="download" size={13} />
                Descargar CSV
              </a>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--border)]/40 bg-[var(--muted)]/20">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[var(--border)]/40 bg-[var(--muted)]/40">
                    {["cliente", "fecha", "hora", "servicio", "costo", "estado"].map((h) => (
                      <th key={h} className="px-2 py-1.5 text-left font-semibold text-[var(--muted-foreground)] whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["María González", "2025-03-15", "10:00", "Corte de cabello", "15000", "completada"],
                    ["Carlos Pérez",   "2025-03-15", "11:30", "Afeitado clásico",  "8000",  "completada"],
                    ["Ana Torres",     "2025-03-16", "09:00", "Tintura",           "45000", "pendiente"],
                  ].map((row, i) => (
                    <tr key={i} className="border-t border-[var(--border)]/30">
                      {row.map((cell, j) => (
                        <td key={j} className="px-2 py-1.5 text-[var(--muted-foreground)] whitespace-nowrap">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-0.5 text-[11px] text-[var(--muted-foreground)]">
              <p><span className="font-medium">fecha:</span> AAAA-MM-DD · <span className="font-medium">hora:</span> HH:MM</p>
              <p><span className="font-medium">estado válidos:</span> pendiente, confirmada, completada, cancelada, no_show</p>
              <p>Columnas opcionales: <span className="font-medium">atendido_por, comentarios</span></p>
            </div>
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
            <label className="text-sm font-medium">¿Qué contiene este archivo?</label>
            <select
              value={importTable}
              onChange={(e) => { setImportTable(e.target.value); setAnalysis(null); setResult(null); }}
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

          {analysis ? (
            <div className="space-y-3 rounded-xl bg-[var(--muted)]/30 p-3 text-sm">
              <p>
                <strong>{analysis.valid_rows}</strong> de {analysis.total_rows} filas listas para importar
                <span className="text-xs text-[var(--muted-foreground)]"> · columnas reconocidas por {MAPPING_SOURCE_LABELS[analysis.mapping_source] ?? analysis.mapping_source}</span>
              </p>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(analysis.mapping).map(([from, to]) => (
                  <span key={from} className="inline-flex items-center gap-1 rounded-full bg-[var(--card)] px-2 py-0.5 text-xs shadow-[var(--neu-shadow-raised)]">
                    {from} <MaterialIcon name="arrow_forward" size={11} /> <strong>{colLabel(to)}</strong>
                  </span>
                ))}
              </div>

              {analysis.unmapped.length > 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Columnas ignoradas: {analysis.unmapped.join(", ")}
                </p>
              ) : null}

              {analysis.ai_error ? (
                <p className="text-xs text-[var(--destructive)]">Asistente de IA no disponible: {analysis.ai_error}</p>
              ) : null}

              {analysis.sample.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-[var(--muted-foreground)]">
                        {sampleColumns.map((c) => <th key={c} className="px-2 py-1 font-medium">{colLabel(c)}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.sample.map((row, i) => (
                        <tr key={i} className="border-t border-[var(--border)]/50">
                          {sampleColumns.map((c) => (
                            <td key={c} className="px-2 py-1">{Array.isArray(row[c]) ? (row[c] as string[]).join(", ") : String(row[c] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              {analysis.errors.length > 0 ? (
                <div className="text-xs text-[var(--destructive)]">
                  {analysis.errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
                </div>
              ) : null}
            </div>
          ) : null}

          {result && result.errors.length > 0 ? (
            <div className="rounded-xl bg-[var(--destructive)]/10 p-3 text-xs text-[var(--destructive)]">
              {result.errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportModal(false)}>Cerrar</Button>
            <Button variant={analysis ? "outline" : "default"} onClick={() => void runAnalysis()} disabled={importing}>
              <MaterialIcon name="search" size={16} />
              {importing && !analysis ? "Analizando..." : "Analizar"}
            </Button>
            {analysis && analysis.valid_rows > 0 ? (
              <Button onClick={() => void confirmImport()} disabled={importing}>
                <MaterialIcon name="publish" size={16} />
                {importing ? "Importando..." : `Confirmar importación (${analysis.valid_rows})`}
              </Button>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
};

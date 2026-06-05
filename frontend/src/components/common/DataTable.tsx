import { ReactNode } from "react";
import { Card } from "../ui/card";

type Column<T> = {
  key: string;
  title: string;
  render: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
};

type DataTableProps<T> = {
  rows: T[];
  columns: Array<Column<T>>;
  getRowKey?: (row: T, index: number) => string;
  emptyMessage?: string;
  caption?: string;
};

export const DataTable = <T,>({ rows, columns, getRowKey, emptyMessage, caption }: DataTableProps<T>) => {
  const resolvedEmptyMessage = emptyMessage ?? "No hay datos para mostrar.";

  return (
    <Card className="overflow-hidden rounded-2xl border border-transparent shadow-[var(--neu-shadow-raised)]">
      {caption ? <div className="border-b border-transparent px-4 py-3 text-xs text-[var(--muted-foreground)]">{caption}</div> : null}

      <div className="space-y-2.5 p-2.5 md:hidden">
        {rows.length === 0 ? (
          <div className="rounded-xl px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">{resolvedEmptyMessage}</div>
        ) : (
          rows.map((row, idx) => (
            <article key={getRowKey ? getRowKey(row, idx) : idx} className="rounded-xl border border-transparent bg-[var(--muted)]/50 p-3.5 shadow-[var(--neu-shadow-raised)]">
              <div className="space-y-2.5">
                {columns.map((column) => (
                  <div key={column.key} className="border-b border-transparent pb-2.5 last:border-b-0 last:pb-0">
                    <p className="mb-1 text-[11px] uppercase tracking-[0.24em] text-[var(--muted-foreground)]">{column.title}</p>
                    <div className="text-sm">{column.render(row)}</div>
                  </div>
                ))}
              </div>
            </article>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full w-max text-sm">
          <thead className="bg-[var(--muted)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)] shadow-[var(--neu-shadow-pressed)]">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={`px-4 py-3 whitespace-nowrap ${column.headerClassName ?? ""}`}>
                  {column.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-[var(--muted-foreground)]">
                  {resolvedEmptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={getRowKey ? getRowKey(row, idx) : idx} className="border-t border-transparent text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/35">
                  {columns.map((column) => (
                    <td key={column.key} className={`px-4 py-3 align-top ${column.cellClassName ?? ""}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

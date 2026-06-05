type FilterScopeSummaryProps = {
  from: string;
  to: string;
  primaryLabel: string;
  primaryValue: string;
  chips: string[];
  note?: string;
};

export const FilterScopeSummary = ({
  from,
  to,
  primaryLabel,
  primaryValue,
  chips,
  note
}: FilterScopeSummaryProps) => (
  <section className="theme-surface rounded-[1.5rem] px-4 py-4">
    <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
      <div>
        <p className="theme-muted text-[11px] uppercase tracking-[0.24em]">Periodo visible</p>
        <p className="mt-2 text-sm font-medium">
          {from} a {to}
        </p>
        {note ? <p className="theme-muted mt-2 text-sm leading-6">{note}</p> : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="theme-muted text-[11px] uppercase tracking-[0.24em]">{primaryLabel}</p>
          <p className="mt-2 text-sm font-medium">{primaryValue}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {chips.length === 0 ? (
            <span className="theme-chip rounded-full px-3 py-1.5 text-xs">Sin filtros adicionales</span>
          ) : (
            chips.map((chip) => (
              <span key={chip} className="theme-chip rounded-full px-3 py-1.5 text-xs">
                {chip}
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  </section>
);

import { ReactNode } from "react";
import { Card, CardContent } from "../ui/card";

type KpiCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon?: ReactNode;
  compact?: boolean;
};

export const KpiCard = ({ label, value, helper, icon, compact = false }: KpiCardProps) => (
  <Card className="rounded-2xl border-[var(--border)] bg-[var(--card)] card-hover">
    <CardContent className={compact ? "p-3 sm:p-4" : "p-4"}>
      <div className={`${compact ? "mb-2.5 sm:mb-4" : "mb-4"} flex items-start justify-between gap-2.5`}>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{label}</p>
        {icon ? (
          <div
            className={`${compact ? "h-7 w-7 rounded-lg sm:h-9 sm:w-9 sm:rounded-xl" : "h-9 w-9 rounded-xl"} inline-flex items-center justify-center bg-[var(--secondary)] text-[var(--accent-foreground)]`}
            aria-hidden="true"
          >
            {icon}
          </div>
        ) : null}
      </div>
      <p className={`tabular-nums ${compact ? "text-[1.2rem] font-semibold tracking-[-0.02em] sm:text-[1.7rem]" : "text-[1.85rem] font-semibold tracking-[-0.03em]"}`}>
        {value}
      </p>
      {helper ? (
        <p className={compact ? "mt-1.5 text-[11px] leading-4 text-[var(--muted-foreground)] sm:mt-2 sm:text-[12px] sm:leading-5" : "mt-2 text-[12px] leading-5 text-[var(--muted-foreground)]"}>
          {helper}
        </p>
      ) : null}
    </CardContent>
  </Card>
);

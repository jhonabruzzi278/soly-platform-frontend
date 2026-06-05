import * as React from "react";
import { es } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import { cn } from "../../lib/cn";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  locale = es,
  ...props
}: CalendarProps) => {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      locale={locale}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col gap-4 sm:flex-row sm:gap-6",
        month: "space-y-4",
        caption: "relative flex items-center justify-center pt-1",
        caption_label: "text-sm font-semibold tracking-tight",
        nav: "flex items-center gap-1",
        dropdowns: "flex items-center gap-2",
        dropdown:
          "h-8 rounded-md border border-[var(--input)] bg-[var(--background)] px-2 text-xs font-medium text-[var(--foreground)]",
        button_previous:
          "absolute left-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]",
        button_next:
          "absolute right-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday:
          "w-9 rounded-md text-[0.72rem] font-medium uppercase tracking-[0.18em] text-[var(--muted-foreground)]",
        week: "mt-2 flex w-full",
        day: "relative h-9 w-9 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        day_button:
          "h-9 w-9 rounded-md p-0 font-normal text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        today: "text-[var(--foreground)]",
        outside: "text-[var(--muted-foreground)] opacity-40",
        disabled: "text-[var(--muted-foreground)] opacity-30",
        hidden: "invisible",
        selected:
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] focus:bg-[var(--primary)] focus:text-[var(--primary-foreground)]",
        range_start:
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]",
        range_end:
          "bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)]",
        range_middle:
          "bg-[var(--muted)] text-[var(--foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
        ...classNames
      }}
      {...props}
    />
  );
};

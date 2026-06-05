import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import type { DateRange as CalendarRange } from "react-day-picker";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Calendar } from "../ui/calendar";

type DateRangePickerProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
};

const parseDateValue = (value: string) => (value ? new Date(`${value}T12:00:00`) : undefined);

export const DateRangePicker = ({
  from,
  to,
  onFromChange,
  onToChange
}: DateRangePickerProps) => {
  const [timeZone, setTimeZone] = useState<string | undefined>(undefined);
  const [numberOfMonths, setNumberOfMonths] = useState(2);

  useEffect(() => {
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);

    const syncMonths = () => {
      setNumberOfMonths(window.innerWidth < 768 ? 1 : 2);
    };

    syncMonths();
    window.addEventListener("resize", syncMonths);

    return () => window.removeEventListener("resize", syncMonths);
  }, []);

  const selected = useMemo<CalendarRange | undefined>(() => {
    const fromDate = parseDateValue(from);
    const toDate = parseDateValue(to);

    if (!fromDate && !toDate) {
      return undefined;
    }

    return {
      from: fromDate,
      to: toDate ?? fromDate
    };
  }, [from, to]);

  const handleSelect = (range: CalendarRange | undefined) => {
    if (!range?.from) {
      onFromChange("");
      onToChange("");
      return;
    }

    const nextFrom = format(range.from, "yyyy-MM-dd");
    const nextTo = format(range.to ?? range.from, "yyyy-MM-dd");

    onFromChange(nextFrom);
    onToChange(nextTo);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-xs text-[var(--foreground)]">
          <span className="font-medium">Desde</span>
          <Input type="date" value={from} onChange={(event) => onFromChange(event.target.value)} aria-label="Fecha desde" />
        </label>

        <label className="flex flex-col gap-2 text-xs text-[var(--foreground)]">
          <span className="font-medium">Hasta</span>
          <Input type="date" value={to} onChange={(event) => onToChange(event.target.value)} aria-label="Fecha hasta" />
        </label>
      </div>

      <Card className="overflow-hidden rounded-xl">
        <Calendar
          mode="range"
          selected={selected}
          onSelect={handleSelect}
          numberOfMonths={numberOfMonths}
          captionLayout="dropdown"
          fromYear={2023}
          toYear={2032}
          timeZone={timeZone}
        />
      </Card>
    </div>
  );
};

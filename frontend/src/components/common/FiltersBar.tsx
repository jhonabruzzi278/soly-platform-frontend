import { ReactNode } from "react";
import { Card } from "../ui/card";

type FiltersBarProps = {
  children: ReactNode;
};

export const FiltersBar = ({ children }: FiltersBarProps) => (
  <Card className="mb-4 flex flex-col gap-3 rounded-2xl border-[var(--border)] bg-[var(--card)] p-3.5 sm:flex-row sm:flex-wrap sm:items-end">
    {children}
  </Card>
);

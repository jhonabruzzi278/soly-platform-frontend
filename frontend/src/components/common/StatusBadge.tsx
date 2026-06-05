import { Badge } from "../ui/badge";

type StatusBadgeProps = {
  status: string;
};

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const normalized = status.toLowerCase();
  const tone =
    normalized === "confirmed" || normalized === "completed"
      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
      : normalized === "cancelled" || normalized === "no_show"
        ? "bg-red-500/12 text-red-700 dark:text-red-300"
        : "bg-amber-500/12 text-amber-700 dark:text-amber-300";

  return <Badge className={tone}>{status}</Badge>;
};

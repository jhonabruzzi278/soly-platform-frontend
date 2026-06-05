import { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

type SurfaceMessageProps = {
  title: string;
  description?: string;
  tone?: "default" | "danger";
  action?: ReactNode;
  role?: "alert" | "status";
};

export const SurfaceMessage = ({
  title,
  description,
  tone = "default",
  action,
  role = "status"
}: SurfaceMessageProps) => (
  <Card
    role={role}
    className={cn(
      "rounded-xl border border-transparent shadow-[var(--neu-shadow-raised)]",
      tone === "danger" ? "bg-[color-mix(in_srgb,var(--destructive)_14%,var(--card))]" : "bg-[var(--card)]"
    )}
    aria-label={title}
  >
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <CardHeader className="p-4 pb-0">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        {description ? (
          <CardContent className="p-4 pt-2 text-sm leading-6 text-[var(--muted-foreground)]">{description}</CardContent>
        ) : null}
      </div>
      {action ? <div className="p-4 pt-0 sm:pt-4">{action}</div> : null}
    </div>
  </Card>
);

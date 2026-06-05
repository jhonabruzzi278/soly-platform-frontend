import { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--neu-shadow-raised)]",
  secondary: "bg-[var(--muted)] text-[var(--foreground)] shadow-[var(--neu-shadow-raised)]",
  outline: "border border-transparent bg-[var(--card)] text-[var(--foreground)] shadow-[var(--neu-shadow-raised)]",
  destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)] shadow-[var(--neu-shadow-raised)]"
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

export const Badge = ({ className, variant = "secondary", ...props }: BadgeProps) => (
  <span
    className={cn(
      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
      variantClasses[variant],
      className
    )}
    {...props}
  />
);

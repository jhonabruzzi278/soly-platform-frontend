import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "default" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "icon";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClasses: Record<ButtonVariant, string> = {
  default:
    "bg-[var(--primary)] text-[var(--primary-foreground)] shadow-[var(--neu-shadow-raised)] hover:opacity-95 active:translate-y-px active:shadow-[var(--neu-shadow-pressed)]",
  outline:
    "border border-transparent bg-[var(--card)] text-[var(--card-foreground)] shadow-[var(--neu-shadow-raised)] hover:bg-[var(--secondary)] active:translate-y-px active:shadow-[var(--neu-shadow-pressed)]",
  ghost:
    "border border-transparent bg-[var(--card)] text-[var(--muted-foreground)] shadow-[var(--neu-shadow-raised)] hover:text-[var(--foreground)] active:translate-y-px active:shadow-[var(--neu-shadow-pressed)]",
  destructive: "bg-[var(--destructive)] text-[var(--destructive-foreground)] shadow-[var(--neu-shadow-raised)] hover:opacity-95"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 rounded-xl px-3 text-sm",
  md: "h-10 rounded-xl px-4 text-sm",
  icon: "h-10 w-10 rounded-xl"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "md", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
});

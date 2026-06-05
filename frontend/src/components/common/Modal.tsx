import { ReactNode } from "react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";

type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: "md" | "lg" | "xl";
};

const sizeClasses = {
  md: "md:max-w-xl",
  lg: "md:max-w-3xl",
  xl: "md:max-w-5xl"
};

export const Modal = ({ open, title, children, onClose, size = "md" }: ModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm md:grid md:place-items-center md:px-4">
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`max-h-[88vh] w-full overflow-y-auto rounded-t-2xl border border-transparent p-5 shadow-[var(--neu-shadow-raised)] md:rounded-2xl ${sizeClasses[size]}`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button onClick={onClose} variant="ghost" size="sm">
            Cerrar
          </Button>
        </div>
        {children}
      </Card>
    </div>
  );
};

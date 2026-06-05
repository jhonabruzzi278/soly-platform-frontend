import { ReactNode } from "react";

type WorkspaceHeaderProps = {
  title: string;
  description: string;
  actions?: ReactNode;
  eyebrow?: string;
};

export const WorkspaceHeader = ({ title, description, actions, eyebrow }: WorkspaceHeaderProps) => (
  <section className="px-1 py-1 sm:px-0">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted-foreground)]">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">{description}</p>
      </div>

      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  </section>
);

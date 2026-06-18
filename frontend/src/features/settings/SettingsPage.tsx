import * as Sentry from "@sentry/react";
import { useState } from "react";
import { useTenant } from "../../hooks/useTenant";
import { SurfaceMessage } from "../../components/common/SurfaceMessage";
import { WorkspaceHeader } from "../../components/common/WorkspaceHeader";
import { BrandingSection } from "./BrandingSection";
import { PasswordSection } from "./PasswordSection";
import { TeamSection } from "./TeamSection";
import { PlanSection } from "./PlanSection";
import { AiSection } from "./AiSection";

export const SettingsPage = () => {
  const { isAdmin } = useTenant();
  const [feedback, setFeedback] = useState<{
    tone: "default" | "danger";
    title: string;
    description: string;
  } | null>(null);

  return (
    <div className="space-y-4">
      <WorkspaceHeader
        eyebrow="Configuracion"
        title="Negocio y branding"
        description="Personaliza la apariencia de la plataforma."
      />

      {feedback ? (
        <div role="alert" aria-live="polite">
          <SurfaceMessage tone={feedback.tone} title={feedback.title} description={feedback.description} />
        </div>
      ) : null}

      <section className="grid gap-4">
        <BrandingSection onFeedback={setFeedback} />
        <PasswordSection onFeedback={setFeedback} />
        {isAdmin && <TeamSection onFeedback={setFeedback} />}
        {isAdmin && <AiSection onFeedback={setFeedback} />}
        <PlanSection />
        {isAdmin && import.meta.env.VITE_SENTRY_DSN && (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-4">
            <p className="mb-3 text-xs font-medium text-[var(--muted-foreground)]">Diagnósticos · Solo admins</p>
            <button
              type="button"
              onClick={() => Sentry.captureException(new Error("Sentry test desde Soly Settings"))}
              className="rounded-lg bg-[var(--destructive)]/10 px-4 py-2 text-sm font-medium text-[var(--destructive)] transition-colors hover:bg-[var(--destructive)]/20"
            >
              Enviar error de prueba a Sentry
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

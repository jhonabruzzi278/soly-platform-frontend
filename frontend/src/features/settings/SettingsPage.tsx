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
      </section>
    </div>
  );
};

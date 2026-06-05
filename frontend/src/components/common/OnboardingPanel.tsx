import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MaterialIcon } from "./MaterialIcon";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";

const STORAGE_KEY = "soly-onboarding-dismissed";

const steps = [
  {
    title: "Sincroniza y verifica agenda",
    description: "Trae el rango correcto desde Setmore y confirma que las citas visibles coincidan con el período de trabajo.",
    to: "/citas",
    cta: "Revisar citas",
    icon: "calendar_month"
  },
  {
    title: "Valida clientes reales",
    description: "Comprueba nombres, teléfonos, duplicados y visitas recientes antes de trabajar ingresos o campañas.",
    to: "/clientes",
    cta: "Abrir clientes",
    icon: "groups_3"
  },
  {
    title: "Configura marca y accesos",
    description: "Ajusta nombre del negocio, imagen de login, roles y usuarios autorizados para el equipo.",
    to: "/configuracion",
    cta: "Ir a configuración",
    icon: "tune"
  }
];

export const OnboardingPanel = () => {
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    const dismissed = window.localStorage.getItem(STORAGE_KEY) === "true";
    setHidden(dismissed);
  }, []);

  if (hidden) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setHidden(false)}
        className="rounded-full"
      >
        <MaterialIcon name="lightbulb" size={16} filled />
        Ver onboarding
      </Button>
    );
  }

  return (
    <Card className="rounded-[1.6rem] border-[var(--border)] bg-[var(--card)]">
      <CardContent className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[var(--muted-foreground)]">
              Onboarding
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">Empieza por lo esencial</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">
              Esta plataforma tiene más módulos de los que necesitas al inicio. Usa esta ruta corta para validar operación, branding y datos antes de entrar a herramientas secundarias.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              window.localStorage.setItem(STORAGE_KEY, "true");
              setHidden(true);
            }}
          >
            Ocultar guía
          </Button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {steps.map((step, index) => (
            <article key={step.title} className="theme-onboarding-step rounded-[1.35rem] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--secondary)] text-[var(--accent-foreground)]">
                  <MaterialIcon name={step.icon} size={18} filled />
                </div>
                <span className="text-xs font-medium text-[var(--muted-foreground)]">0{index + 1}</span>
              </div>

              <h3 className="mt-4 text-base font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{step.description}</p>

              <Link
                to={step.to}
                className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-foreground)] shadow-[0_10px_24px_color-mix(in_srgb,var(--primary)_16%,transparent)] transition-opacity hover:opacity-95"
              >
                {step.cta}
              </Link>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

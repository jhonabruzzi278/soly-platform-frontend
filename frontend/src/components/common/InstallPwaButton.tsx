import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { MaterialIcon } from "./MaterialIcon";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const isStandaloneMode = () =>
  window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

export const InstallPwaButton = () => {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandaloneMode());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return null;
  }

  const installApp = async () => {
    if (!promptEvent) {
      const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
      const helpMessage = isIos
        ? "Para instalar la app en iPhone o iPad, abre Compartir y luego toca 'Agregar a pantalla de inicio'."
        : "Si tu navegador no muestra la instalación automática, abre el menú principal y elige 'Instalar app' o 'Agregar a pantalla de inicio'.";

      window.alert(helpMessage);
      return;
    }

    setInstalling(true);

    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;

      if (choice.outcome === "accepted") {
        setPromptEvent(null);
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={installApp}
      disabled={installing}
      variant="outline"
      size="sm"
      title={promptEvent ? "Instalar la app como PWA" : "Ver cómo instalar la app en este navegador"}
    >
      <MaterialIcon name="download_for_offline" size={18} filled />
      {installing ? "Instalando..." : promptEvent ? "Instalar app" : "Cómo instalar"}
    </Button>
  );
};

import * as Sentry from "@sentry/react";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";
import { App } from "./app/App";
import { AuthProvider } from "./app/auth";
import { ThemeProvider } from "./app/ThemeProvider";
import { WorkspaceProvider } from "./app/WorkspaceProvider";
import { TenantProvider } from "./contexts/TenantContext";
import "./index.css";

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request?.data) delete event.request.data;
      return event;
    },
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false }
  }
});

registerSW({ immediate: true, onRegisteredSW() { console.log("SW registrado"); } });

function CrashFallback() {
  return (
    <div className="theme-shell grid min-h-screen place-items-center">
      <div className="text-center space-y-3">
        <p className="text-lg font-medium text-[var(--foreground)]">Algo salió mal</p>
        <p className="text-sm text-[var(--muted-foreground)]">El error fue reportado automáticamente.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
        >
          Recargar página
        </button>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <Sentry.ErrorBoundary fallback={<CrashFallback />}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TenantProvider>
              <WorkspaceProvider>
                <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                  <App />
                </BrowserRouter>
              </WorkspaceProvider>
            </TenantProvider>
          </AuthProvider>
        </QueryClientProvider>
      </Sentry.ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
);

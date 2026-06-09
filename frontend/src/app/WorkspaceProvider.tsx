import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTenant } from "../contexts/TenantContext";
import { updateTenant } from "../lib/api";
import { WorkspaceSettings } from "../lib/types";

type WorkspaceContextValue = {
  settings: WorkspaceSettings;
  loading: boolean;
  updateSettings: (payload: Partial<WorkspaceSettings>) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const defaultSettings: WorkspaceSettings = {
  business_name: "Soly",
  business_subtitle: "Gestion inteligente, simplificada",
  business_logo_url: null,
  login_image_url: null,
  support_email: null
};

const tenantToSettings = (t: { business_name?: string | null; business_subtitle?: string | null } | null): WorkspaceSettings => ({
  business_name: t?.business_name || defaultSettings.business_name,
  business_subtitle: t?.business_subtitle ?? defaultSettings.business_subtitle,
  business_logo_url: null,
  login_image_url: null,
  support_email: null
});

export const WorkspaceProvider = ({ children }: { children: ReactNode }) => {
  const { tenant, refetch: refetchTenant } = useTenant();
  const [settings, setSettings] = useState<WorkspaceSettings>(tenantToSettings(tenant));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSettings(tenantToSettings(tenant));
    setLoading(false);
  }, [tenant]);

  useEffect(() => {
    const title = settings.business_subtitle
      ? `${settings.business_name} ${settings.business_subtitle}`
      : settings.business_name;
    document.title = title;
  }, [settings.business_name, settings.business_subtitle]);

  const updateSettings = useCallback(async (payload: Partial<WorkspaceSettings>) => {
    if (!tenant) return;
    const dbPayload: Record<string, string | null> = {};
    if (payload.business_name !== undefined) dbPayload.business_name = payload.business_name;
    if (payload.business_subtitle !== undefined) dbPayload.business_subtitle = payload.business_subtitle ?? null;
    if (Object.keys(dbPayload).length === 0) return;
    await updateTenant(tenant.id, dbPayload);
    await refetchTenant();
  }, [tenant, refetchTenant]);

  const value = useMemo(() => ({ settings, loading, updateSettings }), [settings, loading, updateSettings]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace debe usarse dentro de WorkspaceProvider.");
  return context;
};

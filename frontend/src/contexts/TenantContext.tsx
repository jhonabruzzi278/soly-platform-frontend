import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Tenant, Membership } from "../lib/types";
import { useAuth } from "../hooks/useAuth";

type TenantContextValue = {
  tenant: Tenant | null;
  membership: Membership | null;
  loading: boolean;
  refetch: () => Promise<void>;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export const TenantProvider = ({ children }: { children: ReactNode }) => {
  const { session, loading: authLoading } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = async () => {
    if (!session?.user) {
      setTenant(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    try {
      const { data: row, error } = await supabase
        .from("memberships")
        .select("tenant_id, user_id, role, created_at")
        .eq("user_id", session.user.id)
        .limit(1)
        .maybeSingle();

      console.log("[TenantContext] memberships query:", { row, error: error?.message });

      if (error || !row) {
        setTenant(null);
        setMembership(null);
        setLoading(false);
        return;
      }

      const { data: tenantData, error: tenantError } = await supabase
        .from("tenants")
        .select("*")
        .eq("id", row.tenant_id)
        .single();

      console.log("[TenantContext] tenants query:", { tenantData, error: tenantError?.message });

      if (tenantError || !tenantData) {
        setTenant(null);
        setMembership(null);
      } else {
        setMembership({
          tenant_id: row.tenant_id,
          user_id: row.user_id,
          role: row.role,
          created_at: row.created_at,
          tenant: tenantData
        });
        setTenant(tenantData);
      }
    } catch (err) {
      console.error("[TenantContext] error:", err);
      setTenant(null);
      setMembership(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      void fetchTenant();
    }
  }, [authLoading, session?.user?.id]);

  const refetch = async () => {
    await fetchTenant();
  };

  return (
    <TenantContext.Provider value={{ tenant, membership, loading, refetch }}>
      {children}
    </TenantContext.Provider>
  );
};

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error("useTenant must be used within TenantProvider");
  return context;
};

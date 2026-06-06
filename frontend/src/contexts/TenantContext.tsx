import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Tenant, Membership } from "../lib/types";
import { useAuth } from "../app/auth";

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
    if (!session?.userId) {
      setTenant(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    try {
      console.log("[Tenant] fetching for userId:", session.userId);
      const { data: row, error } = await supabase
        .from("memberships")
        .select("tenant_id, user_id, role, created_at")
        .eq("user_id", session.userId)
        .limit(1)
        .maybeSingle();

      console.log("[Tenant] memberships result:", { hasRow: !!row, error: error?.message });

      if (error || !row) {
        setTenant(null);
        setMembership(null);
      } else {
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", row.tenant_id)
          .single();

        if (tenantError || !tenantData) {
          setTenant(null);
          setMembership(null);
        } else {
          setMembership({ tenant_id: row.tenant_id, user_id: row.user_id, role: row.role, created_at: row.created_at, tenant: tenantData });
          setTenant(tenantData);
        }
      }
    } catch {
      setTenant(null);
      setMembership(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) { void fetchTenant(); }
  }, [authLoading, session?.userId]);

  const refetch = async () => { await fetchTenant(); };

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

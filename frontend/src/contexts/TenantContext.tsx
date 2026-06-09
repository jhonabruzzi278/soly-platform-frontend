import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
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

  const sessionUserId = session?.userId;
  const cancelRef = useRef(false);

  const fetchTenant = useCallback(async () => {
    if (!sessionUserId) {
      setTenant(null);
      setMembership(null);
      setLoading(false);
      return;
    }

    cancelRef.current = false;

    try {
      const { data: row, error } = await supabase
        .from("memberships")
        .select("tenant_id, user_id, role, created_at")
        .eq("user_id", sessionUserId)
        .limit(1)
        .maybeSingle();

      if (cancelRef.current) return;

      if (error || !row) {
        setTenant(null);
        setMembership(null);
      } else {
        const { data: tenantData, error: tenantError } = await supabase
          .from("tenants")
          .select("*")
          .eq("id", row.tenant_id)
          .single();

        if (cancelRef.current) return;

        if (tenantError || !tenantData) {
          setTenant(null);
          setMembership(null);
        } else {
          setMembership({ tenant_id: row.tenant_id, user_id: row.user_id, role: row.role, created_at: row.created_at, tenant: tenantData });
          setTenant(tenantData);
        }
      }
    } catch {
      if (!cancelRef.current) {
        setTenant(null);
        setMembership(null);
      }
    } finally {
      if (!cancelRef.current) setLoading(false);
    }
  }, [sessionUserId]);

  useEffect(() => {
    if (!authLoading) { void fetchTenant(); }
    return () => { cancelRef.current = true; };
  }, [authLoading, fetchTenant]);

  const refetch = fetchTenant;

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

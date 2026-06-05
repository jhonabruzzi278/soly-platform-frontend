import { useTenant as useTenantContext } from "../contexts/TenantContext";

export const useTenant = () => {
  const { tenant, membership, refetch, loading } = useTenantContext();

  const isAdmin = membership?.role === "owner" || membership?.role === "admin";

  return {
    tenant,
    membership,
    isAdmin,
    refetch,
    loading
  };
};

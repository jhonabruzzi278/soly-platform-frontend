import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer } from "../lib/api";
import { Customer } from "../lib/types";

export const useCustomers = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();

  const customersQuery = useQuery({
    queryKey: ["customers", tenantId],
    queryFn: () => fetchCustomers(tenantId!),
    enabled: !!tenantId,
    staleTime: 30_000,
    retry: 2
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<Customer>) => createCustomer(tenantId!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers", tenantId] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Customer> }) => updateCustomer(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers", tenantId] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["customers", tenantId] });
    }
  });

  return {
    customers: customersQuery.data ?? [],
    isLoading: customersQuery.isLoading,
    error: customersQuery.error,
    refetch: customersQuery.refetch,
    createCustomer: createMutation.mutateAsync,
    updateCustomer: updateMutation.mutateAsync,
    deleteCustomer: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
};

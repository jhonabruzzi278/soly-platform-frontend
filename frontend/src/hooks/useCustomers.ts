import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchCustomersPaginated, createCustomer, updateCustomer, deleteCustomer } from "../lib/api";
import { Customer } from "../lib/types";

const PAGE_SIZE = 50;

export const useCustomers = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();

  const customersQuery = useInfiniteQuery({
    queryKey: ["customers", tenantId],
    queryFn: ({ pageParam }) => fetchCustomersPaginated(tenantId!, pageParam, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
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

  const allCustomers = customersQuery.data?.pages.flatMap(page => page.data) ?? [];
  const lastPage = customersQuery.data?.pages[customersQuery.data.pages.length - 1];
  const hasMore = lastPage?.has_more ?? false;

  return {
    customers: allCustomers,
    isLoading: customersQuery.isLoading,
    error: customersQuery.error,
    refetch: customersQuery.refetch,
    fetchNextPage: customersQuery.fetchNextPage,
    hasNextPage: hasMore,
    isFetchingNextPage: customersQuery.isFetchingNextPage,
    createCustomer: createMutation.mutateAsync,
    updateCustomer: updateMutation.mutateAsync,
    deleteCustomer: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending
  };
};

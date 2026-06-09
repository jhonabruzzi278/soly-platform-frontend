import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAppointmentsPaginated, createAppointment, updateAppointment } from "../lib/api";
import { AppointmentEnriched } from "../lib/types";

const PAGE_SIZE = 50;

export const useAppointments = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();

  const appointmentsQuery = useInfiniteQuery({
    queryKey: ["appointments", tenantId],
    queryFn: ({ pageParam }) => fetchAppointmentsPaginated(tenantId!, pageParam, PAGE_SIZE),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    enabled: !!tenantId,
    staleTime: 30_000,
    retry: 2
  });

  const createMutation = useMutation({
    mutationFn: (payload: Partial<AppointmentEnriched>) => createAppointment(tenantId!, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments", tenantId] });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AppointmentEnriched> }) =>
      updateAppointment(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["appointments", tenantId] });
    }
  });

  const allAppointments = appointmentsQuery.data?.pages.flatMap(page => page.data) ?? [];
  const lastPage = appointmentsQuery.data?.pages[appointmentsQuery.data.pages.length - 1];
  const hasMore = lastPage?.has_more ?? false;

  return {
    appointments: allAppointments,
    isLoading: appointmentsQuery.isLoading,
    error: appointmentsQuery.error,
    refetch: appointmentsQuery.refetch,
    fetchNextPage: appointmentsQuery.fetchNextPage,
    hasNextPage: hasMore,
    isFetchingNextPage: appointmentsQuery.isFetchingNextPage,
    createAppointment: createMutation.mutateAsync,
    updateAppointment: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending
  };
};

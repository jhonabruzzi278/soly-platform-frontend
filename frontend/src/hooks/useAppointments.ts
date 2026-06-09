import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchAppointments, createAppointment, updateAppointment } from "../lib/api";
import { AppointmentEnriched } from "../lib/types";

export const useAppointments = (tenantId: string | undefined) => {
  const queryClient = useQueryClient();

  const appointmentsQuery = useQuery({
    queryKey: ["appointments", tenantId],
    queryFn: () => fetchAppointments(tenantId!),
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

  return {
    appointments: appointmentsQuery.data ?? [],
    isLoading: appointmentsQuery.isLoading,
    error: appointmentsQuery.error,
    refetch: appointmentsQuery.refetch,
    createAppointment: createMutation.mutateAsync,
    updateAppointment: updateMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending
  };
};

import { useQuery } from "@tanstack/react-query";
import { fetchRevenueByBarber, fetchRevenueByService, fetchAppointmentsPerDay } from "../lib/api";

export const useReports = () => {
  const revenueByBarber = useQuery({
    queryKey: ["reports", "revenue-by-barber"],
    queryFn: fetchRevenueByBarber,
    staleTime: 60_000,
    retry: 2
  });

  const revenueByService = useQuery({
    queryKey: ["reports", "revenue-by-service"],
    queryFn: fetchRevenueByService,
    staleTime: 60_000,
    retry: 2
  });

  const appointmentsPerDay = useQuery({
    queryKey: ["reports", "appointments-per-day"],
    queryFn: fetchAppointmentsPerDay,
    staleTime: 60_000,
    retry: 2
  });

  return {
    revenueByBarber: revenueByBarber.data ?? [],
    revenueByService: revenueByService.data ?? [],
    appointmentsPerDay: appointmentsPerDay.data ?? [],
    isLoading: revenueByBarber.isLoading || revenueByService.isLoading || appointmentsPerDay.isLoading,
    error: revenueByBarber.error || revenueByService.error || appointmentsPerDay.error,
    refetchAll: () => {
      void revenueByBarber.refetch();
      void revenueByService.refetch();
      void appointmentsPerDay.refetch();
    }
  };
};

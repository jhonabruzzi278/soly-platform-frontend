import { useQuery } from "@tanstack/react-query";
import { fetchDashboardKpis } from "../lib/api";

export const useDashboardKpis = () => {
  return useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: fetchDashboardKpis,
    staleTime: 30_000
  });
};

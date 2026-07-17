import { useApi } from "./useApi";
import { dashboardService } from "../services";
import type { DashboardData } from "../types";

export function useDashboard() {
  const { data, loading, error, refetch } = useApi<DashboardData>(
    () => dashboardService.getData(),
    [],
    { cacheKey: "/api/dashboard", ttl: 60_000 }
  );

  return { dashboard: data, loading, error, refetch };
}

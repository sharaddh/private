import { useApi } from "./useApi";
import { settingsService } from "../services";
import type { ShopSettings } from "../types";

export function useSettings() {
  const { data, loading, error, refetch } = useApi<ShopSettings>(
    () => settingsService.get(),
    [],
    { cacheKey: "/api/settings" }
  );

  return { settings: data, loading, error, refetch };
}

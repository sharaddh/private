import { useCallback, useEffect, useState } from 'react';
import api from '../api';

export interface CustomerSuggestionData {
  names: string[];
  cities: string[];
}

const CACHE_MS = 60 * 1000;

let cache: { data: CustomerSuggestionData; at: number } | null = null;
let inflight: Promise<CustomerSuggestionData> | null = null;

function normalize(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function dedupeCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function cleanSuggestionData(data: Partial<CustomerSuggestionData> | null | undefined) {
  const names = dedupeCaseInsensitive(
    (Array.isArray(data?.names) ? data.names : []).map(normalize).filter(Boolean)
  );
  const cities = dedupeCaseInsensitive(
    (Array.isArray(data?.cities) ? data.cities : []).map(normalize).filter(Boolean)
  );
  return { names, cities };
}

async function loadSuggestionData(force = false): Promise<CustomerSuggestionData> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.data;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await api.get<CustomerSuggestionData>('/api/customers/suggestions');
      const data = cleanSuggestionData(res.data);
      cache = { data, at: Date.now() };
      return data;
    } catch {
      return cache?.data ?? { names: [], cities: [] };
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function invalidateCustomerSuggestions() {
  cache = null;
}

function freshCache() {
  return cache && Date.now() - cache.at < CACHE_MS ? cache : null;
}

export function useCustomerFieldSuggestions(field: 'name' | 'city', enabled = true) {
  const [options, setOptions] = useState<string[]>(() => {
    const available = freshCache();
    if (!available) return [];
    return field === 'name' ? available.data.names : available.data.cities;
  });
  const [loaded, setLoaded] = useState(() => !!freshCache());

  useEffect(() => {
    if (!enabled || loaded) return;
    let active = true;
    void loadSuggestionData().then((data) => {
      if (!active) return;
      setOptions(field === 'name' ? data.names : data.cities);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [enabled, field, loaded]);

  const reload = useCallback(async () => {
    const data = await loadSuggestionData(true);
    setOptions(field === 'name' ? data.names : data.cities);
    setLoaded(true);
  }, [field]);

  return { options, loading: enabled && !loaded, reload };
}

type Listener = (coating: string | null) => void;

let current: string | null = null;
const listeners = new Set<Listener>();

export function getHeaderCoating(): string | null {
  return current;
}

export function setHeaderCoating(coating: string | null) {
  if (coating === current) return;
  current = coating;
  listeners.forEach((l) => l(coating));
}

export function subscribeHeaderCoating(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
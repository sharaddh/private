export type WhatsAppWorkerWakeReason =
  | "startup"
  | "fallback"
  | "wake:event"
  | "wake:campaign"
  | "wake:webhook"
  | "drain"
  | "backoff"
  | "retention";

type WakeListener = (reason: WhatsAppWorkerWakeReason) => void;

const listeners = new Set<WakeListener>();

export function onWhatsAppWorkerWake(listener: WakeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestWhatsAppWorkerTick(reason: WhatsAppWorkerWakeReason): void {
  for (const listener of listeners) {
    try {
      listener(reason);
    } catch {
      /* a bad listener must not break the request path */
    }
  }
}

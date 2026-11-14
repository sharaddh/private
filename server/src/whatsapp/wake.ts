type WakeListener = () => void;

const listeners = new Set<WakeListener>();

export function onWhatsAppWorkerWake(listener: WakeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ask the in-process WhatsApp worker to run a tick soon. Used after a row is
 * enqueued (event, campaign start/resume, webhook) so polling is not needed to
 * make progress. Safe to call when no inline worker is running.
 */
export function requestWhatsAppWorkerTick(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      /* a bad listener must not break the request path */
    }
  }
}

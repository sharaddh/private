import { afterEach, describe, expect, it, vi } from "vitest";
import { onWhatsAppWorkerWake, requestWhatsAppWorkerTick } from "./wake";

const unregister = new Set<() => void>();

afterEach(() => {
  for (const dispose of unregister) dispose();
  unregister.clear();
});

describe("whatsapp worker wake", () => {
  it("delivers wake reasons without payloads", () => {
    const listener = vi.fn();
    unregister.add(onWhatsAppWorkerWake(listener));

    requestWhatsAppWorkerTick("wake:event");
    requestWhatsAppWorkerTick("wake:webhook");

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, "wake:event");
    expect(listener).toHaveBeenNthCalledWith(2, "wake:webhook");
    expect(listener.mock.calls.every((call) => call.length === 1)).toBe(true);
  });

  it("stops delivering after a listener is unregistered", () => {
    const listener = vi.fn();
    const dispose = onWhatsAppWorkerWake(listener);
    dispose();

    requestWhatsAppWorkerTick("wake:campaign");

    expect(listener).not.toHaveBeenCalled();
  });
});

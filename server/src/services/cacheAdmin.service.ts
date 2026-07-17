import { isConnected, getClient, cacheFlushAll } from "./cache";

export async function getStatus() {
  const connected = isConnected();
  const client = getClient();
  let keyCount = 0;

  if (connected && client) {
    try {
      const keys = await client.keys("route:*");
      keyCount = keys.length;
    } catch {
      keyCount = 0;
    }
  }

  return {
    connected,
    keyCount,
  };
}

export async function flushCache() {
  const flushed = await cacheFlushAll();
  return { flushed };
}

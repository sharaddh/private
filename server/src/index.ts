import mongoose, { connect, disconnect } from "mongoose";
import { PORT, MONGO_URI, REDIS_URL, NODE_ENV } from "./config";
import app from "./app";
import { initCache, destroyCache } from "./services/cache";

let server: ReturnType<typeof app.listen> | null = null;

// Catch Baileys AES-GCM decryption errors from stale/incompatible auth creds.
// Clear the session and restart WhatsApp so a fresh QR scan can begin.
process.on("uncaughtException", async (err) => {
  const msg = err?.message || "";
  if (msg.includes("Unsupported state") || msg.includes("unable to authenticate data")) {
    console.error("WhatsApp: auth decryption failed, clearing stale session:", msg);
    try {
      if (mongoose.connection.db) {
        await mongoose.connection.db.collection("baileys_auth").deleteOne({ _id: "auth_state" as any });
      }
    } catch {}
    // Restart WhatsApp after a short delay
    setTimeout(() => {
      import("./services/whatsapp").then(({ whatsapp }) => {
        whatsapp.reconnect().catch(() => {});
      });
    }, 2000);
    return;
  }
  console.error("Unhandled exception:", err);
  process.exit(1);
});

async function start() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  try {
    await connect(MONGO_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err);
    process.exit(1);
  }

  if (REDIS_URL) {
    try {
      const redis = initCache(REDIS_URL);
      await redis.connect();
    } catch {
      // Redis is optional
    }
  }

  // Lazy-init WhatsApp: import and init in background after server starts
  setTimeout(() => {
    import("./services/whatsapp").then(({ whatsapp }) => {
      whatsapp.init().catch(() => {});
    });
  }, 1000);

  server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} [${NODE_ENV}]`);
  });
}

async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  server?.close();
  await destroyCache().catch(() => {});
  await disconnect().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

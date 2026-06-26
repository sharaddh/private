import { connect } from "mongoose";
import bcrypt from "bcrypt";
import { PORT, MONGO_URI, REDIS_URL } from "./config";
import app from "./app";
import { initCache } from "./services/cache";
import { whatsapp } from "./services/whatsapp";
import { User } from "./models/user";

async function seedAdmin() {
  const count = await User.countDocuments();
  if (count === 0) {
    const passwordHash = await bcrypt.hash("admin123", 10);
    await User.create({ username: "admin", passwordHash, role: "owner" });
  }
}

async function start() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await connect(MONGO_URI);
  console.log("Connected to MongoDB");

  if (REDIS_URL) {
    try {
      const redis = initCache(REDIS_URL);
      await redis.connect();
      console.log("Connected to Redis");
    } catch (err) {
      console.warn("Redis connection failed — server will continue without cache");
    }
  } else {
    console.log("REDIS_URL not set — running without cache");
  }

  await seedAdmin();

  whatsapp.init().then(() => {
    console.log("WhatsApp service initialized");
  }).catch((err) => {
    console.error("WhatsApp initialization failed:", (err as Error)?.message || err);
    if ((err as Error)?.stack) console.error("Stack:", (err as Error).stack!.split("\n").slice(0, 3).join("\n"));
    console.log("Server will continue without WhatsApp");
  });

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

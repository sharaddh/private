import { connect } from "mongoose";
import { PORT, MONGO_URI } from "./config";
import app from "./app";

async function start() {
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await connect(MONGO_URI);
  console.log("Connected to MongoDB");

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

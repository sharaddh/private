import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();
async function main() {
  const uri = process.env.MONGO_URI || "mongodb://localhost:27017/kmj";
  console.log("Connecting to:", uri);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const users = await db.collection("users").find({}).toArray() as any[];
  console.log("Users found:", users.length);
  users.forEach((u: any) => console.log(" -", u.username, "| role:", JSON.stringify(u.role), "| hasHash:", !!u.passwordHash));
  await mongoose.disconnect();
}
main().catch(e => console.error("Error:", e.message));

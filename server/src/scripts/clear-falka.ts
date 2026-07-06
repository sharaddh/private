import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

async function clearFalka() {
  await mongoose.connect(process.env.MONGO_URI!, { maxPoolSize: 10 });
  const falkaDb = mongoose.connection.useDb("kmj_falke_bajar");
  const collections = ["customers","visits","prescriptions","orders","bills","payments","inventory","deliveries","settings","todos"];
  for (const c of collections) {
    try {
      await falkaDb.collection(c).drop();
      console.log(`Dropped ${c}`);
    } catch (e: any) {
      console.log(`Skip ${c}: ${e.message}`);
    }
  }
  await mongoose.disconnect();
}
clearFalka().catch(console.error);

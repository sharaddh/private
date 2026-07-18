import { Schema, model } from "mongoose";

const CameraSchemaObj = new Schema(
  {
    name: { type: String, required: true },
    serialNumber: { type: String, required: true, unique: true },
    username: { type: String, default: "admin" },
    password: { type: String, default: "" },
    streamPath: { type: String },
    status: { type: String, enum: ["connecting", "online", "offline", "error"], default: "connecting" },
    lastError: { type: String },
  },
  { timestamps: true }
);

export const Camera = model("Camera", CameraSchemaObj);

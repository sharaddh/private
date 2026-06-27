import { Schema, model } from "mongoose";

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    name: { type: String, default: "" },
    mobile: { type: String, default: "" },
    role: { type: String, enum: ["owner", "staff"], default: "owner" }
  },
  { timestamps: true }
);

export const User = model("User", UserSchema);

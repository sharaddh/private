import { Schema, model } from "mongoose";

const MessageSchema = new Schema(
  {
    branchId: { type: String, required: true, index: true },
    phone: { type: String, required: true, index: true },
    direction: { type: String, enum: ["outbound", "inbound"], required: true },
    type: { type: String, enum: ["text", "document", "image", "template"], required: true },
    content: { type: String, default: "" },
    filename: { type: String, default: "" },
    mimetype: { type: String, default: "" },
    metaMessageId: { type: String, default: "", index: true },
    status: { type: String, enum: ["pending", "sent", "delivered", "read", "failed"], default: "pending" },
    error: { type: String, default: "" },
  },
  { timestamps: true }
);

MessageSchema.index({ branchId: 1, createdAt: -1 });
MessageSchema.index({ metaMessageId: 1 }, { sparse: true });

export const Message = model("Message", MessageSchema);

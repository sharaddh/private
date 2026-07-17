import { z } from "zod";
import { VALID_CLASSIFICATIONS, VALID_PAYMENT_MODES } from "../types";

export const createOrderSchema = z.object({
  customerId: z.string().min(1),
  visitId: z.string().optional(),
  frame: z.string().optional(),
  frameBrand: z.string().optional(),
  frameModel: z.string().optional(),
  frameColor: z.string().optional(),
  frameSize: z.string().optional(),
  framePrice: z.number().min(0).optional(),
  lens: z.string().optional(),
  lensBrand: z.string().optional(),
  lensType: z.string().optional(),
  lensIndex: z.string().optional(),
  lensPrice: z.number().min(0).optional(),
  coating: z.string().optional(),
  coatingPrice: z.number().min(0).optional(),
  accessories: z.array(z.string()).optional(),
  quantity: z.number().int().min(1).optional(),
  deliveryDate: z.string().optional(),
  status: z.string().optional(),
});

export const updateOrderSchema = z.object({
  customerId: z.string().optional(),
  visitId: z.string().optional(),
  frame: z.string().optional(),
  frameBrand: z.string().optional(),
  frameModel: z.string().optional(),
  frameColor: z.string().optional(),
  frameSize: z.string().optional(),
  framePrice: z.number().min(0).optional(),
  lens: z.string().optional(),
  lensBrand: z.string().optional(),
  lensType: z.string().optional(),
  lensIndex: z.string().optional(),
  lensPrice: z.number().min(0).optional(),
  coating: z.string().optional(),
  coatingPrice: z.number().min(0).optional(),
  accessories: z.array(z.string()).optional(),
  quantity: z.number().int().min(1).optional(),
  deliveryDate: z.string().optional(),
  status: z.string().optional(),
  classification: z.enum(VALID_CLASSIFICATIONS).optional(),
  rightLensStatus: z.enum(VALID_CLASSIFICATIONS).optional(),
  leftLensStatus: z.enum(VALID_CLASSIFICATIONS).optional(),
  reviewed: z.boolean().optional(),
  forwardedCount: z.number().int().min(0).optional(),
});

export const statusUpdateSchema = z.object({
  status: z.string().min(1),
  collectPayment: z.number().min(0).optional(),
  paymentMode: z.enum(VALID_PAYMENT_MODES).optional(),
  advanceQuantity: z.number().int().min(0).optional(),
});

export const classifyOrderSchema = z.object({
  classification: z.enum(VALID_CLASSIFICATIONS),
});

export const classifyEyeSchema = z.object({
  eye: z.enum(["right", "left"]),
  status: z.enum(VALID_CLASSIFICATIONS),
});

export const demandSendSchema = z.object({
  type: z.enum(["buy", "order"]),
  orderIds: z.array(z.string()).optional(),
});

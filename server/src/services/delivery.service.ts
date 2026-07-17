import { Delivery } from "../models/delivery";
import { AppError } from "../middleware/errorHandler";

export async function listDeliveries(status?: string) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  return Delivery.find(filter)
    .populate("customerId", "name mobile")
    .populate("orderId", "frame lens status")
    .sort({ expectedDeliveryDate: -1 })
    .limit(200)
    .lean();
}

export async function getDeliveryById(id: string) {
  const delivery = await Delivery.findById(id)
    .populate("customerId", "name mobile email address")
    .populate("orderId", "frame frameBrand frameModel frameColor lens lensType lensBrand status")
    .lean();
  if (!delivery) throw new AppError(404, "Delivery not found");
  return delivery;
}

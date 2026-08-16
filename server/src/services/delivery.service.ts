import { Delivery } from "../models/delivery";
import { AppError } from "../middleware/errorHandler";

export async function listDeliveries(status?: string, limit = 100) {
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  return Delivery.findMany({
    where,
    include: {
      customer: { select: { id: true, name: true, mobile: true } },
      order: { select: { id: true, frame: true, lens: true, status: true } },
    },
    orderBy: { expectedDeliveryDate: "desc" },
    take: Math.min(limit, 200),
  });
}

export async function getDeliveryById(id: string) {
  const delivery = await Delivery.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, name: true, mobile: true, email: true, address: true } },
      order: {
        select: {
          id: true, frame: true, frameBrand: true, frameModel: true, frameColor: true,
          lens: true, lensType: true, lensBrand: true, status: true,
        },
      },
    },
  });
  if (!delivery) throw new AppError(404, "Delivery not found");
  return delivery;
}

import { Request, Response } from "express";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Prescription } from "../models/prescription";
import { Payment } from "../models/payment";
import { Delivery } from "../models/delivery";
import { success, created, notFound } from "../utils/response";
import { AppError } from "../middleware/errorHandler";

export async function getAll(req: Request, res: Response) {
  const { phone, search, page = "1", limit = "1000" } = req.query;
  const filter: any = {};
  if (phone) filter.mobile = { $regex: phone as string, $options: "i" };
  if (search) {
    const s = search as string;
    filter.$or = [
      { name: { $regex: s, $options: "i" } },
      { mobile: { $regex: s, $options: "i" } },
    ];
  }
  const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
  const [data, total] = await Promise.all([
    Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit as string)).lean(),
    Customer.countDocuments(filter),
  ]);
  return success(res, { data, total, page: parseInt(page as string), pages: Math.ceil(total / parseInt(limit as string)) });
}

export async function getById(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  return success(res, customer);
}

export async function create(req: Request, res: Response) {
  const { name, mobile } = req.body;
  if (!name?.trim()) throw new AppError(400, "Name is required");
  if (!mobile?.trim()) throw new AppError(400, "Mobile is required");
  const customer = await Customer.create({ ...req.body, mobile: mobile.trim() });
  return created(res, customer);
}

export async function update(req: Request, res: Response) {
  const customer = await Customer.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true }).lean();
  if (!customer) return notFound(res, "Customer not found");
  return success(res, customer);
}

export async function remove(req: Request, res: Response) {
  const customer = await Customer.findByIdAndDelete(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  const customerId = req.params.id;
  await Promise.all([
    Visit.deleteMany({ customerId }),
    Order.deleteMany({ customerId }),
    Bill.deleteMany({ customerId }),
    Prescription.deleteMany({ customerId }),
    Payment.deleteMany({ customerId }),
    Delivery.deleteMany({ customerId }),
  ]);
  return success(res, customer);
}

export async function getSummary(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");
  const [visitCount, orderCount, billTotal] = await Promise.all([
    Visit.countDocuments({ customerId: req.params.id }),
    Order.countDocuments({ customerId: req.params.id }),
    Bill.aggregate([
      { $match: { customerId: req.params.id } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);
  return success(res, {
    ...customer,
    visitCount,
    orderCount,
    totalBilled: billTotal[0]?.total || 0,
  });
}

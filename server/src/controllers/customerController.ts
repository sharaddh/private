import { Request, Response } from "express";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Prescription } from "../models/prescription";
import { Order } from "../models/order";
import { Bill } from "../models/bill";
import { Payment } from "../models/payment";
import { success, created, notFound } from "../utils/response";
import { AppError } from "../middleware/errorHandler";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getAll(req: Request, res: Response) {
  const q = (req.query.q as string) || "";
  const phone = req.query.phone as string;
  if (phone) {
    const customers = await Customer.find({ mobile: { $regex: escapeRegex(phone), $options: "i" } }).lean();
    return success(res, customers);
  }
  const filter = q
    ? { $or: [{ name: { $regex: escapeRegex(q), $options: "i" } }, { mobile: { $regex: escapeRegex(q), $options: "i" } }, { customerId: { $regex: escapeRegex(q), $options: "i" } }] }
    : {};
  const customers = await Customer.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return success(res, customers);
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
  const customer = await Customer.create(req.body);
  return created(res, customer);
}

export async function update(req: Request, res: Response) {
  const customer = await Customer.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true }).lean();
  if (!customer) return notFound(res, "Customer not found");
  return success(res, customer);
}

export async function remove(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");

  await Promise.all([
    Customer.findByIdAndDelete(req.params.id),
    Visit.deleteMany({ customerId: req.params.id }),
    Order.deleteMany({ customerId: req.params.id }),
    Bill.deleteMany({ customerId: req.params.id }),
    Prescription.deleteMany({ customerId: req.params.id }),
    Payment.deleteMany({ customerId: req.params.id }),
  ]);

  return success(res, customer, "Deleted successfully");
}

export async function getSummary(req: Request, res: Response) {
  const customer = await Customer.findById(req.params.id).lean();
  if (!customer) return notFound(res, "Customer not found");

  const [visits, prescs, orders] = await Promise.all([
    Visit.find({ customerId: customer._id }).sort({ visitDate: -1 }).limit(5).lean(),
    Prescription.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(1).lean(),
    Order.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(3).lean(),
  ]);

  const lastVisit = visits[0] || null;
  const lastPresc = prescs[0] || null;
  const lastOrder = orders[0] || null;
  const labOrders = orders.filter((o) => o.status === "In Lab" || o.status === "Ordered");
  const readyOrders = orders.filter((o) => o.status === "Ready");

  return success(res, {
    customer,
    lastVisit,
    lastPrescription: lastPresc,
    lastOrder,
    recentOrders: orders,
    labOrders: labOrders.length,
    readyOrders: readyOrders.length,
  });
}

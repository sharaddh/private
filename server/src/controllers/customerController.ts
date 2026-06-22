import { Request, Response, NextFunction } from "express";
import { Customer } from "../models/customer";
import { Visit } from "../models/visit";
import { Prescription } from "../models/prescription";
import { Order } from "../models/order";
import { success, created, notFound } from "../utils/response";
import { AppError } from "../middleware/errorHandler";

export async function getAll(req: Request, res: Response, next: NextFunction) {
  try {
    const q = (req.query.q as string) || "";
    const phone = req.query.phone as string;
    if (phone) {
      const customers = await Customer.find({ mobile: { $regex: phone, $options: "i" } });
      return success(res, customers || []);
    }
    const filter = q ? { $or: [{ name: new RegExp(q, "i") }, { mobile: new RegExp(q, "i") }, { customerId: new RegExp(q, "i") }] } : {};
    const customers = await Customer.find(filter).sort({ createdAt: -1 }).limit(100);
    return success(res, customers);
  } catch (err) {
    next(err);
  }
}

export async function getById(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return notFound(res, "Customer not found");
    return success(res, customer);
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const { name, mobile } = req.body;
    if (!name?.trim()) throw new AppError(400, "Name is required");
    if (!mobile?.trim()) throw new AppError(400, "Mobile is required");
    const customer = await Customer.create(req.body);
    return created(res, customer);
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!customer) return notFound(res, "Customer not found");
    return success(res, customer);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) return notFound(res, "Customer not found");
    return success(res, customer, "Deleted successfully");
  } catch (err) {
    next(err);
  }
}

export async function getSummary(req: Request, res: Response, next: NextFunction) {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return notFound(res, "Customer not found");

    const [visits, prescs, orders] = await Promise.all([
      Visit.find({ customerId: customer._id }).sort({ visitDate: -1 }).limit(5),
      Prescription.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(1),
      Order.find({ customerId: customer._id }).sort({ createdAt: -1 }).limit(3),
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
  } catch (err) {
    next(err);
  }
}

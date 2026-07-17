import { Request, Response } from "express";
import * as prescriptionService from "../services/prescription.service";
import { sendSuccess, sendCreated } from "../utils/response";

export async function list(req: Request, res: Response) {
  const { customerId } = req.query;
  const data = await prescriptionService.listPrescriptions(customerId as string);
  sendSuccess(res, data);
}

export async function getById(req: Request, res: Response) {
  const data = await prescriptionService.getPrescriptionById(req.params.id);
  sendSuccess(res, data);
}

export async function create(req: Request, res: Response) {
  const data = await prescriptionService.createPrescription(req.body);
  sendCreated(res, data);
}

export async function update(req: Request, res: Response) {
  const data = await prescriptionService.updatePrescription(req.params.id, req.body);
  sendSuccess(res, data);
}

export async function remove(req: Request, res: Response) {
  await prescriptionService.deletePrescription(req.params.id);
  sendSuccess(res, null, "Prescription deleted");
}

import { BranchRequest } from "../types";
import { Response } from "express";
import { executeTransaction, sendBillWhatsApp } from "../services/workspace.service";
import { sendSuccess } from "../utils/response";

export async function transaction(req: BranchRequest, res: Response) {
  const data = await executeTransaction(req.body, req.branchId);
  const bill = data.bill as any;
  const customer = data.customer as any;
  if (bill && customer) {
    sendBillWhatsApp(bill, customer, req.branchId);
  }
  sendSuccess(res, data, "Transaction completed");
}

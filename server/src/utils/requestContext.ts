import { AsyncLocalStorage } from "async_hooks";
import type { BranchModels } from "../models/db";

export interface RequestContext {
  branchModels?: BranchModels;
  branchId?: string;
  branchName?: string;
}

export const ctx = new AsyncLocalStorage<RequestContext>();

export function getCtx(): RequestContext | undefined {
  return ctx.getStore();
}

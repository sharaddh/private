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

export function requireCtx(): RequestContext {
  const context = getCtx();
  if (!context) throw new Error("Request context not available - missing branch scope");
  return context;
}

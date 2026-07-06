import { getCtx } from "./requestContext";
import type { BranchModels } from "../models/db";

export function withBranch<T extends Record<string, any>>(defaultModel: T, key: keyof BranchModels): T {
  return new Proxy(defaultModel, {
    get(_target, prop) {
      const branchModels = getCtx()?.branchModels;
      if (branchModels) {
        const branchModel = branchModels[key];
        if (branchModel && typeof prop === "string") {
          const val = (branchModel as any)[prop];
          if (typeof val === "function") return val.bind(branchModel);
          return val;
        }
      }
      const val = (defaultModel as any)[prop];
      if (typeof val === "function") return val.bind(defaultModel);
      return val;
    },
    construct(_target, args) {
      const branchModels = getCtx()?.branchModels;
      if (branchModels) {
        const branchModel = branchModels[key];
        if (branchModel) return new (branchModel as any)(...args);
      }
      return new (defaultModel as any)(...args);
    },
  });
}

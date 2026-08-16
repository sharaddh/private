import { getCtx } from "./requestContext";

export function requireBranchId(): string {
  const store = getCtx();
  if (!store?.branchId) {
    throw new Error("Missing branch scope (x-branch-id header or _branch query)");
  }
  return store.branchId;
}

function scopedWhere(where: any): any {
  const branchId = requireBranchId();
  return { ...(where || {}), branchId };
}

type AnyDelegate = Record<string, any>;

/**
 * Wraps a Prisma delegate so every operation is automatically restricted to the
 * current request's branch (row-level tenancy via branchId). Replaces the old
 * per-branch mongoose connections. Throws if no branch scope is active.
 */
export function scoped<D extends AnyDelegate>(delegate: D): D {
  return new Proxy(delegate, {
    get(target, prop) {
      const name = String(prop);
      const method = (target as any)[prop];
      if (typeof method !== "function") return method;

      switch (name) {
        case "create":
          return (args: any) => {
            const branchId = requireBranchId();
            return method.call(target, { ...args, data: { ...(args?.data || {}), branchId } });
          };
        case "createMany":
          return (args: any) => {
            const branchId = requireBranchId();
            const data = Array.isArray(args?.data)
              ? args.data.map((d: any) => ({ ...d, branchId }))
              : args?.data;
            return method.call(target, { ...args, data });
          };
        case "upsert":
          return (args: any) => {
            const branchId = requireBranchId();
            return method.call(target, {
              ...args,
              create: { ...(args?.create || {}), branchId },
              update: { ...(args?.update || {}) },
            });
          };
        case "findMany":
        case "findFirst":
        case "findFirstOrThrow":
          return (args?: any) =>
            method.call(target, { ...(args || {}), where: scopedWhere(args?.where) });
        case "findUnique":
        case "findUniqueOrThrow":
          return (args: any) => {
            const where = args?.where || {};
            if (name === "findUniqueOrThrow") {
              return target.findFirstOrThrow({
                ...args,
                where: { ...where, branchId: requireBranchId() },
              });
            }
            return target.findFirst({
              ...args,
              where: { ...where, branchId: requireBranchId() },
            });
          };
        case "count":
        case "aggregate":
        case "groupBy":
          return (args?: any) =>
            method.call(target, { ...(args || {}), where: scopedWhere(args?.where) });
        case "updateMany":
        case "deleteMany":
          return (args: any) => method.call(target, { ...args, where: scopedWhere(args?.where) });
        case "update":
          return async (args: any) => {
            const found = await target.findFirst({
              where: { ...(args?.where || {}), branchId: requireBranchId() },
            });
            if (!found) return null;
            return method.call(target, { ...args, where: { id: found.id } });
          };
        case "delete":
          return async (args: any) => {
            const found = await target.findFirst({
              where: { ...(args?.where || {}), branchId: requireBranchId() },
            });
            if (!found) return null;
            return method.call(target, { where: { id: found.id } });
          };
        default:
          return method.bind(target);
      }
    },
  }) as D;
}

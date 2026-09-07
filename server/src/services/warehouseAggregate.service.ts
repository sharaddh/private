import { Prisma, prisma } from "../db/prisma";
import { logger } from "../utils/logger";

type AnyAgg = { branchId: string; branchName: string; branchCode: string; [k: string]: any };

interface BranchInfo {
  id: string;
  name: string;
  code: string;
}

function toMongoDoc(row: any) {
  if (!row) return row;
  const { id, ...rest } = row;
  return { ...rest, _id: id };
}

function withBranch(row: Record<string, any>, branch: BranchInfo, branchId = branch.id): AnyAgg {
  return {
    ...toMongoDoc(row),
    branchId,
    branchName: branch.name,
    branchCode: branch.code,
  };
}

const WAREHOUSE_BRANCH: BranchInfo = { id: "main", name: "Warehouse", code: "WH" };

function inventorySearchWhere(
  query?: { search?: string }
): Prisma.InventoryWhereInput {
  const s = query?.search?.trim();
  if (!s) return {};
  return {
    OR: [
      { sku: { contains: s, mode: "insensitive" } },
      { brand: { contains: s, mode: "insensitive" } },
      { model: { contains: s, mode: "insensitive" } },
      { category: { contains: s, mode: "insensitive" } },
      { supplier: { contains: s, mode: "insensitive" } },
    ],
  };
}

async function getActiveBranches(): Promise<BranchInfo[]> {
  return prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true },
  });
}

export async function getAllBranchInventory(query?: { search?: string }) {
  const branches = await getActiveBranches();
  const allItems: AnyAgg[] = [];

  await Promise.all(
    branches.map(async (branch) => {
      try {
        const items = await prisma.inventory.findMany({
          where: { ...inventorySearchWhere(query), branchId: branch.id },
          orderBy: { createdAt: "desc" },
          take: 500,
        });
        for (const item of items) {
          allItems.push(withBranch(item, branch));
        }
      } catch (err) {
        logger.error(`Failed to fetch inventory from branch ${branch.name}`, {
          error: (err as Error).message,
        });
      }
    })
  );

  try {
    const items = await prisma.warehouseInventory.findMany({
      where: inventorySearchWhere(query) as Prisma.WarehouseInventoryWhereInput,
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    for (const item of items) {
      allItems.push(withBranch(item, WAREHOUSE_BRANCH, "main"));
    }
  } catch (err) {
    logger.error("Failed to fetch inventory from main DB", { error: (err as Error).message });
  }

  allItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return allItems;
}

export async function getAllBranchStats() {
  const branches = await getActiveBranches();

  let totalItems = 0;
  let lowStock = 0;
  let warehouseItems = 0;
  let totalValue = 0;
  let totalLensCoatings = 0;
  let totalLensStock = 0;
  const recentItems: AnyAgg[] = [];
  const lowStockItems: AnyAgg[] = [];

  function calcValue(items: { quantity: number | null; sellingPrice: number | null }[]) {
    return items.reduce(
      (s, i) => s + (i.quantity || 0) * (i.sellingPrice || 0),
      0
    );
  }

  await Promise.all(
    branches.map(async (branch) => {
      try {
        const [count, low, wh, recent, lowItems, allForValue, lensDocs] = await Promise.all([
          prisma.inventory.count({ where: { branchId: branch.id } }),
          prisma.inventory.count({ where: { branchId: branch.id, quantity: { lte: 5 } } }),
          prisma.inventory.count({
            where: { branchId: branch.id, location: "warehouse" },
          }),
          prisma.inventory.findMany({
            where: { branchId: branch.id },
            orderBy: { createdAt: "desc" },
            take: 5,
          }),
          prisma.inventory.findMany({
            where: { branchId: branch.id, quantity: { lte: 5, gt: 0 } },
            orderBy: { quantity: "asc" },
            take: 10,
          }),
          prisma.inventory.findMany({
            where: { branchId: branch.id },
            select: { quantity: true, sellingPrice: true },
          }),
          prisma.lensStock.findMany({ where: { branchId: branch.id } }),
        ]);

        totalItems += count;
        lowStock += low;
        warehouseItems += wh;
        totalValue += calcValue(allForValue);

        for (const item of recent) {
          recentItems.push(withBranch(item, branch));
        }
        for (const item of lowItems) {
          lowStockItems.push(withBranch(item, branch));
        }

        totalLensCoatings += lensDocs.length;
        for (const doc of lensDocs) {
          const q = (doc.quantities as Record<string, Record<string, number>>) || {};
          for (const lensType of Object.keys(q)) {
            for (const v of Object.values(q[lensType])) {
              totalLensStock += v as number;
            }
          }
        }
      } catch (err) {
        logger.error(`Failed to fetch stats from branch ${branch.name}`, {
          error: (err as Error).message,
        });
      }
    })
  );

  try {
    const [mainCount, mainLow, mainWh, mainRecent, mainLowItems, mainAllForValue] =
      await Promise.all([
        prisma.warehouseInventory.count(),
        prisma.warehouseInventory.count({ where: { quantity: { lte: 5 } } }),
        prisma.warehouseInventory.count({ where: { location: "warehouse" } }),
        prisma.warehouseInventory.findMany({ orderBy: { createdAt: "desc" }, take: 5 }),
        prisma.warehouseInventory.findMany({
          where: { quantity: { lte: 5, gt: 0 } },
          orderBy: { quantity: "asc" },
          take: 10,
        }),
        prisma.warehouseInventory.findMany({
          select: { quantity: true, sellingPrice: true },
        }),
      ]);

    totalItems += mainCount;
    lowStock += mainLow;
    warehouseItems += mainWh;
    totalValue += calcValue(mainAllForValue);

    for (const item of mainRecent) {
      recentItems.push(withBranch(item, WAREHOUSE_BRANCH, "main"));
    }
    for (const item of mainLowItems) {
      lowStockItems.push(withBranch(item, WAREHOUSE_BRANCH, "main"));
    }

    const mainLensDocs = await prisma.warehouseLensStock.findMany();
    totalLensCoatings += mainLensDocs.length;
    for (const doc of mainLensDocs) {
      const q = (doc.quantities as Record<string, Record<string, number>>) || {};
      for (const lensType of Object.keys(q)) {
        for (const v of Object.values(q[lensType])) {
          totalLensStock += v as number;
        }
      }
    }
  } catch (err) {
    logger.error("Failed to fetch stats from main DB", { error: (err as Error).message });
  }

  recentItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  lowStockItems.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));

  const [totalUsers, totalWithdrawals, allWithdrawals, recentWithdrawals] = await Promise.all([
    prisma.user.count(),
    prisma.withdrawal.count(),
    prisma.withdrawal.findMany({ select: { totalQuantity: true } }),
    prisma.withdrawal.findMany({ orderBy: { withdrawnAt: "desc" }, take: 10 }),
  ]);
  const totalWithdrawnItems = allWithdrawals.reduce((s, w) => s + (w.totalQuantity || 0), 0);

  return {
    totalItems,
    lowStock,
    warehouseItems,
    totalValue,
    totalLensCoatings,
    totalLensStock,
    totalUsers,
    totalWithdrawals,
    totalWithdrawnItems,
    recentItems: recentItems.slice(0, 5),
    lowStockItems: lowStockItems.slice(0, 10),
    recentWithdrawals: recentWithdrawals.map(toMongoDoc),
  };
}

export async function getAllBranchLensStock() {
  const branches = await getActiveBranches();
  const allItems: AnyAgg[] = [];

  await Promise.all(
    branches.map(async (branch) => {
      try {
        const items = await prisma.lensStock.findMany({
          where: { branchId: branch.id },
          orderBy: { coating: "asc" },
        });
        for (const item of items) {
          allItems.push(withBranch(item, branch));
        }
      } catch (err) {
        logger.error(`Failed to fetch lens stock from branch ${branch.name}`, {
          error: (err as Error).message,
        });
      }
    })
  );

  try {
    const items = await prisma.warehouseLensStock.findMany({ orderBy: { coating: "asc" } });
    for (const item of items) {
      allItems.push(withBranch(item, WAREHOUSE_BRANCH, "main"));
    }
  } catch (err) {
    logger.error("Failed to fetch lens stock from main DB", { error: (err as Error).message });
  }

  allItems.sort((a, b) => a.coating.localeCompare(b.coating));
  return allItems;
}
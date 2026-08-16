import { prisma } from "../db/prisma";
import { getBranchModels, getWarehouseModels } from "../models/db";
import { escapeRegex } from "../utils/string";
import { logger } from "../utils/logger";

const {
  Inventory: WHInventory,
  LensStock: WHLensStock,
  Withdrawal: WHWithdrawal,
} = getWarehouseModels();

interface BranchItem {
  branchId: string;
  branchName: string;
  branchCode: string;
}

type AggregatedInventory = BranchItem & {
  id: string;
  sku: string;
  category: string;
  inventoryType: string;
  brand: string;
  model: string;
  color: string;
  size: string;
  gender: string;
  supplier: string;
  quantity: number;
  location: string;
  purchasePrice: number;
  sellingPrice: number;
  description: string;
  lensIndex?: string;
  lensCoating?: string;
  sphRight?: string;
  cylRight?: string;
  axisRight?: string;
  sphLeft?: string;
  cylLeft?: string;
  axisLeft?: string;
  addPower?: string;
  createdAt: Date;
  updatedAt: Date;
};

type AggregatedLensStock = BranchItem & {
  id: string;
  coating: string;
  quantities: Record<string, Record<string, number>>;
  createdAt: Date;
  updatedAt: Date;
};

interface BranchInfo {
  id: string;
  name: string;
  code: string;
  dbName: string;
}

async function getActiveBranches(): Promise<BranchInfo[]> {
  return prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, code: true, dbName: true },
  }) as Promise<BranchInfo[]>;
}

export async function getAllBranchInventory(query?: { search?: string }) {
  const branches = await getActiveBranches();
  const allItems: AggregatedInventory[] = [];

  const filter: Record<string, unknown> = {};
  if (query?.search) {
    const s = escapeRegex(query.search.trim());
    const searchRegex = { $regex: s, $options: "i" };
    filter.$or = [
      { sku: searchRegex },
      { brand: searchRegex },
      { model: searchRegex },
      { category: searchRegex },
      { supplier: searchRegex },
    ];
  }

  await Promise.all(
    branches.map(async (branch: BranchInfo) => {
      try {
        const models = getBranchModels(branch.dbName);
        const items = await models.Inventory.find(filter).sort({ createdAt: -1 }).limit(500).lean();
        for (const item of items) {
          allItems.push({
            ...item,
            branchId: branch.id,
            branchName: branch.name,
            branchCode: branch.code,
          } as AggregatedInventory);
        }
      } catch (err) {
        logger.error(`Failed to fetch inventory from branch ${branch.name}`, {
          error: (err as Error).message,
        });
      }
    })
  );

  try {
    const mainItems = await WHInventory.find(filter).sort({ createdAt: -1 }).limit(500).lean();
    for (const item of mainItems) {
      allItems.push({
        ...(item as unknown as AggregatedInventory),
        branchId: "main",
        branchName: "Warehouse",
        branchCode: "WH",
      });
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
  const recentItems: AggregatedInventory[] = [];
  const lowStockItems: AggregatedInventory[] = [];

  await Promise.all(
    branches.map(async (branch: BranchInfo) => {
      try {
        const models = getBranchModels(branch.dbName);
        const [count, low, wh, recent, lowItems, allForValue] = await Promise.all([
          models.Inventory.countDocuments(),
          models.Inventory.countDocuments({ quantity: { $lte: 5 } }),
          models.Inventory.countDocuments({ location: "warehouse" }),
          models.Inventory.find().sort({ createdAt: -1 }).limit(5).lean(),
          models.Inventory.find({ quantity: { $lte: 5, $gt: 0 } })
            .sort({ quantity: 1 })
            .limit(10)
            .lean(),
          models.Inventory.find({}, { quantity: 1, sellingPrice: 1 }).lean(),
        ]);

        totalItems += count;
        lowStock += low;
        warehouseItems += wh;
        totalValue += allForValue.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.sellingPrice || 0), 0);

        for (const item of recent) {
          recentItems.push({
            ...item,
            branchId: branch.id,
            branchName: branch.name,
            branchCode: branch.code,
          } as AggregatedInventory);
        }
        for (const item of lowItems) {
          lowStockItems.push({
            ...item,
            branchId: branch.id,
            branchName: branch.name,
            branchCode: branch.code,
          } as AggregatedInventory);
        }

        const lensDocs = await models.LensStock.find().lean();
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
    const [mainCount, mainLow, mainWh, mainRecent, mainLowItems, mainAllForValue] = await Promise.all(
      [
        WHInventory.countDocuments(),
        WHInventory.countDocuments({ quantity: { $lte: 5 } }),
        WHInventory.countDocuments({ location: "warehouse" }),
        WHInventory.find().sort({ createdAt: -1 }).limit(5).lean(),
        WHInventory.find({ quantity: { $lte: 5, $gt: 0 } })
          .sort({ quantity: 1 })
          .limit(10)
          .lean(),
        WHInventory.find({}, { quantity: 1, sellingPrice: 1 }).lean(),
      ]
    );

    totalItems += mainCount;
    lowStock += mainLow;
    warehouseItems += mainWh;
    totalValue += mainAllForValue.reduce((s: number, i: any) => s + (i.quantity || 0) * (i.sellingPrice || 0), 0);

    for (const item of mainRecent) {
      recentItems.push({
        ...(item as unknown as AggregatedInventory),
        branchId: "main",
        branchName: "Warehouse",
        branchCode: "WH",
      });
    }
    for (const item of mainLowItems) {
      lowStockItems.push({
        ...(item as unknown as AggregatedInventory),
        branchId: "main",
        branchName: "Warehouse",
        branchCode: "WH",
      });
    }

    const mainLensDocs = await WHLensStock.find().lean();
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

  const [totalUsers, totalWithdrawals, allWithdrawals] = await Promise.all([
    prisma.user.count(),
    WHWithdrawal.countDocuments(),
    WHWithdrawal.find({}, { totalQuantity: 1 }).lean(),
  ]);
  const totalWithdrawnItems = allWithdrawals.reduce((s: number, w: any) => s + (w.totalQuantity || 0), 0);

  const recentWithdrawals = await WHWithdrawal.find().sort({ withdrawnAt: -1 }).limit(10).lean();

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
    recentWithdrawals,
  };
}

export async function getAllBranchLensStock() {
  const branches = await getActiveBranches();
  const allItems: AggregatedLensStock[] = [];

  await Promise.all(
    branches.map(async (branch: BranchInfo) => {
      try {
        const models = getBranchModels(branch.dbName);
        const items = await models.LensStock.find().sort({ coating: 1 }).lean();
        for (const item of items) {
          allItems.push({
            ...item,
            branchId: branch.id,
            branchName: branch.name,
            branchCode: branch.code,
          } as AggregatedLensStock);
        }
      } catch (err) {
        logger.error(`Failed to fetch lens stock from branch ${branch.name}`, {
          error: (err as Error).message,
        });
      }
    })
  );

  try {
    const mainItems = await WHLensStock.find().sort({ coating: 1 }).lean();
    for (const item of mainItems) {
      allItems.push({
        ...(item as unknown as AggregatedLensStock),
        branchId: "main",
        branchName: "Warehouse",
        branchCode: "WH",
      });
    }
  } catch (err) {
    logger.error("Failed to fetch lens stock from main DB", { error: (err as Error).message });
  }

  allItems.sort((a, b) => a.coating.localeCompare(b.coating));
  return allItems;
}

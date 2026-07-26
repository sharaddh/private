import { Branch } from "../models/branch";
import { getBranchModels } from "../models/db";
import { Inventory as MainInventory } from "../models/inventory";
import { LensStock as MainLensStock } from "../models/lensStock";
import { Withdrawal } from "../models/withdrawal";
import { User } from "../models/user";
import { escapeRegex } from "../utils/string";
import { logger } from "../utils/logger";

interface BranchItem {
  branchId: string;
  branchName: string;
  branchCode: string;
}

type AggregatedInventory = BranchItem & {
  _id: string;
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
  _id: string;
  coating: string;
  quantities: Record<string, Record<string, number>>;
  createdAt: Date;
  updatedAt: Date;
};

async function getActiveBranches() {
  return Branch.find({ isActive: true }).select("name code dbName").lean();
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
    branches.map(async (branch) => {
      try {
        const models = getBranchModels(branch.dbName);
        const items = await models.Inventory.find(filter).sort({ createdAt: -1 }).limit(500).lean();
        for (const item of items) {
          allItems.push({
            ...item,
            branchId: String(branch._id),
            branchName: branch.name,
            branchCode: branch.code,
          } as AggregatedInventory);
        }
      } catch (err) {
        logger.error(`Failed to fetch inventory from branch ${branch.name}`, { error: (err as Error).message });
      }
    })
  );

  try {
    const mainItems = await MainInventory.find(filter).sort({ createdAt: -1 }).limit(500).lean();
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
    branches.map(async (branch) => {
      try {
        const models = getBranchModels(branch.dbName);
        const [count, low, wh, valResult, recent, lowItems] = await Promise.all([
          models.Inventory.countDocuments(),
          models.Inventory.countDocuments({ quantity: { $lte: 5 } }),
          models.Inventory.countDocuments({ location: "warehouse" }),
          models.Inventory.aggregate([
            { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } } } },
          ]),
          models.Inventory.find().sort({ createdAt: -1 }).limit(5).lean(),
          models.Inventory.find({ quantity: { $lte: 5, $gt: 0 } }).sort({ quantity: 1 }).limit(10).lean(),
        ]);

        totalItems += count;
        lowStock += low;
        warehouseItems += wh;
        totalValue += valResult[0]?.total || 0;

        for (const item of recent) {
          recentItems.push({
            ...item,
            branchId: String(branch._id),
            branchName: branch.name,
            branchCode: branch.code,
          } as AggregatedInventory);
        }
        for (const item of lowItems) {
          lowStockItems.push({
            ...item,
            branchId: String(branch._id),
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
              totalLensStock += (v as number);
            }
          }
        }
      } catch (err) {
        logger.error(`Failed to fetch stats from branch ${branch.name}`, { error: (err as Error).message });
      }
    })
  );

  try {
    const [mainCount, mainLow, mainWh, mainValResult, mainRecent, mainLowItems] = await Promise.all([
      MainInventory.countDocuments(),
      MainInventory.countDocuments({ quantity: { $lte: 5 } }),
      MainInventory.countDocuments({ location: "warehouse" }),
      MainInventory.aggregate([
        { $group: { _id: null, total: { $sum: { $multiply: ["$quantity", "$sellingPrice"] } } } },
      ]),
      MainInventory.find().sort({ createdAt: -1 }).limit(5).lean(),
      MainInventory.find({ quantity: { $lte: 5, $gt: 0 } }).sort({ quantity: 1 }).limit(10).lean(),
    ]);

    totalItems += mainCount;
    lowStock += mainLow;
    warehouseItems += mainWh;
    totalValue += mainValResult[0]?.total || 0;

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

    const mainLensDocs = await MainLensStock.find().lean();
    totalLensCoatings += mainLensDocs.length;
    for (const doc of mainLensDocs) {
      const q = (doc.quantities as Record<string, Record<string, number>>) || {};
      for (const lensType of Object.keys(q)) {
        for (const v of Object.values(q[lensType])) {
          totalLensStock += (v as number);
        }
      }
    }
  } catch (err) {
    logger.error("Failed to fetch stats from main DB", { error: (err as Error).message });
  }

  recentItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  lowStockItems.sort((a, b) => (a.quantity || 0) - (b.quantity || 0));

  const [totalUsers, totalWithdrawals, withdrawalAgg] = await Promise.all([
    User.countDocuments(),
    Withdrawal.countDocuments(),
    Withdrawal.aggregate([
      { $group: { _id: null, totalItems: { $sum: "$totalQuantity" } } },
    ]),
  ]);

  const recentWithdrawals = await Withdrawal.find()
    .sort({ withdrawnAt: -1 })
    .limit(10)
    .lean();

  return {
    totalItems,
    lowStock,
    warehouseItems,
    totalValue,
    totalLensCoatings,
    totalLensStock,
    totalUsers,
    totalWithdrawals,
    totalWithdrawnItems: withdrawalAgg[0]?.totalItems || 0,
    recentItems: recentItems.slice(0, 5),
    lowStockItems: lowStockItems.slice(0, 10),
    recentWithdrawals,
  };
}

export async function getAllBranchLensStock() {
  const branches = await getActiveBranches();
  const allItems: AggregatedLensStock[] = [];

  await Promise.all(
    branches.map(async (branch) => {
      try {
        const models = getBranchModels(branch.dbName);
        const items = await models.LensStock.find().sort({ coating: 1 }).lean();
        for (const item of items) {
          allItems.push({
            ...item,
            branchId: String(branch._id),
            branchName: branch.name,
            branchCode: branch.code,
          } as AggregatedLensStock);
        }
      } catch (err) {
        logger.error(`Failed to fetch lens stock from branch ${branch.name}`, { error: (err as Error).message });
      }
    })
  );

  try {
    const mainItems = await MainLensStock.find().sort({ coating: 1 }).lean();
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

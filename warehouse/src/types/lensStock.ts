export type LensType = "sph" | "cyl" | "compound";

export interface LensStockItem {
  _id: string;
  coating: string;
  price?: number;
  priceNeg?: number;
  pricePos?: number;
  quantities: Record<LensType, Record<string, number>>;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  createdAt: string;
  updatedAt: string;
}

export function priceForPower(item: { price?: number; priceNeg?: number; pricePos?: number } | null | undefined, powerKey: string): number {
  if (!item) return 0;
  const sph = String(powerKey || "").split("|")[0];
  const isNeg = sph.startsWith("-") && sph !== "-0.00";
  if (isNeg) return item.priceNeg ?? item.price ?? 0;
  return item.pricePos ?? item.price ?? 0;
}

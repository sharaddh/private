export type LensType = "sph" | "cyl" | "compound";

export interface LensStockItem {
  _id: string;
  coating: string;
  price?: number;
  quantities: Record<LensType, Record<string, number>>;
  branchId?: string;
  branchName?: string;
  branchCode?: string;
  createdAt: string;
  updatedAt: string;
}

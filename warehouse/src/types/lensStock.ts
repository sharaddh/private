export type LensType = "sph" | "cyl" | "compound";

export interface LensStockItem {
  _id: string;
  coating: string;
  quantities: Record<LensType, Record<string, number>>;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
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
  createdAt: string;
  updatedAt: string;
}

export interface InventoryForm {
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
  location: "warehouse" | "shop";
  purchasePrice: number;
  sellingPrice: number;
  description: string;
}

export const EMPTY_FORM: InventoryForm = {
  sku: "", category: "Lens", inventoryType: "lens",
  brand: "", model: "", color: "", size: "", gender: "",
  supplier: "", quantity: 0, location: "warehouse",
  purchasePrice: 0, sellingPrice: 0, description: "",
};

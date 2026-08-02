import mongoose, { type Model } from "mongoose";
import { Schema } from "mongoose";
import { WAREHOUSE_DB_NAME } from "../config";

// Branch-scoped model cache
const branchModelCache = new Map<string, BranchModels>();
const warehouseModelCache: { models?: WarehouseModels } = {};

export interface BranchModels {
  Customer: Model<any>;
  Visit: Model<any>;
  Prescription: Model<any>;
  Order: Model<any>;
  Bill: Model<any>;
  Payment: Model<any>;
  Inventory: Model<any>;
  LensStock: Model<any>;
  Delivery: Model<any>;
  Settings: Model<any>;
  Todo: Model<any>;
}

export interface WarehouseModels {
  Inventory: Model<any>;
  LensStock: Model<any>;
  CartItem: Model<any>;
  Withdrawal: Model<any>;
  FogMark: Model<any>;
}

// Schemas imported lazily to avoid circular deps
let schemas: Record<string, Schema> | null = null;
let whSchemas: Record<string, Schema> | null = null;

function loadSchemas() {
  if (schemas) return schemas;
  schemas = {
    Customer: require("./customer").CustomerSchema,
    Visit: require("./visit").VisitSchema,
    Prescription: require("./prescription").PrescriptionSchema,
    Order: require("./order").OrderSchema,
    Bill: require("./bill").BillSchema,
    Payment: require("./payment").PaymentSchema,
    Inventory: require("./inventory").InventorySchema,
    LensStock: require("./lensStock").LensStockSchema,
    Delivery: require("./delivery").DeliverySchema,
    Settings: require("./settings").SettingsSchema,
    Todo: require("./todo").TodoSchema,
  };
  return schemas;
}

function loadWarehouseSchemas() {
  if (whSchemas) return whSchemas;
  whSchemas = {
    Inventory: require("./inventory").InventorySchema,
    LensStock: require("./lensStock").LensStockSchema,
    CartItem: require("./cart").CartItemSchema,
    Withdrawal: require("./withdrawal").WithdrawalSchema,
    FogMark: require("./fogMark").FogMarkSchema,
  };
  return whSchemas;
}

function registerModels(conn: mongoose.Connection): BranchModels {
  const s = loadSchemas();

  function getModel<T>(name: string, schema: Schema): Model<T> {
    if (conn.models[name]) return conn.models[name] as Model<T>;
    return conn.model<T>(name, schema);
  }

  return {
    Customer: getModel("Customer", s.Customer),
    Visit: getModel("Visit", s.Visit),
    Prescription: getModel("Prescription", s.Prescription),
    Order: getModel("Order", s.Order),
    Bill: getModel("Bill", s.Bill),
    Payment: getModel("Payment", s.Payment),
    Inventory: getModel("Inventory", s.Inventory),
    LensStock: getModel("LensStock", s.LensStock),
    Delivery: getModel("Delivery", s.Delivery),
    Settings: getModel("Settings", s.Settings),
    Todo: getModel("Todo", s.Todo),
  };
}

export function getBranchModels(dbName: string): BranchModels {
  if (!branchModelCache.has(dbName)) {
    const conn = mongoose.connection.useDb(dbName, { noListener: true });
    const models = registerModels(conn);
    branchModelCache.set(dbName, models);
  }
  return branchModelCache.get(dbName)!;
}

export function clearBranchCache() {
  branchModelCache.clear();
}

function registerWarehouseModels(conn: mongoose.Connection): WarehouseModels {
  const s = loadWarehouseSchemas();

  function getModel<T>(name: string, schema: Schema): Model<T> {
    if (conn.models[name]) return conn.models[name] as Model<T>;
    return conn.model<T>(name, schema);
  }

  return {
    Inventory: getModel("Inventory", s.Inventory),
    LensStock: getModel("LensStock", s.LensStock),
    CartItem: getModel("CartItem", s.CartItem),
    Withdrawal: getModel("Withdrawal", s.Withdrawal),
    FogMark: getModel("FogMark", s.FogMark),
  };
}

export function getWarehouseModels(): WarehouseModels {
  if (!warehouseModelCache.models) {
    const conn = mongoose.connection.useDb(WAREHOUSE_DB_NAME, { noListener: true });
    warehouseModelCache.models = registerWarehouseModels(conn);
  }
  return warehouseModelCache.models;
}

import mongoose, { type Model } from "mongoose";
import { Schema } from "mongoose";

// Branch-scoped model cache
const branchModelCache = new Map<string, BranchModels>();

export interface BranchModels {
  Customer: Model<any>;
  Visit: Model<any>;
  Prescription: Model<any>;
  Order: Model<any>;
  Bill: Model<any>;
  Payment: Model<any>;
  Inventory: Model<any>;
  Delivery: Model<any>;
  Settings: Model<any>;
  Todo: Model<any>;
}

// Schemas imported lazily to avoid circular deps
let schemas: Record<string, Schema> | null = null;

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
    Delivery: require("./delivery").DeliverySchema,
    Settings: require("./settings").SettingsSchema,
    Todo: require("./todo").TodoSchema,
  };
  return schemas;
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

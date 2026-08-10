import { useState } from "react";
import {
  LayoutDashboard, Boxes, Layers, PackagePlus, Hand, History, Warehouse, ClipboardList, type LucideIcon,
} from "lucide-react";
import OverviewTab from "../components/inventoryV2/OverviewTab";
import ProductsTab from "../components/inventoryV2/ProductsTab";
import VariantsTab from "../components/inventoryV2/VariantsTab";
import StockTab from "../components/inventoryV2/StockTab";
import WithdrawalsTab from "../components/inventoryV2/WithdrawalsTab";
import MovementsTab from "../components/inventoryV2/MovementsTab";
import RacksTab from "../components/inventoryV2/RacksTab";
import CountTab from "../components/inventoryV2/CountTab";

type TabKey = "overview" | "products" | "variants" | "stock" | "withdrawals" | "movements" | "racks" | "count";

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "products", label: "Products", icon: Boxes },
  { key: "variants", label: "Variants", icon: Layers },
  { key: "stock", label: "Stock", icon: PackagePlus },
  { key: "withdrawals", label: "Withdrawals", icon: Hand },
  { key: "movements", label: "Movements", icon: History },
  { key: "racks", label: "Racks", icon: Warehouse },
  { key: "count", label: "Count", icon: ClipboardList },
];

export default function InventoryV2() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Inventory Management</h1>
        <p className="text-sm text-muted-500 mt-1">
          Products, variants, stock, withdrawals, movements, racks and stock counts.
        </p>
      </div>

      <div className="flex gap-1 bg-th-elevated rounded-pill p-1 w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-pill text-small-bold whitespace-nowrap transition-all active:scale-95 ${
                activeTab === t.key
                  ? "bg-primary-500 text-surface-950 shadow-sm"
                  : "text-th-secondary hover:text-th-text"
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "products" && <ProductsTab />}
      {activeTab === "variants" && <VariantsTab />}
      {activeTab === "stock" && <StockTab />}
      {activeTab === "withdrawals" && <WithdrawalsTab />}
      {activeTab === "movements" && <MovementsTab />}
      {activeTab === "racks" && <RacksTab />}
      {activeTab === "count" && <CountTab />}
    </div>
  );
}

import { Search } from "lucide-react";

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  locationFilter: string;
  onLocationChange: (value: string) => void;
  totalCount: number;
  filteredCount: number;
}

export default function InventoryFilters({ search, onSearchChange, locationFilter, onLocationChange, totalCount, filteredCount }: Props) {
  return (
    <>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-th-muted" />
          <input type="text" placeholder="Search by SKU, brand, model..." value={search}
            onChange={(e) => onSearchChange(e.target.value)} className="input-field pl-9" />
        </div>
        <select value={locationFilter} onChange={(e) => onLocationChange(e.target.value)} className="input-field w-auto">
          <option value="all">All Locations</option>
          <option value="warehouse">Warehouse</option>
          <option value="shop">Shop</option>
        </select>
      </div>
      {filteredCount !== totalCount && (
        <p className="text-small text-th-muted">
          Showing {filteredCount} of {totalCount} items
        </p>
      )}
    </>
  );
}

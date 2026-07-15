import SearchInput from "./SearchInput";
import FilterSelect from "./FilterSelect";
import { LOCATIONS } from "../constants";

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
        <SearchInput
          value={search}
          onChange={onSearchChange}
          placeholder="Search by SKU, brand, model..."
          className="flex-1 min-w-[200px]"
        />
        <FilterSelect
          value={locationFilter}
          onChange={onLocationChange}
          options={[
            { value: "all", label: "All Locations" },
            ...LOCATIONS.map((l) => ({ value: l, label: l.charAt(0).toUpperCase() + l.slice(1) })),
          ]}
        />
      </div>
      {filteredCount !== totalCount && (
        <p className="text-small text-th-muted">
          Showing {filteredCount} of {totalCount} items
        </p>
      )}
    </>
  );
}

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { Plus, Package } from "lucide-react";
import { useDebounce } from "../hooks/useDebounce";
import { useToast } from "../context/ToastContext";
import type { InventoryItem } from "../types/inventory";
import InventoryTable from "../components/InventoryTable";
import InventoryFilters from "../components/InventoryFilters";
import InventoryFormModal from "../components/InventoryFormModal";
import WithdrawModal from "../components/WithdrawModal";
import DeleteConfirmModal from "../components/DeleteConfirmModal";
import Pagination from "../components/Pagination";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";

const PAGE_SIZE = 20;

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [locationFilter, setLocationFilter] = useState("warehouse");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InventoryItem | null>(null);
  const [withdrawItem, setWithdrawItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<keyof InventoryItem>("sku");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [searchParams] = useSearchParams();
  const debouncedSearch = useDebounce(search, 300);
  const { toast } = useToast();

  useEffect(() => {
    const loc = searchParams.get("location");
    if (loc) setLocationFilter(loc);
  }, [searchParams]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await api.get<InventoryItem[]>("/api/inventory");
    if (res.success && Array.isArray(res.data)) {
      setItems(res.data);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = useMemo(() => {
    let result = items;
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      result = result.filter((i) =>
        i.sku?.toLowerCase().includes(q) ||
        i.brand?.toLowerCase().includes(q) ||
        i.model?.toLowerCase().includes(q) ||
        i.supplier?.toLowerCase().includes(q)
      );
    }
    if (locationFilter !== "all") result = result.filter((i) => i.location === locationFilter);
    result.sort((a, b) => {
      const av = a[sortBy] ?? "";
      const bv = b[sortBy] ?? "";
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return result;
  }, [items, debouncedSearch, locationFilter, sortBy, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  useEffect(() => { setPage(1); }, [debouncedSearch, locationFilter]);

  function handleSort(col: keyof InventoryItem) {
    if (sortBy === col) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  function openAdd() { setEditing(null); setShowForm(true); }
  function openEdit(item: InventoryItem) { setEditing(item); setShowForm(true); }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await api.del("/api/inventory/" + id);
    if (res.success) { toast("Item deleted"); fetchItems(); }
    else { toast(res.message || "Failed to delete", "error"); }
    setDeleting(null);
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Lens Warehouse</h1>
          <p className="page-subtitle">Manage warehouse lens stock — {filtered.length} items</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Add Lens
        </button>
      </div>

      <InventoryFilters
        search={search}
        onSearchChange={setSearch}
        locationFilter={locationFilter}
        onLocationChange={setLocationFilter}
        totalCount={items.length}
        filteredCount={filtered.length}
      />

      {loading ? (
        <Spinner size={32} className="mx-auto mt-16" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No lens items found"
          message={search ? "Try adjusting your search" : undefined}
          action={!search ? { label: "Add First Lens", onClick: openAdd } : undefined}
        />
      ) : (
        <>
          <InventoryTable
            items={paginated}
            onEdit={openEdit}
            onWithdraw={setWithdrawItem}
            onDelete={setDeleteTarget}
            deleting={deleting}
          />
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </>
      )}

      <InventoryFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); }}
        editing={editing}
        onSaved={fetchItems}
      />

      <WithdrawModal
        item={withdrawItem}
        onClose={() => setWithdrawItem(null)}
        onSaved={fetchItems}
      />

      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </div>
  );
}

import { useCallback, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Search, RefreshCw, Boxes, Building2 } from "lucide-react";
import {
  useV2Brands, useV2Products, useCreateBrand, useUpdateBrand,
  useCreateProduct, useUpdateProduct, useDeleteProduct,
} from "../../hooks";
import Modal from "../Modal";
import ConfirmDialog from "../ConfirmDialog";
import { Pagination, EmptyState } from "./shared";
import { PRODUCT_CATEGORIES, type Brand, type InventoryProduct, type ProductCategory } from "../../types/inventoryV2";
import { useToast } from "../../context/ToastContext";

const PAGE_SIZE = 20;

const EMPTY_BRAND_FORM = { name: "", description: "" };
const EMPTY_PRODUCT_FORM = {
  brandId: "", brandName: "", category: "Specs" as ProductCategory, model: "", gender: "", description: "",
};

export default function ProductsTab() {
  const toast = useToast();

  const [threshold, setThreshold] = useState(5);
  const { brands, loading: brandsLoading, refetch: refetchBrands } = useV2Brands(threshold);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [page, setPage] = useState(1);
  const { products, total, pages, loading: productsLoading, refetch: refetchProducts } = useV2Products({
    page, limit: PAGE_SIZE,
    search: search.trim() || undefined,
    category: categoryFilter !== "All" ? categoryFilter : undefined,
  });

  const [brandModal, setBrandModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [brandForm, setBrandForm] = useState(EMPTY_BRAND_FORM);
  const [brandSaving, setBrandSaving] = useState(false);

  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [productSaving, setProductSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<InventoryProduct | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { create: createBrand } = useCreateBrand();
  const { update: updateBrand } = useUpdateBrand();
  const { create: createProduct } = useCreateProduct();
  const { update: updateProduct } = useUpdateProduct();
  const { remove: removeProduct } = useDeleteProduct();

  const brandOptions = useMemo(() => brands.map((b) => ({ _id: b._id, name: b.name })), [brands]);

  const refreshAll = useCallback(() => {
    refetchBrands();
    refetchProducts();
  }, [refetchBrands, refetchProducts]);

  function openCreateBrand(): void {
    setEditingBrand(null);
    setBrandForm(EMPTY_BRAND_FORM);
    setBrandModal(true);
  }

  function openEditBrand(b: Brand): void {
    setEditingBrand(b);
    setBrandForm({ name: b.name, description: b.description || "" });
    setBrandModal(true);
  }

  async function handleSaveBrand(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!brandForm.name.trim()) {
      toast.error("Brand name is required");
      return;
    }
    setBrandSaving(true);
    try {
      const res = editingBrand
        ? await updateBrand(editingBrand._id, { name: brandForm.name.trim(), description: brandForm.description.trim() || undefined })
        : await createBrand({ name: brandForm.name.trim(), description: brandForm.description.trim() || undefined });
      if (res.success) {
        toast.success(editingBrand ? "Brand updated" : "Brand created");
        setBrandModal(false);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to save brand");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to save brand");
    } finally {
      setBrandSaving(false);
    }
  }

  function openCreateProduct(): void {
    setEditingProduct(null);
    setProductForm({ ...EMPTY_PRODUCT_FORM, category: (categoryFilter !== "All" && PRODUCT_CATEGORIES.includes(categoryFilter as ProductCategory)) ? (categoryFilter as ProductCategory) : "Specs" });
    setProductModal(true);
  }

  function openEditProduct(p: InventoryProduct): void {
    setEditingProduct(p);
    setProductForm({
      brandId: p.brandId || "",
      brandName: p.brandName || "",
      category: (PRODUCT_CATEGORIES.includes(p.category as ProductCategory) ? p.category : "Specs") as ProductCategory,
      model: p.model || "",
      gender: p.gender || "",
      description: p.description || "",
    });
    setProductModal(true);
  }

  async function handleSaveProduct(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (!productForm.model.trim()) {
      toast.error("Model is required");
      return;
    }
    setProductSaving(true);
    try {
      const selectedBrand = brandOptions.find((b) => b._id === productForm.brandId);
      const res = editingProduct
          ? await updateProduct(editingProduct._id, {
              category: productForm.category,
              model: productForm.model.trim(),
              gender: (productForm.gender || undefined) as "Male" | "Female" | "Unisex" | undefined,
              description: productForm.description.trim() || undefined,
            })
        : await createProduct({
            brandId: productForm.brandId || undefined,
            brandName: productForm.brandName.trim() || selectedBrand?.name || undefined,
            category: productForm.category,
            model: productForm.model.trim(),
            gender: (productForm.gender || undefined) as "Male" | "Female" | "Unisex" | undefined,
            description: productForm.description.trim() || undefined,
          });
      if (res.success) {
        toast.success(editingProduct ? "Product updated" : "Product created");
        setProductModal(false);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to save product");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to save product");
    } finally {
      setProductSaving(false);
    }
  }

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await removeProduct(deleteTarget._id);
      if (res.success) {
        toast.success("Product removed");
        setDeleteTarget(null);
        refreshAll();
      } else {
        toast.error(res.message || "Failed to remove product");
      }
    } catch (err) {
      toast.error((err as Error).message || "Failed to remove product");
    } finally {
      setDeleting(false);
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-lg text-sm text-th-text placeholder-th-muted focus:outline-none focus:ring-1 focus:ring-[#1ed760] bg-th-hover";
  const inputStyle = { border: "1px solid rgb(124,124,124)" } as const;

  return (
    <div className="space-y-6">
      {/* Brands */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-base font-semibold text-th-text flex items-center gap-2">
            <Building2 size={18} className="text-[#1ed760]" /> Brands
          </h2>
          <div className="flex items-center gap-2">
            <select className="input-field w-auto" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} aria-label="Low stock threshold">
              {[3, 5, 10, 20].map((t) => <option key={t} value={t}>Low ≤ {t}</option>)}
            </select>
            <button onClick={refreshAll} className="btn-secondary flex items-center gap-2" aria-label="Refresh">
              <RefreshCw size={15} /> Refresh
            </button>
            <button onClick={openCreateBrand} className="btn-primary flex items-center gap-2" aria-label="Add brand">
              <Plus size={16} /> Brand
            </button>
          </div>
        </div>

        {brandsLoading && !brands.length && (
          <div className="flex items-center gap-2 text-th-secondary text-sm">
            <RefreshCw size={15} className="animate-spin" /> Loading brands...
          </div>
        )}

        {brands.length === 0 && !brandsLoading ? (
          <EmptyState icon={Building2} text="No brands yet. Add your first brand." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {brands.map((b) => (
              <div key={b._id} className="card p-4 group">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-th-text truncate">{b.name}</p>
                  <button
                    type="button"
                    onClick={() => openEditBrand(b)}
                    className="p-1.5 hover:bg-th-hover rounded-lg text-th-secondary opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label={`Edit ${b.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-th-text">{b.variants}</p>
                    <p className="text-[11px] text-th-secondary">Variants</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-th-text">{b.units}</p>
                    <p className="text-[11px] text-th-secondary">Units</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${b.lowStock > 0 ? "text-amber-400" : "text-[#1ed760]"}`}>{b.lowStock}</p>
                    <p className="text-[11px] text-th-secondary">Low</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Products */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-base font-semibold text-th-text flex items-center gap-2">
            <Boxes size={18} className="text-[#1ed760]" /> Products
          </h2>
          <button onClick={openCreateProduct} className="btn-primary flex items-center gap-2" aria-label="Add product">
            <Plus size={16} /> Product
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-th-secondary" />
            <input
              type="text"
              placeholder="Search by model or brand..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-th-elevated text-th-text placeholder-th-muted text-sm"
              style={{ border: "rgb(124,124,124) 0px 0px 0px 1px inset" }}
              aria-label="Search products"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            {["All", ...PRODUCT_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => { setCategoryFilter(c); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg uppercase tracking-wider border transition-all whitespace-nowrap ${
                  categoryFilter === c
                    ? "bg-[#1ed760] text-black border-[#1ed760]"
                    : "bg-th-elevated text-th-secondary border-th-border hover:bg-th-hover"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {productsLoading && !products.length && (
          <div className="flex items-center gap-2 text-th-secondary text-sm">
            <RefreshCw size={15} className="animate-spin" /> Loading products...
          </div>
        )}

        {products.length === 0 && !productsLoading ? (
          <EmptyState icon={Boxes} text="No products found" />
        ) : (
          <div className="overflow-x-auto bg-th-surface rounded-[8px]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-th-hover bg-th-base">
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Model</th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Brand</th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Category</th>
                  <th className="px-4 py-3 text-left text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Gender</th>
                  <th className="px-4 py-3 text-right text-[13px] font-semibold text-th-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-th-border">
                {products.map((p) => (
                  <tr key={p._id} className="hover:bg-th-card transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-th-text">{p.model}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-th-text">{p.brandName || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><span className="badge badge-blue">{p.category}</span></td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-th-secondary">{p.gender || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button type="button" onClick={() => openEditProduct(p)} className="p-1.5 hover:bg-[#1ed760]/10 rounded-lg text-[#1ed760]" aria-label="Edit product">
                          <Pencil size={15} />
                        </button>
                        <button type="button" onClick={() => setDeleteTarget(p)} className="p-1.5 hover:bg-[#e74c3c]/10 rounded-lg text-[#e74c3c]" aria-label="Remove product">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-3">
          <Pagination page={page} pages={pages} total={total} pageSize={PAGE_SIZE} onPage={setPage} />
        </div>
      </div>

      {/* Brand modal */}
      <Modal open={brandModal} onClose={() => setBrandModal(false)} title={editingBrand ? "Edit Brand" : "Add Brand"} size="sm">
        <form onSubmit={handleSaveBrand} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-th-secondary mb-1.5">Brand name *</label>
            <input className={inputCls} style={inputStyle} value={brandForm.name} onChange={(e) => setBrandForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Lenskart" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-th-secondary mb-1.5">Description</label>
            <textarea className={inputCls} style={inputStyle} rows={2} value={brandForm.description} onChange={(e) => setBrandForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setBrandModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
            <button type="submit" disabled={brandSaving} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
              {brandSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Product modal */}
      <Modal open={productModal} onClose={() => setProductModal(false)} title={editingProduct ? "Edit Product" : "Add Product"} size="lg">
        <form onSubmit={handleSaveProduct} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Brand</label>
              <select className={inputCls} style={inputStyle} value={productForm.brandId} onChange={(e) => setProductForm((f) => ({ ...f, brandId: e.target.value }))}>
                <option value="">— Select brand —</option>
                {brandOptions.map((b) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Brand name (free text)</label>
              <input className={inputCls} style={inputStyle} value={productForm.brandName} onChange={(e) => setProductForm((f) => ({ ...f, brandName: e.target.value }))} placeholder="Fallback when no brand selected" />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Category</label>
              <select className={inputCls} style={inputStyle} value={productForm.category} onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value as ProductCategory }))}>
                {PRODUCT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Model *</label>
              <input className={inputCls} style={inputStyle} value={productForm.model} onChange={(e) => setProductForm((f) => ({ ...f, model: e.target.value }))} placeholder="e.g. GOLD-102" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Gender</label>
              <select className={inputCls} style={inputStyle} value={productForm.gender} onChange={(e) => setProductForm((f) => ({ ...f, gender: e.target.value }))}>
                <option value="">All / Unisex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Unisex">Unisex</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-th-secondary mb-1.5">Description</label>
              <textarea className={inputCls} style={inputStyle} rows={2} value={productForm.description} onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setProductModal(false)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider border border-th-muted text-th-secondary hover:bg-th-hover">Cancel</button>
            <button type="submit" disabled={productSaving} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: "#1ed760", color: "#121212" }}>
              {productSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Remove product?"
        message={`Archive "${deleteTarget?.brandName || ""} ${deleteTarget?.model || ""}"? It will no longer appear in product listings.`}
        confirmLabel="Remove"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}

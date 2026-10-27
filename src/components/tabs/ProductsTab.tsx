"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, PackagePlus, ScanLine, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { ProductListItem } from "@/lib/types";
import { BarcodeScannerSheet, cameraScanSupported } from "../BarcodeScannerSheet";
import { FilterChip } from "../FilterChip";
import { ProductCard } from "../ProductCard";
import type { ProductManageOptions } from "../products/manage-options";
import { ProductFormModal } from "../products/ProductFormModal";
import { StockAdjustModal } from "../products/StockAdjustModal";
import { StockTransferModal } from "../products/StockTransferModal";

const ALL_CATEGORY = "__all__";

/** No storefront filter here (unlike every other tab) — per explicit user ask, just two independent
 * toggle chips, Low Stock and Out of Stock, either or both active at once (not the "All + one per
 * location" radio-group pattern the other tabs use). The full catalog is fetched once; toggling
 * filters client-side is fine here since this is a bounded product list, not a recency-capped feed
 * like Sales/Transactions where client-side filtering after a cap could hide real rows.
 *
 * Category chips are built from whatever distinct categoryName values are actually present in the
 * fetched catalog (mirrors DESKTOP's own buildCategoryOptions, minus the parent-path nesting since
 * mobile's categoryName is already flattened server-side) — selecting one narrows the pool, then
 * search further filters within it, same combined useMemo DESKTOP's ProductsRoute.tsx uses. */
export function ProductsTab({
  currency,
  canCreate,
  canEdit,
  canAdjustStock,
  canTransferStock,
  viewerIsSuperAdmin,
  viewerBranchId,
  vatRatePercent,
}: {
  currency: string;
  /** products.create / products.edit / inventory.edit — same grants DESKTOP checks. */
  canCreate: boolean;
  canEdit: boolean;
  canAdjustStock: boolean;
  /** stock_transfers.create — DESKTOP's own Transfer grant. */
  canTransferStock: boolean;
  viewerIsSuperAdmin: boolean;
  viewerBranchId: string | null;
  vatRatePercent: number;
}) {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [outOfStockOnly, setOutOfStockOnly] = useState(false);
  const [archivedOnly, setArchivedOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState(ALL_CATEGORY);
  const [manageOptions, setManageOptions] = useState<ProductManageOptions | null>(null);
  const [formFor, setFormFor] = useState<{ productId: string | null } | null>(null);
  const [stockFor, setStockFor] = useState<ProductListItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);

  const canManage = canCreate || canEdit || canAdjustStock || canTransferStock;

  // A manager sees archived and non-stock products too (to restore/edit them); everyone else keeps
  // the plain active, stock-tracked catalog this tab always showed.
  const loadProducts = useCallback(() => {
    api
      .listProducts({ includeAll: canCreate || canEdit })
      .then(setProducts)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load products."));
  }, [canCreate, canEdit]);

  useEffect(loadProducts, [loadProducts]);

  useEffect(() => {
    if (!canManage) return;
    Promise.all([api.listCategories(), api.listLocations()])
      .then(([categories, locations]) =>
        setManageOptions({
          categories,
          locations,
          // Same rule SERVER applies: a non-Super-Admin with a branch only manages that branch.
          branchScope: viewerIsSuperAdmin ? null : viewerBranchId,
          vatRatePercent,
        }),
      )
      .catch(() => {
        // The catalog still shows without these; the management buttons just stay hidden.
      });
  }, [canManage, viewerIsSuperAdmin, viewerBranchId, vatRatePercent]);

  async function handleToggleArchive(product: ProductListItem): Promise<void> {
    setNotice(null);
    try {
      await api.setProductStatus(product.id, product.status === "inactive" ? "active" : "inactive");
      setNotice(product.status === "inactive" ? `${product.name} restored.` : `${product.name} archived — it no longer shows at checkout.`);
      loadProducts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update product.");
    }
  }

  const categories = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map((p) => p.categoryName).filter((name): name is string => !!name))).sort();
  }, [products]);

  const filtered = useMemo(() => {
    if (!products) return null;
    const term = searchTerm.trim().toLowerCase();
    return products.filter((p) => {
      // Archived products only ever appear under their own chip.
      if (archivedOnly !== (p.status === "inactive")) return false;
      if (lowStockOnly && !p.lowStock) return false;
      if (outOfStockOnly && !p.outOfStock) return false;
      if (categoryFilter !== ALL_CATEGORY && p.categoryName !== categoryFilter) return false;
      if (term && !`${p.name} ${p.sku} ${p.barcode ?? ""}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [products, archivedOnly, lowStockOnly, outOfStockOnly, categoryFilter, searchTerm]);

  const hasArchived = useMemo(() => products?.some((p) => p.status === "inactive") ?? false, [products]);
  const hasActiveFilter = archivedOnly || lowStockOnly || outOfStockOnly || categoryFilter !== ALL_CATEGORY || searchTerm.trim().length > 0;

  return (
    <div className="pb-10">
      <div className="sticky top-[60px] z-10 border-b border-navy/10 bg-cream-dark/95 backdrop-blur">
        <div className="flex gap-2 px-4 pt-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, SKU or barcode..."
              className="h-10 w-full rounded-lg border border-navy/15 bg-white pr-3 pl-9 text-sm outline-none focus:border-blue"
            />
          </div>
          {cameraScanSupported() && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              aria-label="Scan a barcode to find a product"
              className="grid size-10 flex-none place-items-center rounded-lg bg-navy text-white"
            >
              <ScanLine className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 overflow-x-auto px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <FilterChip label="Low Stock" active={lowStockOnly} onClick={() => setLowStockOnly((v) => !v)} />
          <FilterChip label="Out of Stock" active={outOfStockOnly} onClick={() => setOutOfStockOnly((v) => !v)} />
          {(hasArchived || archivedOnly) && <FilterChip label="Archived" active={archivedOnly} onClick={() => setArchivedOnly((v) => !v)} />}
        </div>
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterChip label="All" active={categoryFilter === ALL_CATEGORY} onClick={() => setCategoryFilter(ALL_CATEGORY)} />
            {categories.map((category) => (
              <FilterChip key={category} label={category} active={categoryFilter === category} onClick={() => setCategoryFilter(category)} />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-4">
        {manageOptions && (canCreate || (canTransferStock && manageOptions.locations.length > 1)) && (
          <div className="mb-4 flex gap-2">
            {canCreate && (
              <button
                type="button"
                onClick={() => setFormFor({ productId: null })}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
              >
                <PackagePlus className="size-4" aria-hidden="true" />
                Add Product
              </button>
            )}
            {canTransferStock && manageOptions.locations.length > 1 && (
              <button
                type="button"
                onClick={() => setTransferOpen(true)}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-navy/20 bg-white py-3 text-sm font-bold text-navy"
              >
                <ArrowLeftRight className="size-4" aria-hidden="true" />
                Transfer Stock
              </button>
            )}
          </div>
        )}
        {notice && <div className="mb-3 rounded border border-green/30 bg-green/10 px-4 py-3 text-sm font-semibold text-green">{notice}</div>}
        {error && <div className="rounded border border-red/30 bg-red/10 px-4 py-3 text-sm font-semibold text-red">{error}</div>}
        {!products && !error && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}
        {filtered && filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-navy/50">
            {hasActiveFilter ? "No products match this filter." : "No products yet."}
          </p>
        )}

        {filtered && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                currency={currency}
                actions={
                  manageOptions
                    ? {
                        onAdjustStock: canAdjustStock ? () => setStockFor(product) : undefined,
                        onEdit: canEdit ? () => setFormFor({ productId: product.id }) : undefined,
                        onToggleArchive: canEdit ? () => void handleToggleArchive(product) : undefined,
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )}
      </div>

      {scannerOpen && (
        <BarcodeScannerSheet
          onDetected={(code) => {
            setScannerOpen(false);
            setSearchTerm(code);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
      {formFor && manageOptions && (
        <ProductFormModal
          productId={formFor.productId}
          options={manageOptions}
          onClose={() => setFormFor(null)}
          onSaved={() => {
            setNotice(formFor.productId ? "Product updated." : "Product added.");
            setFormFor(null);
            loadProducts();
          }}
          onCategoryCreated={(category) =>
            setManageOptions((prev) => (prev ? { ...prev, categories: [...prev.categories, category].sort((a, b) => a.name.localeCompare(b.name)) } : prev))
          }
        />
      )}
      {transferOpen && manageOptions && products && (
        <StockTransferModal
          products={products}
          options={manageOptions}
          onClose={() => setTransferOpen(false)}
          onSaved={(message) => {
            setTransferOpen(false);
            setNotice(message);
            loadProducts();
          }}
        />
      )}
      {stockFor && manageOptions && (
        <StockAdjustModal
          product={stockFor}
          options={manageOptions}
          onClose={() => setStockFor(null)}
          onSaved={(message) => {
            setNotice(message);
            setStockFor(null);
            loadProducts();
          }}
        />
      )}
    </div>
  );
}

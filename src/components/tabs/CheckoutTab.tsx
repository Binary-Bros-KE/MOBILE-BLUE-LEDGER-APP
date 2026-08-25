"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, Minus, Plus, Search, ShoppingCart, Store, Trash2, Truck, UserRound, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { computeLineTax, resolveProductTaxConfig, type TenantTaxConfig } from "@/lib/tax";
import type { CheckoutCartLine, MobileCustomer, MobileLocation, MobileRider, MobileSupplier, PaymentMethodOption, ProductListItem } from "@/lib/types";
import { DocumentDetailModal } from "../DocumentDetailModal";
import { QuickCreateSupplierModal } from "../QuickCreateSupplierModal";
import { CheckoutCustomerPickerModal } from "./CheckoutCustomerPickerModal";
import { CheckoutDeliveryModal, emptyDeliveryDraft, type DeliveryDraft } from "./CheckoutDeliveryModal";

/**
 * Real, from-scratch mobile checkout — the counterpart to DESKTOP's Checkout screen. Customer
 * selection, delivery, price override (mark-up), locally-sourced items, and order notes all match
 * DESKTOP's own Checkout feature set; deliberately still lighter in a couple of ways (no wholesale
 * price break, no service charges, no customer credit yet — see mobile-checkout-service.ts's own
 * doc comment for what's covered). Delivery is a MODAL here rather than DESKTOP's inline expanding
 * panel (ExtraChargesSection) — a deliberate mobile-specific choice, screen space is tighter here
 * than on a desktop POS screen; the local-supplier picker is similarly a plain select+quick-create
 * rather than DESKTOP's own searchable SupplierPicker modal, for the same reason. Every figure shown
 * here is a PREVIEW only: SERVER re-fetches the real Product rows and recomputes pricing/tax/stock
 * validation from scratch at submit time (including re-enforcing the price-override floor and
 * skipping stock deduction for locally-sourced lines), so this component never needs to duplicate
 * DESKTOP's full cart-pricing.ts logic — just enough to show the cashier a running total before they
 * commit.
 *
 * Scoped to the signed-in employee's own branch (branchId/branchName come from /mobile/me) when
 * they have one — mobile-checkout-service.ts rejects any other locationId outright for that case,
 * matching DESKTOP's own requireActiveSession. A branch-less employee (Super Admin, typically) gets
 * an inline StorefrontPicker instead of being blocked entirely — same DESKTOP precedent (real user
 * feedback: being flatly blocked was "annoying"), same effectiveLocationId fallback pattern.
 */
export function CheckoutTab({
  branchId,
  branchName,
  currency,
  tenantTaxConfig,
}: {
  branchId: string | null;
  branchName: string | null;
  currency: string;
  tenantTaxConfig: TenantTaxConfig;
}) {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[] | null>(null);
  const [customers, setCustomers] = useState<MobileCustomer[]>([]);
  const [riders, setRiders] = useState<MobileRider[]>([]);
  const [suppliers, setSuppliers] = useState<MobileSupplier[]>([]);
  const [quickCreateSupplierFor, setQuickCreateSupplierFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CheckoutCartLine[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryDraft | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  // Only ever consulted when branchId is null (see the StorefrontPicker below) — otherwise SERVER
  // always uses the employee's own assigned branch regardless of this value.
  const [storefronts, setStorefronts] = useState<MobileLocation[] | null>(null);
  const [storefrontId, setStorefrontId] = useState("");
  const effectiveLocationId = branchId ?? (storefrontId || null);

  // Minted ONCE per checkout attempt, resent unchanged on any retry — this is the whole idempotency
  // mechanism (see mobile-checkout-service.ts). Only regenerated after a sale actually completes or
  // the cart is cleared, never on every render.
  const checkoutIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (branchId) return;
    api
      .listStorefronts()
      .then(setStorefronts)
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load storefronts."));
  }, [branchId]);

  useEffect(() => {
    Promise.all([api.listProducts(), api.listPaymentMethods(), api.listCustomers(), api.listRiders(), api.listSuppliers()])
      .then(([productList, methods, customerList, riderList, supplierList]) => {
        setProducts(productList);
        setPaymentMethods(methods);
        setCustomers(customerList);
        setRiders(riderList);
        setSuppliers(supplierList);
        if (methods.length > 0) setPaymentMethodId((current) => current || (methods[0] as PaymentMethodOption).id);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load products or payment methods."));
  }, []);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return products.filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)).slice(0, 12);
  }, [products, search]);

  const selectedPaymentMethod = paymentMethods?.find((m) => m.id === paymentMethodId) ?? null;

  // grossCents (per line) is what actually gets charged — already includes tax whether it's baked
  // into the product's own price (inclusive) or added on top (exclusive). Summing THIS, not the raw
  // pre-tax subtotal, is what must drive the Total shown/charged/validated below: SERVER's own
  // grandTotalCents (mobile-checkout-service.ts) is computed the exact same way, and a preview that
  // omitted tax meant a cashier could type exactly what this screen showed and still have the sale
  // rejected as underpaid (caught live: a tax-exclusive product's real total was always higher than
  // this naive sum — 2026-08-25).
  // effectiveUnitPriceCents (override or the product's natural price) drives every downstream figure
  // for this line — the tax computation, the below-minimum check, and the line total shown.
  function effectiveUnitPriceCents(line: CheckoutCartLine): number {
    return line.priceOverride.trim() ? Math.round(Number(line.priceOverride) * 100) : line.unitPriceCents;
  }
  const lineTaxResults = cart.map((line) => {
    const taxableCents = effectiveUnitPriceCents(line) * line.quantity - line.discountAmountCents;
    const productTaxConfig = resolveProductTaxConfig({ pricesTaxInclusive: line.pricesTaxInclusive }, tenantTaxConfig);
    return computeLineTax(taxableCents, line.taxType, productTaxConfig);
  });
  const netSubtotalCents = lineTaxResults.reduce((sum, r) => sum + r.netCents, 0);
  const taxAmountCents = lineTaxResults.reduce((sum, r) => sum + r.taxCents, 0);
  // Delivery fee folds straight into the grand total — matching SERVER's own mobile-checkout-service
  // (which validates amountReceivedCents against this SAME inclusive figure), so a cashier collecting
  // a delivery fee is never shown/charged a total that's short of what checkout will actually enforce.
  const deliveryFeeCents = delivery?.fee.trim() ? Math.round(Number(delivery.fee) * 100) : 0;
  const grandTotalCents = lineTaxResults.reduce((sum, r) => sum + r.grossCents, 0) + deliveryFeeCents;
  const amountReceivedCents = amountReceived.trim() ? Math.round(Number(amountReceived) * 100) : 0;
  const changeCents = amountReceivedCents - grandTotalCents;

  const customerLabel = customerId ? (customers.find((c) => c.id === customerId)?.name ?? "Walk-in Customer") : "Walk-in Customer";

  // submitError is only ever SET inside handleCheckout (on a failed submit attempt) — without this,
  // fixing the thing that caused it (e.g. typing in the rest of the amount received) leaves the
  // banner on screen until the cashier taps Charge again, which reads as "still blocked" even though
  // the sale would now go through. Clear it the moment any input that could have caused it changes.
  useEffect(() => {
    setSubmitError(null);
  }, [cart, paymentMethodId, paymentReference, amountReceived, customerId, delivery]);

  function addToCart(product: ProductListItem): void {
    setCart((prev) => {
      const existing = prev.find((line) => line.productId === product.id);
      if (existing) {
        return prev.map((line) => (line.productId === product.id ? { ...line, quantity: line.quantity + 1 } : line));
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPriceCents: product.sellingPriceCents,
          quantity: 1,
          discountAmountCents: 0,
          taxType: product.taxType,
          pricesTaxInclusive: product.pricesTaxInclusive,
          minimumPriceCents: product.minimumPriceCents,
          priceOverride: "",
          isLocallySourced: false,
          localCost: "",
          localSupplierId: null,
        },
      ];
    });
    setSearch("");
  }

  function updateQuantity(productId: string, quantity: number): void {
    if (quantity < 1) return;
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, quantity } : line)));
  }

  function updateDiscount(productId: string, discountText: string): void {
    const discountAmountCents = discountText.trim() ? Math.round(Number(discountText) * 100) : 0;
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, discountAmountCents } : line)));
  }

  function updatePriceOverride(productId: string, value: string): void {
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, priceOverride: value } : line)));
  }

  function toggleLocallySourced(productId: string): void {
    setCart((prev) =>
      prev.map((line) =>
        line.productId === productId
          ? {
              ...line,
              isLocallySourced: !line.isLocallySourced,
              // Clears any half-entered cost/supplier when switching back off, so a stale value can't
              // silently ride along if the cashier re-enables it later for a different sale.
              ...(line.isLocallySourced ? { localCost: "", localSupplierId: null } : {}),
            }
          : line,
      ),
    );
  }

  function updateLocalCost(productId: string, value: string): void {
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, localCost: value } : line)));
  }

  function updateLocalSupplier(productId: string, supplierId: string | null): void {
    setCart((prev) => prev.map((line) => (line.productId === productId ? { ...line, localSupplierId: supplierId } : line)));
  }

  function removeLine(productId: string): void {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
  }

  function resetForNextSale(): void {
    setCart([]);
    setPaymentReference("");
    setAmountReceived("");
    setCustomerId(null);
    setDelivery(null);
    setOrderNotes("");
    checkoutIdRef.current = crypto.randomUUID();
  }

  async function handleCheckout(): Promise<void> {
    if (!effectiveLocationId) {
      setSubmitError("Choose a storefront before completing this sale.");
      return;
    }
    if (cart.length === 0) {
      setSubmitError("Add at least one item first.");
      return;
    }
    if (!paymentMethodId) {
      setSubmitError("Choose a payment method.");
      return;
    }
    if (selectedPaymentMethod?.requiresReference && !paymentReference.trim()) {
      setSubmitError(`${selectedPaymentMethod.name} requires a reference.`);
      return;
    }
    if (amountReceivedCents < grandTotalCents) {
      setSubmitError("Amount received is less than the total.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.checkout({
        id: checkoutIdRef.current,
        locationId: effectiveLocationId,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discountAmountCents: line.discountAmountCents,
          unitPriceCents: line.priceOverride.trim() ? Math.round(Number(line.priceOverride) * 100) : undefined,
          isLocallySourced: line.isLocallySourced,
          localCostCents: line.isLocallySourced && line.localCost.trim() ? Math.round(Number(line.localCost) * 100) : undefined,
          localSupplierId: line.isLocallySourced ? (line.localSupplierId ?? undefined) : undefined,
        })),
        paymentMethodId,
        paymentReference: paymentReference.trim() || undefined,
        customerId: customerId ?? undefined,
        amountReceivedCents,
        notes: orderNotes.trim() || undefined,
        delivery: delivery
          ? {
              riderId: delivery.riderId ?? undefined,
              recipientName: delivery.recipientName,
              country: delivery.country,
              town: delivery.town,
              physicalAddress: delivery.physicalAddress,
              notes: delivery.notes,
              feeCents: delivery.fee.trim() ? Math.round(Number(delivery.fee) * 100) : 0,
              costCents: delivery.cost.trim() ? Math.round(Number(delivery.cost) * 100) : 0,
            }
          : undefined,
      });
      setCompletedSaleId(result.id);
    } catch (err) {
      // Deliberately NOT resetting checkoutIdRef here — a retry (network error, timeout) must reuse
      // the SAME id so SERVER treats it as the safe no-op it's designed to be, not a second sale.
      setSubmitError(err instanceof ApiError ? err.message : "Checkout failed — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-32">
      <div className="px-4 pt-4 pb-2">
        {branchId ? (
          <p className="text-xs font-semibold text-navy/50">
            Selling from <span className="font-bold text-navy">{branchName}</span>
          </p>
        ) : (
          <div className="rounded-lg border border-dashed border-gold bg-gold/10 p-3">
            <div className="flex items-center gap-1.5">
              <Store className="size-4 flex-none text-gold-text" aria-hidden="true" />
              <p className="text-xs font-bold text-navy">Your account has no assigned branch — choose a storefront for this sale.</p>
            </div>
            <select
              value={storefrontId}
              onChange={(e) => setStorefrontId(e.target.value)}
              className="mt-2 h-9 w-full max-w-xs rounded-lg border border-navy/15 bg-white px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
            >
              <option value="">{storefronts === null ? "Loading…" : "Select a storefront"}</option>
              {(storefronts ?? []).map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="px-4 pb-2">
        <button
          type="button"
          onClick={() => setCustomerPickerOpen(true)}
          className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-navy/15 bg-white px-3 py-2.5 text-left"
        >
          <UserRound className="size-4 flex-none text-blue" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy">{customerLabel}</span>
          <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
        </button>

        {delivery ? (
          // A <div>, not a <button> — it contains its own "remove" <button> below, and a <button>
          // can never validly contain another <button> (React logged a hydration error over this
          // exact nesting: "Warning: In HTML, <button> cannot be a descendant of <button>" — caught
          // live, 2026-08-25). role="button" keeps this row keyboard/screen-reader operable without
          // the invalid nesting.
          <div
            role="button"
            tabIndex={0}
            onClick={() => setDeliveryModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setDeliveryModalOpen(true);
            }}
            className="mt-1.5 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-blue/30 bg-blue/5 px-3 py-2.5 text-left"
          >
            <Truck className="size-4 flex-none text-blue" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy">
              Delivery to {delivery.town || delivery.physicalAddress}
              {deliveryFeeCents > 0 && <span className="text-navy/50"> · {formatCents(deliveryFeeCents, currency)}</span>}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDelivery(null);
              }}
              aria-label="Remove delivery"
              className="grid size-6 flex-none place-items-center rounded-full text-navy/40 hover:bg-white hover:text-red"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setDeliveryModalOpen(true)}
            className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-navy/15 bg-white px-3 py-2.5 text-left"
          >
            <Truck className="size-4 flex-none text-navy/40" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy/50">Add delivery for this sale</span>
            <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
          </button>
        )}
      </div>

      {loadError && <p className="mx-4 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{loadError}</p>}

      <div className="px-4 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products to add…"
            className="w-full rounded-lg border border-navy/15 bg-white py-2.5 pl-9 pr-3 text-sm text-navy placeholder:text-navy/30 focus:border-blue focus:outline-none"
          />
        </div>
        {filteredProducts.length > 0 && (
          <div className="mt-2 space-y-1 rounded-lg border border-navy/10 bg-white p-1.5 shadow-sm">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addToCart(product)}
                className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left hover:bg-cream-dark"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy">{product.name}</p>
                  <p className="text-[11px] text-navy/50">
                    {product.sku} · {product.totalQuantity} in stock
                  </p>
                </div>
                <p className="flex-none text-sm font-bold text-navy">{formatCents(product.sellingPriceCents, currency)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-navy/15 py-10 text-center">
            <ShoppingCart className="size-6 text-navy/25" aria-hidden="true" />
            <p className="text-sm text-navy/50">Search above to add products to this sale.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cart.map((line, index) => {
              const priceBelowMinimum =
                line.priceOverride.trim() &&
                line.minimumPriceCents !== null &&
                Math.round(Number(line.priceOverride) * 100) < line.minimumPriceCents;
              return (
                <div key={line.productId} className="rounded-lg border border-navy/10 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy">{line.name}</p>
                      <p className="text-[11px] text-navy/50">@ {formatCents(line.unitPriceCents, currency)}</p>
                    </div>
                    <button type="button" onClick={() => removeLine(line.productId)} aria-label={`Remove ${line.name}`} className="flex-none text-navy/30 hover:text-red">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.productId, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        className="grid size-7 place-items-center rounded-md border border-navy/15 text-navy/60 disabled:opacity-30"
                      >
                        <Minus className="size-3" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-navy">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.productId, line.quantity + 1)}
                        className="grid size-7 place-items-center rounded-md border border-navy/15 text-navy/60"
                      >
                        <Plus className="size-3" aria-hidden="true" />
                      </button>
                    </div>
                    <label className="flex flex-1 items-center gap-1.5 text-[11px] font-semibold text-navy/50">
                      Price
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.priceOverride}
                        onChange={(e) => updatePriceOverride(line.productId, e.target.value)}
                        placeholder={(line.unitPriceCents / 100).toFixed(2)}
                        className={`w-full min-w-0 rounded-md border px-1.5 py-1 text-right text-xs font-semibold focus:outline-none ${
                          priceBelowMinimum ? "border-red text-red" : "border-navy/15 text-navy focus:border-blue"
                        }`}
                      />
                    </label>
                  </div>
                  {priceBelowMinimum && (
                    <p className="mt-1 text-right text-[10px] font-bold text-red">
                      Below minimum price of {formatCents(line.minimumPriceCents as number, currency)}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-[11px] font-semibold text-navy/50">
                      Discount
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.discountAmountCents ? (line.discountAmountCents / 100).toString() : ""}
                        onChange={(e) => updateDiscount(line.productId, e.target.value)}
                        placeholder="0.00"
                        className="w-16 rounded-md border border-navy/15 px-1.5 py-1 text-right text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                      />
                    </label>
                    <p className="flex-none text-sm font-bold text-navy">{formatCents(lineTaxResults[index].grossCents, currency)}</p>
                  </div>

                  <label className="mt-2.5 flex cursor-pointer items-center gap-1.5 text-[10px] font-bold text-navy/50">
                    <input
                      type="checkbox"
                      checked={line.isLocallySourced}
                      onChange={() => toggleLocallySourced(line.productId)}
                      className="size-3.5 accent-blue"
                    />
                    <Store className="size-3 flex-none" aria-hidden="true" />
                    Sourced from another shop
                  </label>

                  {line.isLocallySourced && (
                    <div className="mt-2 space-y-2 rounded-md bg-cream-dark/60 p-2.5">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-navy/50">Cost paid</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.localCost}
                          onChange={(e) => updateLocalCost(line.productId, e.target.value)}
                          placeholder="0.00"
                          className="mt-1 w-full rounded-md border border-navy/15 px-2.5 py-1.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                        />
                      </label>
                      <div>
                        <span className="text-[11px] font-semibold text-navy/50">Local Supplier</span>
                        <div className="mt-1 flex gap-1.5">
                          <select
                            value={line.localSupplierId ?? ""}
                            onChange={(e) => updateLocalSupplier(line.productId, e.target.value || null)}
                            className="h-9 w-full rounded-md border border-navy/15 bg-white px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                          >
                            <option value="">Select a supplier…</option>
                            {suppliers.map((supplier) => (
                              <option key={supplier.id} value={supplier.id}>
                                {supplier.businessName}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setQuickCreateSupplierFor(line.productId)}
                            className="grid h-9 w-9 flex-none place-items-center rounded-md border border-navy/15 text-navy/60"
                          >
                            <Plus className="size-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cart.length > 0 && (
        <div className="px-4 pb-2">
          <label className="block">
            <span className="text-[11px] font-semibold text-navy/50">Notes to order</span>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Optional notes for this sale"
              rows={2}
              className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </label>
        </div>
      )}

      {cart.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-navy/10 bg-white p-4 shadow-[0_-4px_16px_rgba(8,42,143,0.08)]">
          {taxAmountCents > 0 && (
            <>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-navy/50">Subtotal</span>
                <span className="text-xs font-semibold text-navy/50">{formatCents(netSubtotalCents, currency)}</span>
              </div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-navy/50">Tax</span>
                <span className="text-xs font-semibold text-navy/50">{formatCents(taxAmountCents, currency)}</span>
              </div>
            </>
          )}
          {deliveryFeeCents > 0 && (
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-navy/50">Delivery Fee</span>
              <span className="text-xs font-semibold text-navy/50">{formatCents(deliveryFeeCents, currency)}</span>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-navy/60">Total</span>
            <span className="font-display text-lg text-navy">{formatCents(grandTotalCents, currency)}</span>
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <select
              value={paymentMethodId}
              onChange={(e) => setPaymentMethodId(e.target.value)}
              className="rounded-lg border border-navy/15 bg-white px-2.5 py-2 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
            >
              {(paymentMethods ?? []).map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amountReceived}
              onChange={(e) => setAmountReceived(e.target.value)}
              placeholder="Amount received"
              className="rounded-lg border border-navy/15 px-2.5 py-2 text-right text-xs font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </div>

          {selectedPaymentMethod?.requiresReference && (
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder={`${selectedPaymentMethod.name} reference`}
              className="mb-2 w-full rounded-lg border border-navy/15 px-2.5 py-2 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
            />
          )}

          {amountReceivedCents > 0 && changeCents >= 0 && (
            <p className="mb-2 text-right text-xs font-semibold text-navy/50">Change: {formatCents(changeCents, currency)}</p>
          )}

          {submitError && <p className="mb-2 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{submitError}</p>}

          <button
            type="button"
            onClick={() => void handleCheckout()}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting ? "Completing sale…" : `Charge ${formatCents(grandTotalCents, currency)}`}
          </button>
        </div>
      )}

      {customerPickerOpen && (
        <CheckoutCustomerPickerModal
          customers={customers}
          selectedCustomerId={customerId}
          onSelect={(id) => {
            setCustomerId(id);
            setCustomerPickerOpen(false);
          }}
          onCustomerCreated={(customer) => setCustomers((prev) => [...prev, customer])}
          onClose={() => setCustomerPickerOpen(false)}
        />
      )}

      {deliveryModalOpen && (
        <CheckoutDeliveryModal
          initialDraft={delivery ?? emptyDeliveryDraft(customerLabel !== "Walk-in Customer" ? customerLabel : "")}
          riders={riders}
          onRiderCreated={(rider) => setRiders((prev) => [...prev, rider])}
          onSave={(draft) => {
            setDelivery(draft);
            setDeliveryModalOpen(false);
          }}
          onRemove={
            delivery
              ? () => {
                  setDelivery(null);
                  setDeliveryModalOpen(false);
                }
              : null
          }
          onClose={() => setDeliveryModalOpen(false)}
        />
      )}

      {quickCreateSupplierFor && (
        <QuickCreateSupplierModal
          onClose={() => setQuickCreateSupplierFor(null)}
          onCreated={(supplier) => {
            setSuppliers((prev) => [...prev, supplier]);
            updateLocalSupplier(quickCreateSupplierFor, supplier.id);
            setQuickCreateSupplierFor(null);
          }}
        />
      )}

      {completedSaleId && (
        <DocumentDetailModal
          saleId={completedSaleId}
          onClose={() => {
            setCompletedSaleId(null);
            resetForNextSale();
          }}
        />
      )}
    </div>
  );
}

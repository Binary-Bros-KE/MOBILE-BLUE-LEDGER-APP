"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, Minus, Plus, Search, ShoppingCart, Trash2, Truck, UserRound, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { formatCents } from "@/lib/money";
import { computeLineTax, resolveProductTaxConfig, type TenantTaxConfig } from "@/lib/tax";
import type { CheckoutCartLine, MobileCustomer, MobileRider, PaymentMethodOption, ProductListItem } from "@/lib/types";
import { DocumentDetailModal } from "../DocumentDetailModal";
import { CheckoutCustomerPickerModal } from "./CheckoutCustomerPickerModal";
import { CheckoutDeliveryModal, emptyDeliveryDraft, type DeliveryDraft } from "./CheckoutDeliveryModal";

/**
 * Real, from-scratch mobile checkout — the counterpart to DESKTOP's Checkout screen. Customer
 * selection (CheckoutCustomerPickerModal) and delivery (CheckoutDeliveryModal) match DESKTOP's own
 * Checkout feature set; deliberately still lighter in other ways (no wholesale price break, no
 * cashier price override, no service charges, no customer credit yet — see
 * mobile-checkout-service.ts's own doc comment for what's covered). Delivery is a MODAL here rather
 * than DESKTOP's inline expanding panel (ExtraChargesSection) — a deliberate mobile-specific choice,
 * screen space is tighter here than on a desktop POS screen. Every figure shown here is a PREVIEW
 * only: SERVER re-fetches the real Product rows and recomputes pricing/tax/stock validation from
 * scratch at submit time, so this component never needs to duplicate DESKTOP's full
 * cart-pricing.ts logic — just enough to show the cashier a running total before they commit.
 *
 * Always scoped to the signed-in employee's own branch (branchId/branchName come from /mobile/me,
 * not a picker) — mobile-checkout-service.ts rejects any other locationId outright, matching
 * DESKTOP's own requireActiveSession for a branch-scoped employee.
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CheckoutCartLine[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [amountReceived, setAmountReceived] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryDraft | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);

  // Minted ONCE per checkout attempt, resent unchanged on any retry — this is the whole idempotency
  // mechanism (see mobile-checkout-service.ts). Only regenerated after a sale actually completes or
  // the cart is cleared, never on every render.
  const checkoutIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    Promise.all([api.listProducts(), api.listPaymentMethods(), api.listCustomers(), api.listRiders()])
      .then(([productList, methods, customerList, riderList]) => {
        setProducts(productList);
        setPaymentMethods(methods);
        setCustomers(customerList);
        setRiders(riderList);
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
  const lineTaxResults = cart.map((line) => {
    const taxableCents = line.unitPriceCents * line.quantity - line.discountAmountCents;
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

  function removeLine(productId: string): void {
    setCart((prev) => prev.filter((line) => line.productId !== productId));
  }

  function resetForNextSale(): void {
    setCart([]);
    setPaymentReference("");
    setAmountReceived("");
    setCustomerId(null);
    setDelivery(null);
    checkoutIdRef.current = crypto.randomUUID();
  }

  async function handleCheckout(): Promise<void> {
    if (!branchId) {
      setSubmitError("Your account has no assigned storefront — ask your Super Admin to set one.");
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
        locationId: branchId,
        items: cart.map((line) => ({ productId: line.productId, quantity: line.quantity, discountAmountCents: line.discountAmountCents })),
        paymentMethodId,
        paymentReference: paymentReference.trim() || undefined,
        customerId: customerId ?? undefined,
        amountReceivedCents,
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

  if (!branchId) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm font-semibold text-navy/60">
          Your account has no assigned storefront yet — ask your Super Admin to assign one before you can sell here.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-32">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-navy/50">
          Selling from <span className="font-bold text-navy">{branchName}</span>
        </p>
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
          <button
            type="button"
            onClick={() => setDeliveryModalOpen(true)}
            className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-blue/30 bg-blue/5 px-3 py-2.5 text-left"
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
          </button>
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
            {cart.map((line, index) => (
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
                <div className="mt-2 flex items-center justify-between gap-2">
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
              </div>
            ))}
          </div>
        )}
      </div>

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

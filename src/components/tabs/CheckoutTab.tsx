"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Minus, PauseCircle, Plus, Receipt, ScanLine, Search, ShoppingCart, Store, Trash2, Truck, UserRound, X } from "lucide-react";
import { api, ApiError, isOfflineError } from "@/lib/api";
import { effectiveUnitPriceCents, naturalUnitPriceCents, serviceChargeDraftsToInputs, sumServiceChargeDraftFeeCents } from "@/lib/cart-totals";
import { formatCents, unitCostToTotalCents } from "@/lib/money";
import { computeLineTax, resolveProductTaxConfig, type TenantTaxConfig } from "@/lib/tax";
import type { CheckoutCartLine, CheckoutRequest, MobileCustomer, MobileLocation, MobileRider, MobileSupplier, PaymentMethodOption, ProductListItem, ServiceChargeDraft } from "@/lib/types";
import { findPickByCode } from "@/lib/barcode";
import { loadWithOfflineFallback } from "@/lib/offline-cache";
import { enqueueSale } from "@/lib/sales-outbox";
import { discardParkedSale, listParkedSales, parkSale, takeParkedSale, type ParkedSale } from "@/lib/parked-sales";
import { addPickToCart, needsVariantPicker, plainPick, type VariantPick } from "@/lib/variants";
import { CheckoutPaymentSheet, type CheckoutPaymentEntry } from "../checkout/CheckoutPaymentSheet";
import { ParkedSalesSheet } from "../checkout/ParkedSalesSheet";
import { BarcodeScannerSheet, cameraScanSupported } from "../BarcodeScannerSheet";
import { DocumentDetailModal } from "../DocumentDetailModal";
import { VariantPickerSheet } from "../VariantPickerSheet";
import { ServiceChargesModal } from "../ServiceChargesModal";
import { QuickCreateSupplierModal } from "../QuickCreateSupplierModal";
import { CheckoutCustomerPickerModal } from "./CheckoutCustomerPickerModal";
import { CheckoutDeliveryModal, emptyDeliveryDraft, type DeliveryDraft } from "./CheckoutDeliveryModal";

/**
 * Real, from-scratch mobile checkout — the counterpart to DESKTOP's Checkout screen. Customer
 * selection, delivery, service charges, wholesale price breaks, price override (mark-up),
 * locally-sourced items, and order notes all match DESKTOP's own Checkout feature set; deliberately
 * still lighter in one way (no customer credit yet — see mobile-checkout-service.ts's own doc comment
 * for what's covered). Delivery is a MODAL here rather than DESKTOP's inline expanding
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
  defaultIncludeBusinessInfo,
}: {
  branchId: string | null;
  branchName: string | null;
  currency: string;
  tenantTaxConfig: TenantTaxConfig;
  /** See InvoiceFormModal's identical prop for the same reasoning — the active storefront's own
   * configured default, null/undefined falls back to true. */
  defaultIncludeBusinessInfo?: boolean | null;
}) {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[] | null>(null);
  const [customers, setCustomers] = useState<MobileCustomer[]>([]);
  const [riders, setRiders] = useState<MobileRider[]>([]);
  const [suppliers, setSuppliers] = useState<MobileSupplier[]>([]);
  const [quickCreateSupplierFor, setQuickCreateSupplierFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [variantPickerFor, setVariantPickerFor] = useState<ProductListItem | null>(null);
  const [cart, setCart] = useState<CheckoutCartLine[]>([]);
  const [orderNotes, setOrderNotes] = useState("");
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [parkedSheetOpen, setParkedSheetOpen] = useState(false);
  // Bumped after every park/resume/discard so the derived list below re-reads storage.
  const [parkedVersion, setParkedVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  /** Set when the lists came from this phone's offline copy rather than the server. */
  const [usingOfflineData, setUsingOfflineData] = useState<string | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanMiss, setScanMiss] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [completedSaleId, setCompletedSaleId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryDraft | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [serviceCharges, setServiceCharges] = useState<ServiceChargeDraft[]>([]);
  const [serviceChargesModalOpen, setServiceChargesModalOpen] = useState(false);
  const [includeTaxBreakdown, setIncludeTaxBreakdown] = useState(true);
  const [includeBusinessInfo, setIncludeBusinessInfo] = useState(defaultIncludeBusinessInfo ?? true);

  // Only ever consulted when branchId is null (see the StorefrontPicker below) — otherwise SERVER
  // always uses the employee's own assigned branch regardless of this value.
  const [storefronts, setStorefronts] = useState<MobileLocation[] | null>(null);
  const [storefrontId, setStorefrontId] = useState("");
  const effectiveLocationId = branchId ?? (storefrontId || null);

  // Checkout only ever sells from the cashier's own branch (mobile-checkout-service.ts rejects any
  // other locationId server-side — see this component's own doc comment), so the stock shown here
  // must be that ONE location's own quantity, never product.totalQuantity (Main Store + every
  // storefront combined) — a real field bug: a cashier at Branch A was seeing Branch A's stock
  // inflated by however much sat at Branch B and Main Store, with no way to tell the difference.
  // Falls back to 0 (not totalQuantity) when effectiveLocationId is still unresolved (a branch-less
  // employee who hasn't picked a storefront yet) or the product has no row at all for this location.
  function stockAtEffectiveLocation(product: ProductListItem): number {
    if (!effectiveLocationId) return 0;
    return product.storefrontBreakdown.find((row) => row.locationId === effectiveLocationId)?.quantity ?? 0;
  }

  // Minted ONCE per checkout attempt, resent unchanged on any retry — this is the whole idempotency
  // mechanism (see mobile-checkout-service.ts). Only regenerated after a sale actually completes or
  // the cart is cleared, never on every render.
  const checkoutIdRef = useRef(crypto.randomUUID());

  useEffect(() => {
    if (branchId) return;
    loadWithOfflineFallback("storefronts", () => api.listStorefronts(), isOfflineError)
      .then((r) => setStorefronts(r.data))
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load storefronts."));
  }, [branchId]);

  useEffect(() => {
    // Every list falls back to this phone's last saved copy when offline, so the till keeps selling.
    Promise.all([
      loadWithOfflineFallback("products", () => api.listProducts(), isOfflineError),
      loadWithOfflineFallback("paymentMethods", () => api.listPaymentMethods(), isOfflineError),
      loadWithOfflineFallback("customers", () => api.listCustomers(), isOfflineError),
      loadWithOfflineFallback("riders", () => api.listRiders(), isOfflineError),
      loadWithOfflineFallback("suppliers", () => api.listSuppliers(), isOfflineError),
    ])
      .then(([productList, methods, customerList, riderList, supplierList]) => {
        setProducts(productList.data);
        setPaymentMethods(methods.data);
        setCustomers(customerList.data);
        setRiders(riderList.data);
        setSuppliers(supplierList.data);
        if (productList.fromCache) setUsingOfflineData("Offline — showing the products and prices saved on this phone.");
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load products or payment methods."));
  }, []);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return products
      .filter((p) => p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || (p.barcode?.toLowerCase().includes(term) ?? false))
      .slice(0, 12);
  }, [products, search]);

  // grossCents (per line) is what actually gets charged — already includes tax whether it's baked
  // into the product's own price (inclusive) or added on top (exclusive). Summing THIS, not the raw
  // pre-tax subtotal, is what must drive the Total shown/charged/validated below: SERVER's own
  // grandTotalCents (mobile-checkout-service.ts) is computed the exact same way, and a preview that
  // omitted tax meant a cashier could type exactly what this screen showed and still have the sale
  // rejected as underpaid (caught live: a tax-exclusive product's real total was always higher than
  // this naive sum — 2026-08-25).
  // effectiveUnitPriceCents (override, or wholesale once quantity crosses the product's own
  // threshold, or else the retail price) drives every downstream figure for this line — the tax
  // computation, the below-minimum check, and the line total shown. Imported from cart-totals.ts
  // (not duplicated locally) so this can never drift from what CartItemsEditor's Invoice/Quotation
  // forms compute for the identical line shape.
  const lineTaxResults = cart.map((line) => {
    const taxableCents = effectiveUnitPriceCents(line) * line.quantity - line.discountAmountCents;
    const productTaxConfig = resolveProductTaxConfig({ pricesTaxInclusive: line.pricesTaxInclusive }, tenantTaxConfig);
    return computeLineTax(taxableCents, line.taxType, productTaxConfig);
  });
  const netSubtotalCents = lineTaxResults.reduce((sum, r) => sum + r.netCents, 0);
  const taxAmountCents = lineTaxResults.reduce((sum, r) => sum + r.taxCents, 0);
  // Delivery fee + service charge fees fold straight into the grand total — matching SERVER's own
  // mobile-checkout-service (which validates amountReceivedCents against this SAME inclusive figure),
  // so a cashier collecting either is never shown/charged a total that's short of what checkout will
  // actually enforce.
  const deliveryFeeCents = delivery?.fee.trim() ? Math.round(Number(delivery.fee) * 100) : 0;
  const serviceChargeFeeCents = sumServiceChargeDraftFeeCents(serviceCharges);
  const grandTotalCents = lineTaxResults.reduce((sum, r) => sum + r.grossCents, 0) + deliveryFeeCents + serviceChargeFeeCents;

  const customerLabel = customerId ? (customers.find((c) => c.id === customerId)?.name ?? "Walk-in Customer") : "Walk-in Customer";

  // submitError is only ever SET by a failed submit — clear it the moment the cart or anything else
  // that could have caused it changes, so a stale banner never reads as "still blocked".
  useEffect(() => {
    setSubmitError(null);
  }, [cart, customerId, delivery, serviceCharges]);

  // Parked carts are per storefront (and per phone) — re-read whenever the storefront changes or a
  // park/resume/discard bumps parkedVersion.
  const parkedSales: ParkedSale[] = useMemo(
    () => (effectiveLocationId ? listParkedSales(effectiveLocationId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parkedVersion is the storage-change signal
    [effectiveLocationId, parkedVersion],
  );

  /** A product with variants asks which one first (VariantPickerSheet). */
  function addToCart(product: ProductListItem): void {
    setSearch("");
    if (needsVariantPicker(product, products ?? [])) {
      setVariantPickerFor(product);
      return;
    }
    setCart((prev) => addPickToCart(prev, plainPick(product)));
  }

  function addPick(pick: VariantPick): void {
    setVariantPickerFor(null);
    setCart((prev) => addPickToCart(prev, pick));
  }

  /** A scanned or typed code: an exact barcode/SKU (product or shared variant) goes straight into the
   * cart — scanning the same item again just bumps its quantity. */
  function addByCode(code: string): boolean {
    const pick = findPickByCode(products ?? [], code);
    if (!pick) {
      setScanMiss(code.trim());
      return false;
    }
    setScanMiss(null);
    setSearch("");
    if (pick.variantKey === null && needsVariantPicker(pick.product, products ?? [])) {
      setVariantPickerFor(pick.product);
    } else {
      setCart((prev) => addPickToCart(prev, pick));
    }
    return true;
  }

  /** Bluetooth/USB scanners type the code and press Enter — so does a person typing a SKU. Enter adds
   * an exact code match, or the only search result when there's just one. */
  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key !== "Enter" || !search.trim()) return;
    e.preventDefault();
    if (findPickByCode(products ?? [], search)) {
      addByCode(search);
    } else if (filteredProducts.length === 1) {
      addToCart(filteredProducts[0]!);
    } else {
      setScanMiss(search.trim());
    }
  }

  function updateQuantity(lineId: string, quantity: number): void {
    if (quantity < 1) return;
    setCart((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, quantity } : line)));
  }

  function updateDiscount(lineId: string, discountText: string): void {
    const discountAmountCents = discountText.trim() ? Math.round(Number(discountText) * 100) : 0;
    setCart((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, discountAmountCents } : line)));
  }

  function updatePriceOverride(lineId: string, value: string): void {
    setCart((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, priceOverride: value } : line)));
  }

  function toggleLocallySourced(lineId: string): void {
    setCart((prev) =>
      prev.map((line) =>
        line.lineId === lineId
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

  function updateLocalCost(lineId: string, value: string): void {
    setCart((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, localCost: value } : line)));
  }

  function updateLocalSupplier(lineId: string, supplierId: string | null): void {
    setCart((prev) => prev.map((line) => (line.lineId === lineId ? { ...line, localSupplierId: supplierId } : line)));
  }

  function removeLine(lineId: string): void {
    setCart((prev) => prev.filter((line) => line.lineId !== lineId));
  }

  function resetForNextSale(): void {
    setCart([]);
    setCustomerId(null);
    setDelivery(null);
    setServiceCharges([]);
    setOrderNotes("");
    checkoutIdRef.current = crypto.randomUUID();
  }

  /** Puts the current cart aside (device-local, like DESKTOP's held sales) and clears the counter for
   * the next customer. */
  function parkCurrentSale(): void {
    if (!effectiveLocationId || cart.length === 0) return;
    parkSale({
      locationId: effectiveLocationId,
      label: customerId ? customerLabel : `${cart[0]!.name}${cart.length > 1 ? ` +${cart.length - 1} more` : ""}`,
      cart,
      customerId,
      delivery,
      serviceCharges,
      orderNotes,
    });
    resetForNextSale();
    setParkedVersion((v) => v + 1);
    setNotice("Sale parked — resume it from Parked.");
  }

  /** Resuming parks whatever is on the counter first, so nothing is ever thrown away. */
  function resumeParkedSale(id: string): void {
    if (!effectiveLocationId) return;
    if (cart.length > 0) parkCurrentSale();
    const parked = takeParkedSale(id);
    if (parked) {
      setCart(parked.cart);
      setCustomerId(parked.customerId);
      setDelivery(parked.delivery as DeliveryDraft | null);
      setServiceCharges(parked.serviceCharges);
      setOrderNotes(parked.orderNotes);
      checkoutIdRef.current = crypto.randomUUID();
      setNotice(null);
    }
    setParkedVersion((v) => v + 1);
    setParkedSheetOpen(false);
  }

  function cartItemsPayload() {
    return cart.map((line) => ({
          productId: line.productId,
          variantKey: line.variantKey,
          quantity: line.quantity,
          discountAmountCents: line.discountAmountCents,
          unitPriceCents: line.priceOverride.trim() ? Math.round(Number(line.priceOverride) * 100) : undefined,
          isLocallySourced: line.isLocallySourced,
          // line.localCost is what the cashier typed as the PER-UNIT cost — localCostCents itself is
          // still stored/reported as the line's total (see money.ts's own doc comment), so multiply
          // here rather than changing anything downstream.
          localCostCents: line.isLocallySourced && line.localCost.trim() ? unitCostToTotalCents(line.localCost, line.quantity) : undefined,
          localSupplierId: line.isLocallySourced ? (line.localSupplierId ?? undefined) : undefined,
    }));
  }

  function deliveryPayload() {
    return delivery
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
      : undefined;
  }

  function openPaymentSheet(): void {
    if (!effectiveLocationId) {
      setSubmitError("Choose a storefront before completing this sale.");
      return;
    }
    if (cart.length === 0) {
      setSubmitError("Add at least one item first.");
      return;
    }
    setSubmitError(null);
    setPaymentSheetOpen(true);
  }

  /** One entry = a normal single-method sale; 2+ = a split payment (SERVER's buildSplitPayments). */
  async function handleCheckout(payments: CheckoutPaymentEntry[]): Promise<void> {
    if (!effectiveLocationId) return;
    const primary = payments[0]!;
    const request: CheckoutRequest = {
      id: checkoutIdRef.current,
      locationId: effectiveLocationId,
      items: cartItemsPayload(),
      paymentMethodId: primary.paymentMethodId,
      paymentReference: primary.reference || undefined,
      customerId: customerId ?? undefined,
      amountReceivedCents: payments.reduce((sum, p) => sum + p.amountCents, 0),
      payments:
        payments.length > 1
          ? payments.map((p) => ({ paymentMethodId: p.paymentMethodId, amountCents: p.amountCents, reference: p.reference || undefined }))
          : undefined,
      notes: orderNotes.trim() || undefined,
      includeTaxBreakdown,
      includeBusinessInfo,
      serviceCharges: serviceChargeDraftsToInputs(serviceCharges),
      delivery: deliveryPayload(),
    };
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.checkout(request);
      setPaymentSheetOpen(false);
      setCompletedSaleId(result.id);
    } catch (err) {
      if (isOfflineError(err)) {
        saveSaleOffline(request);
        return;
      }
      // Deliberately NOT resetting checkoutIdRef here — a retry (network error, timeout) must reuse
      // the SAME id so SERVER treats it as the safe no-op it's designed to be, not a second sale.
      setSubmitError(err instanceof ApiError ? err.message : "Checkout failed — check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * No connection: keep the sale on this phone (lib/sales-outbox.ts) and let the cashier carry on —
   * OfflineStatusBar sends it once the phone is back online. Every line's price is pinned to what the
   * customer was actually charged here, so SERVER can't re-price it later; SERVER also accepts it if
   * stock ran short meanwhile (the goods already left) and dates it to now, the real sale time.
   */
  function saveSaleOffline(request: CheckoutRequest): void {
    const pinned: CheckoutRequest = {
      ...request,
      items: request.items.map((item, index) => ({ ...item, unitPriceCents: effectiveUnitPriceCents(cart[index]!) })),
      queuedOffline: true,
      offlineCompletedAt: new Date().toISOString(),
    };
    const label = `${customerId ? customerLabel : "Walk-in"} · ${cart.reduce((sum, l) => sum + l.quantity, 0)} item(s)`;
    if (!enqueueSale(pinned, { label, totalCents: grandTotalCents })) {
      setSubmitError("You're offline and this phone couldn't save the sale — don't hand over the goods until it goes through.");
      return;
    }
    setPaymentSheetOpen(false);
    resetForNextSale();
    setNotice(`Offline — sale of ${formatCents(grandTotalCents, currency)} saved on this phone. It will sync automatically.`);
  }

  /** "Put on account" — the cart becomes an invoice for the selected customer (DESKTOP's way of
   * selling on credit). Reuses this checkout's id so a retry can't create a second invoice. */
  async function handlePutOnAccount(dueDate: string): Promise<void> {
    if (!effectiveLocationId || !customerId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await api.createInvoice({
        id: checkoutIdRef.current,
        customerId,
        transactionType: "invoice",
        dueDate,
        invoiceNotes: orderNotes.trim() || undefined,
        includeTaxBreakdown,
        includeBusinessInfo,
        items: cartItemsPayload(),
        delivery: deliveryPayload(),
        serviceCharges: serviceChargeDraftsToInputs(serviceCharges),
        locationId: effectiveLocationId,
      });
      setPaymentSheetOpen(false);
      setCompletedSaleId(result.id);
    } catch (err) {
      setSubmitError(
        isOfflineError(err)
          ? "Putting a sale on account needs an internet connection — take payment now, or try again when back online."
          : err instanceof ApiError
            ? err.message
            : "Couldn't put this on account — check your connection and try again.",
      );
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

      {(parkedSales.length > 0 || notice) && (
        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          {notice ? <p className="text-xs font-semibold text-green">{notice}</p> : <span />}
          {parkedSales.length > 0 && (
            <button
              type="button"
              onClick={() => setParkedSheetOpen(true)}
              className="flex flex-none items-center gap-1 rounded-full bg-gold/15 px-3 py-1 text-xs font-bold text-gold-text"
            >
              <PauseCircle className="size-3.5" aria-hidden="true" />
              Parked ({parkedSales.length})
            </button>
          )}
        </div>
      )}

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

        {serviceCharges.length > 0 ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => setServiceChargesModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setServiceChargesModalOpen(true);
            }}
            className="mt-1.5 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-blue/30 bg-blue/5 px-3 py-2.5 text-left"
          >
            <Receipt className="size-4 flex-none text-blue" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy">
              {serviceCharges.length} service charge{serviceCharges.length > 1 ? "s" : ""}
              {serviceChargeFeeCents > 0 && <span className="text-navy/50"> · {formatCents(serviceChargeFeeCents, currency)}</span>}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setServiceCharges([]);
              }}
              aria-label="Remove service charges"
              className="grid size-6 flex-none place-items-center rounded-full text-navy/40 hover:bg-white hover:text-red"
            >
              <X className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setServiceChargesModalOpen(true)}
            className="mt-1.5 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-navy/15 bg-white px-3 py-2.5 text-left"
          >
            <Receipt className="size-4 flex-none text-navy/40" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy/50">Add a service charge</span>
            <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
          </button>
        )}
      </div>

      {usingOfflineData && <p className="mx-4 mb-2 rounded border border-gold/40 bg-gold/10 px-3 py-2 text-xs font-semibold text-gold-text">{usingOfflineData}</p>}
      {loadError && <p className="mx-4 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{loadError}</p>}

      <div className="px-4 py-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-navy/30" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setScanMiss(null);
              }}
              onKeyDown={handleSearchKeyDown}
              enterKeyHint="search"
              placeholder="Search or scan products…"
              className="w-full rounded-lg border border-navy/15 bg-white py-2.5 pl-9 pr-3 text-sm text-navy placeholder:text-navy/30 focus:border-blue focus:outline-none"
            />
          </div>
          {cameraScanSupported() && (
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              aria-label="Scan a barcode with the camera"
              className="grid size-[42px] flex-none place-items-center rounded-lg bg-navy text-white"
            >
              <ScanLine className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
        {scanMiss && <p className="mt-1.5 text-xs font-semibold text-red">No product with code &ldquo;{scanMiss}&rdquo;.</p>}
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
                    {product.sku} · {stockAtEffectiveLocation(product)} in stock
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
              const naturalPriceCents = naturalUnitPriceCents(line);
              const wholesaleActive = naturalPriceCents !== line.unitPriceCents;
              return (
                <div key={line.lineId} className="rounded-lg border border-navy/10 bg-white p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-navy">{line.name}</p>
                      <p className="text-[11px] text-navy/50">
                        @ {formatCents(naturalPriceCents, currency)}
                        {wholesaleActive && <span className="ml-1 font-bold text-blue">Wholesale</span>}
                      </p>
                    </div>
                    <button type="button" onClick={() => removeLine(line.lineId)} aria-label={`Remove ${line.name}`} className="flex-none text-navy/30 hover:text-red">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        className="grid size-7 place-items-center rounded-md border border-navy/15 text-navy/60 disabled:opacity-30"
                      >
                        <Minus className="size-3" aria-hidden="true" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-navy">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
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
                        onChange={(e) => updatePriceOverride(line.lineId, e.target.value)}
                        placeholder={(naturalPriceCents / 100).toFixed(2)}
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
                        onChange={(e) => updateDiscount(line.lineId, e.target.value)}
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
                      onChange={() => toggleLocallySourced(line.lineId)}
                      className="size-3.5 accent-blue"
                    />
                    <Store className="size-3 flex-none" aria-hidden="true" />
                    Sourced from another shop
                  </label>

                  {line.isLocallySourced && (
                    <div className="mt-2 space-y-2 rounded-md bg-cream-dark/60 p-2.5">
                      <label className="block">
                        <span className="text-[11px] font-semibold text-navy/50">Unit Cost</span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={line.localCost}
                          onChange={(e) => updateLocalCost(line.lineId, e.target.value)}
                          placeholder="0.00"
                          className="mt-1 w-full rounded-md border border-navy/15 px-2.5 py-1.5 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
                        />
                      </label>
                      {line.localCost.trim() && (
                        <p className="text-[10px] font-semibold text-navy/40">
                          Total for {line.quantity}: {formatCents(unitCostToTotalCents(line.localCost, line.quantity), currency)}
                        </p>
                      )}
                      <div>
                        <span className="text-[11px] font-semibold text-navy/50">Local Supplier</span>
                        <div className="mt-1 flex gap-1.5">
                          <select
                            value={line.localSupplierId ?? ""}
                            onChange={(e) => updateLocalSupplier(line.lineId, e.target.value || null)}
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
                            onClick={() => setQuickCreateSupplierFor(line.lineId)}
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
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-h,0px)_+_env(safe-area-inset-bottom))] z-20 border-t border-navy/10 bg-white p-4 shadow-[0_-4px_16px_rgba(8,42,143,0.08)]">
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
          {serviceChargeFeeCents > 0 && (
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-semibold text-navy/50">Service Charges</span>
              <span className="text-xs font-semibold text-navy/50">{formatCents(serviceChargeFeeCents, currency)}</span>
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-semibold text-navy/60">Total</span>
            <span className="font-display text-lg text-navy">{formatCents(grandTotalCents, currency)}</span>
          </div>

          <div className="mb-2 flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-navy/60">
              <input type="checkbox" checked={includeTaxBreakdown} onChange={(e) => setIncludeTaxBreakdown(e.target.checked)} className="size-3.5 accent-blue" />
              Include tax info
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-navy/60">
              <input type="checkbox" checked={includeBusinessInfo} onChange={(e) => setIncludeBusinessInfo(e.target.checked)} className="size-3.5 accent-blue" />
              Include shop info
            </label>
          </div>

          {submitError && !paymentSheetOpen && (
            <p className="mb-2 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{submitError}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={parkCurrentSale}
              disabled={!effectiveLocationId}
              className="flex flex-none items-center justify-center gap-1.5 rounded-lg border border-navy/20 px-4 py-3 text-sm font-bold text-navy disabled:opacity-40"
            >
              <PauseCircle className="size-4" aria-hidden="true" />
              Park
            </button>
            <button
              type="button"
              onClick={openPaymentSheet}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white"
            >
              Charge {formatCents(grandTotalCents, currency)}
            </button>
          </div>
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

      {serviceChargesModalOpen && (
        <ServiceChargesModal
          initialDrafts={serviceCharges}
          onSave={(drafts) => {
            setServiceCharges(drafts);
            setServiceChargesModalOpen(false);
          }}
          onClose={() => setServiceChargesModalOpen(false)}
        />
      )}

      {variantPickerFor && (
        <VariantPickerSheet
          product={variantPickerFor}
          products={products ?? []}
          currency={currency}
          stockOf={stockAtEffectiveLocation}
          onPick={addPick}
          onClose={() => setVariantPickerFor(null)}
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

      {scannerOpen && (
        <BarcodeScannerSheet
          onDetected={(code) => {
            setScannerOpen(false);
            addByCode(code);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {paymentSheetOpen && (
        <CheckoutPaymentSheet
          grandTotalCents={grandTotalCents}
          currency={currency}
          paymentMethods={paymentMethods ?? []}
          customerName={customerId ? customerLabel : null}
          customerPhone={customerId ? (customers.find((c) => c.id === customerId)?.phone ?? null) : null}
          locationId={effectiveLocationId ?? ""}
          canPutOnAccount
          submitting={submitting}
          error={submitError}
          onCharge={(payments) => void handleCheckout(payments)}
          onPutOnAccount={(dueDate) => void handlePutOnAccount(dueDate)}
          onClose={() => setPaymentSheetOpen(false)}
        />
      )}

      {parkedSheetOpen && (
        <ParkedSalesSheet
          sales={parkedSales}
          currency={currency}
          onResume={resumeParkedSale}
          onDiscard={(id) => {
            discardParkedSale(id);
            setParkedVersion((v) => v + 1);
          }}
          onClose={() => setParkedSheetOpen(false)}
        />
      )}

      {completedSaleId && (
        <DocumentDetailModal
          saleId={completedSaleId}
          autoPrint
          onClose={() => {
            setCompletedSaleId(null);
            resetForNextSale();
          }}
        />
      )}
    </div>
  );
}

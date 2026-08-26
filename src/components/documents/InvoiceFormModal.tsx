"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Loader2, Receipt, Truck, UserRound, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { buildCartFromEditableItems, computeCartTotals, serviceChargeDraftsToInputs, serviceChargeInputsToDrafts, sumServiceChargeDraftFeeCents } from "@/lib/cart-totals";
import { formatCents } from "@/lib/money";
import type { TenantTaxConfig } from "@/lib/tax";
import type { CheckoutCartLine, MobileCustomer, MobileEditableDelivery, MobileRider, MobileSupplier, PaymentMethodOption, ProductListItem, ServiceChargeDraft } from "@/lib/types";
import { CheckboxField } from "../CheckboxField";
import { ServiceChargesModal } from "../ServiceChargesModal";
import { CheckoutCustomerPickerModal } from "../tabs/CheckoutCustomerPickerModal";
import { CheckoutDeliveryModal, emptyDeliveryDraft, type DeliveryDraft } from "../tabs/CheckoutDeliveryModal";
import { CartItemsEditor } from "./CartItemsEditor";

function deliveryDraftFromEditable(d: MobileEditableDelivery): DeliveryDraft {
  return {
    riderId: d.riderId,
    recipientName: d.recipientName,
    country: d.country,
    town: d.town,
    physicalAddress: d.physicalAddress,
    notes: d.notes,
    fee: d.feeCents > 0 ? (d.feeCents / 100).toFixed(2) : "",
    cost: d.costCents > 0 ? (d.costCents / 100).toFixed(2) : "",
  };
}

/** Creates a new Invoice, or edits an existing unpaid one when `editId` is given — a credit sale:
 * goods/services are considered delivered now, payment can follow over time. Mirrors DESKTOP's own
 * Invoice form: a customer is REQUIRED (unlike Checkout/Quotation's walk-in option — an invoice is a
 * credit document, needs someone real to bill), plus a due date. Reuses the exact same cart/
 * customer/delivery building blocks Checkout already established.
 *
 * Edit mode fetches GET /mobile/invoices/:id/edit (raw items — see MobileEditableItem, not the
 * display-only SharedDocument shape) and rebuilds the cart against CURRENT product data
 * (buildCartFromEditableItems) — matching what updateInvoice will actually re-validate against on
 * submit. The initial-payment section is hidden entirely in edit mode: DESKTOP's own updateInvoice
 * never touches payment (an edit is only reachable at all while amountPaidCents is still 0), so
 * there's nothing to collect here. */
export function InvoiceFormModal({
  branchId,
  branchName,
  currency,
  tenantTaxConfig,
  editId,
  defaultIncludeBusinessInfo,
  onClose,
  onCreated,
}: {
  branchId: string | null;
  branchName: string | null;
  currency: string;
  tenantTaxConfig: TenantTaxConfig;
  editId?: string;
  /** Only used on create — see Location["defaultIncludeBusinessInfo"]'s own doc comment. Edit mode
   * always reads the document's own already-saved includeBusinessInfo instead (see the edit-data
   * fetch below). Null/undefined (no storefront default, or none assigned yet) falls back to true. */
  defaultIncludeBusinessInfo?: boolean | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodOption[] | null>(null);
  const [customers, setCustomers] = useState<MobileCustomer[]>([]);
  const [riders, setRiders] = useState<MobileRider[]>([]);
  const [suppliers, setSuppliers] = useState<MobileSupplier[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(!editId);

  const [cart, setCart] = useState<CheckoutCartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"invoice" | "wholesale_sale">("invoice");
  const [dueDate, setDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [delivery, setDelivery] = useState<DeliveryDraft | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [serviceCharges, setServiceCharges] = useState<ServiceChargeDraft[]>([]);
  const [serviceChargesModalOpen, setServiceChargesModalOpen] = useState(false);
  const [includeTaxBreakdown, setIncludeTaxBreakdown] = useState(true);
  const [includeBusinessInfo, setIncludeBusinessInfo] = useState(defaultIncludeBusinessInfo ?? true);

  const [collectInitialPayment, setCollectInitialPayment] = useState(false);
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [initialPaymentAmount, setInitialPaymentAmount] = useState("");
  const [initialPaymentReference, setInitialPaymentReference] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Prefill waits for products to load first — buildCartFromEditableItems needs the CURRENT catalog
  // to resolve each line's live taxType/pricesTaxInclusive/minimumPriceCents, not just its own
  // frozen unitPriceCents.
  useEffect(() => {
    if (!editId || !products) return;
    api
      .getInvoiceEditData(editId)
      .then((data) => {
        setCustomerId(data.customerId);
        setTransactionType(data.transactionType);
        setDueDate(data.dueDate);
        setInvoiceNotes(data.invoiceNotes ?? "");
        setCart(buildCartFromEditableItems(data.items, products));
        setDelivery(data.delivery ? deliveryDraftFromEditable(data.delivery) : null);
        setServiceCharges(serviceChargeInputsToDrafts(data.serviceCharges));
        setIncludeTaxBreakdown(data.includeTaxBreakdown);
        setIncludeBusinessInfo(data.includeBusinessInfo);
        setPrefilled(true);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load this invoice for editing."));
  }, [editId, products]);

  const selectedPaymentMethod = paymentMethods?.find((m) => m.id === paymentMethodId) ?? null;
  const customerLabel = customerId ? (customers.find((c) => c.id === customerId)?.name ?? "") : "";
  const totals = computeCartTotals(cart, tenantTaxConfig);
  const deliveryFeeCents = delivery?.fee.trim() ? Math.round(Number(delivery.fee) * 100) : 0;
  const serviceChargeFeeCents = sumServiceChargeDraftFeeCents(serviceCharges);
  const grandTotalCents = totals.itemsGrandTotalCents + deliveryFeeCents + serviceChargeFeeCents;

  async function handleSubmit(): Promise<void> {
    if (!branchId) {
      setSubmitError("Choose a storefront first — your account has no branch assigned.");
      return;
    }
    if (!customerId) {
      setSubmitError("Select a customer — an invoice needs someone to bill.");
      return;
    }
    if (cart.length === 0) {
      setSubmitError("Add at least one item first.");
      return;
    }
    if (!dueDate) {
      setSubmitError("Choose a due date.");
      return;
    }
    if (!editId && collectInitialPayment) {
      if (!paymentMethodId) {
        setSubmitError("Choose a payment method for the initial payment.");
        return;
      }
      if (selectedPaymentMethod?.requiresReference && !initialPaymentReference.trim()) {
        setSubmitError(`${selectedPaymentMethod.name} requires a reference.`);
        return;
      }
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = {
        customerId,
        transactionType,
        dueDate,
        invoiceNotes: invoiceNotes.trim() || undefined,
        includeTaxBreakdown,
        includeBusinessInfo,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discountAmountCents: line.discountAmountCents,
          unitPriceCents: line.priceOverride.trim() ? Math.round(Number(line.priceOverride) * 100) : undefined,
          isLocallySourced: line.isLocallySourced,
          localCostCents: line.isLocallySourced && line.localCost.trim() ? Math.round(Number(line.localCost) * 100) : undefined,
          localSupplierId: line.isLocallySourced ? (line.localSupplierId ?? undefined) : undefined,
        })),
        initialPayment:
          !editId && collectInitialPayment && initialPaymentAmount.trim()
            ? { paymentMethodId, amountCents: Math.round(Number(initialPaymentAmount) * 100), reference: initialPaymentReference.trim() || undefined }
            : null,
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
        serviceCharges: serviceChargeDraftsToInputs(serviceCharges),
        locationId: branchId,
      };
      const result = editId ? await api.updateInvoice(editId, body) : await api.createInvoice(body);
      onCreated(result.id);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : `Failed to ${editId ? "save" : "create"} invoice — check your connection and try again.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-deep/60 sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl"
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <p className="font-display text-lg text-navy">{editId ? "Edit Invoice" : "New Invoice"}</p>
            {branchName && <p className="text-xs text-navy/50">Billed from {branchName}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 flex-none place-items-center rounded-full text-navy/40 hover:bg-cream-dark hover:text-navy">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5">
          {loadError && <p className="mb-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{loadError}</p>}
          {!prefilled && !loadError && <p className="py-10 text-center text-sm text-navy/50">Loading…</p>}

          {prefilled && (
          <>
          <button
            type="button"
            onClick={() => setCustomerPickerOpen(true)}
            className="mb-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-navy/15 bg-white px-3 py-2.5 text-left"
          >
            <UserRound className="size-4 flex-none text-blue" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy">{customerLabel || "Select a customer"}</span>
            <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
          </button>

          <div className="mb-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-semibold text-navy/50">Type</span>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as "invoice" | "wholesale_sale")}
                className="mt-1 h-9 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
              >
                <option value="invoice">Invoice</option>
                <option value="wholesale_sale">Wholesale Sale</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold text-navy/50">Due Date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 h-9 w-full rounded-lg border border-navy/15 bg-white px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
              />
            </label>
          </div>

          {delivery ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => setDeliveryModalOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setDeliveryModalOpen(true);
              }}
              className="mb-2 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-blue/30 bg-blue/5 px-3 py-2.5 text-left"
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
              className="mb-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-navy/15 bg-white px-3 py-2.5 text-left"
            >
              <Truck className="size-4 flex-none text-navy/40" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy/50">Add delivery for this invoice</span>
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
              className="mb-2 flex w-full cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-blue/30 bg-blue/5 px-3 py-2.5 text-left"
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
              className="mb-2 flex w-full items-center gap-1.5 rounded-lg border border-dashed border-navy/15 bg-white px-3 py-2.5 text-left"
            >
              <Receipt className="size-4 flex-none text-navy/40" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy/50">Add a service charge</span>
              <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
            </button>
          )}

          <CartItemsEditor
            products={products}
            cart={cart}
            onCartChange={setCart}
            suppliers={suppliers}
            onSuppliersChange={setSuppliers}
            currency={currency}
            tenantTaxConfig={tenantTaxConfig}
          />

          <label className="mt-3 block">
            <span className="text-[11px] font-semibold text-navy/50">Notes</span>
            <textarea
              value={invoiceNotes}
              onChange={(e) => setInvoiceNotes(e.target.value)}
              placeholder="Optional notes for this invoice"
              rows={2}
              className="mt-1 w-full rounded-lg border border-navy/15 bg-white px-3 py-2 text-sm font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </label>

          {cart.length > 0 && (
            <div className="mt-3 rounded-lg border border-dashed border-navy/15 bg-cream-dark/40 p-3">
              {totals.taxAmountCents > 0 && (
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-navy/50">
                  <span>Subtotal</span>
                  <span>{formatCents(totals.netSubtotalCents, currency)}</span>
                </div>
              )}
              {totals.taxAmountCents > 0 && (
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-navy/50">
                  <span>Tax</span>
                  <span>{formatCents(totals.taxAmountCents, currency)}</span>
                </div>
              )}
              {deliveryFeeCents > 0 && (
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-navy/50">
                  <span>Delivery Fee</span>
                  <span>{formatCents(deliveryFeeCents, currency)}</span>
                </div>
              )}
              {serviceChargeFeeCents > 0 && (
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-navy/50">
                  <span>Service Charges</span>
                  <span>{formatCents(serviceChargeFeeCents, currency)}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-navy/60">Total</span>
                <span className="font-display text-lg text-navy">{formatCents(grandTotalCents, currency)}</span>
              </div>
            </div>
          )}

          <CheckboxField
            label="Include tax information"
            description="Shows the Tax Breakdown section on this invoice's print, download, and share"
            checked={includeTaxBreakdown}
            onChange={setIncludeTaxBreakdown}
          />

          <CheckboxField
            label="Include storefront information"
            description="Shows the shop name, logo, address, contacts and header/footer text on this invoice"
            checked={includeBusinessInfo}
            onChange={setIncludeBusinessInfo}
          />

          {!editId && (
          <label className="mt-3 flex cursor-pointer items-center gap-1.5 text-xs font-bold text-navy/60">
            <input type="checkbox" checked={collectInitialPayment} onChange={() => setCollectInitialPayment((v) => !v)} className="size-3.5 accent-blue" />
            Collect an initial payment now
          </label>
          )}

          {!editId && collectInitialPayment && (
            <div className="mt-2 space-y-2 rounded-lg bg-cream-dark/60 p-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={paymentMethodId}
                  onChange={(e) => setPaymentMethodId(e.target.value)}
                  className="h-9 rounded-lg border border-navy/15 bg-white px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
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
                  value={initialPaymentAmount}
                  onChange={(e) => setInitialPaymentAmount(e.target.value)}
                  placeholder="Amount"
                  className="h-9 rounded-lg border border-navy/15 px-2.5 text-right text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                />
              </div>
              {selectedPaymentMethod?.requiresReference && (
                <input
                  type="text"
                  value={initialPaymentReference}
                  onChange={(e) => setInitialPaymentReference(e.target.value)}
                  placeholder={`${selectedPaymentMethod.name} reference`}
                  className="h-9 w-full rounded-lg border border-navy/15 px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
                />
              )}
            </div>
          )}

          {submitError && <p className="mt-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{submitError}</p>}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting ? (editId ? "Saving…" : "Creating…") : editId ? "Save Changes" : "Create Invoice"}
          </button>
          </>
          )}
        </div>
      </motion.div>

      {customerPickerOpen && (
        <CheckoutCustomerPickerModal
          customers={customers}
          selectedCustomerId={customerId}
          allowWalkIn={false}
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
          initialDraft={delivery ?? emptyDeliveryDraft(customerLabel)}
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
    </div>
  );
}

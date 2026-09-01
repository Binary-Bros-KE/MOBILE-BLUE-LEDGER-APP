"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Loader2, Receipt, Truck, UserRound, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { buildCartFromEditableItems, computeCartTotals, serviceChargeDraftsToInputs, serviceChargeInputsToDrafts, sumServiceChargeDraftFeeCents } from "@/lib/cart-totals";
import { formatCents, unitCostToTotalCents } from "@/lib/money";
import type { TenantTaxConfig } from "@/lib/tax";
import type { CheckoutCartLine, MobileCustomer, MobileEditableDelivery, MobileRider, MobileSupplier, ProductListItem, ServiceChargeDraft } from "@/lib/types";
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

/** Creates a new Quotation, or edits an existing draft when `editId` is given — a non-binding
 * proposal. No stock deducted/checked, no money collected (see mobile-quotations-service.ts's own
 * doc comment). Unlike Invoice, a walk-in (no customer) quotation is valid — matches DESKTOP
 * exactly.
 *
 * Edit mode fetches GET /mobile/quotations/:id/edit and rebuilds the cart against CURRENT product
 * data (buildCartFromEditableItems) — same reasoning as InvoiceFormModal's own edit mode. */
export function QuotationFormModal({
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
  /** Only used on create — see InvoiceFormModal's identical prop for the same reasoning. */
  defaultIncludeBusinessInfo?: boolean | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [products, setProducts] = useState<ProductListItem[] | null>(null);
  const [customers, setCustomers] = useState<MobileCustomer[]>([]);
  const [riders, setRiders] = useState<MobileRider[]>([]);
  const [suppliers, setSuppliers] = useState<MobileSupplier[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [prefilled, setPrefilled] = useState(!editId);

  const [cart, setCart] = useState<CheckoutCartLine[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [validUntil, setValidUntil] = useState("");
  const [notes, setNotes] = useState("");
  const [delivery, setDelivery] = useState<DeliveryDraft | null>(null);
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [serviceCharges, setServiceCharges] = useState<ServiceChargeDraft[]>([]);
  const [serviceChargesModalOpen, setServiceChargesModalOpen] = useState(false);
  const [includeTaxBreakdown, setIncludeTaxBreakdown] = useState(true);
  const [includeBusinessInfo, setIncludeBusinessInfo] = useState(defaultIncludeBusinessInfo ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.listProducts(), api.listCustomers(), api.listRiders(), api.listSuppliers()])
      .then(([productList, customerList, riderList, supplierList]) => {
        setProducts(productList);
        setCustomers(customerList);
        setRiders(riderList);
        setSuppliers(supplierList);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load products."));
  }, []);

  useEffect(() => {
    if (!editId || !products) return;
    api
      .getQuotationEditData(editId)
      .then((data) => {
        setCustomerId(data.customerId);
        setValidUntil(data.validUntil);
        setNotes(data.notes ?? "");
        setCart(buildCartFromEditableItems(data.items, products));
        setDelivery(data.delivery ? deliveryDraftFromEditable(data.delivery) : null);
        setServiceCharges(serviceChargeInputsToDrafts(data.serviceCharges));
        setIncludeTaxBreakdown(data.includeTaxBreakdown);
        setIncludeBusinessInfo(data.includeBusinessInfo);
        setPrefilled(true);
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : "Could not load this quotation for editing."));
  }, [editId, products]);

  const customerLabel = customerId ? (customers.find((c) => c.id === customerId)?.name ?? "") : "Walk-in Customer";
  const totals = computeCartTotals(cart, tenantTaxConfig);
  const deliveryFeeCents = delivery?.fee.trim() ? Math.round(Number(delivery.fee) * 100) : 0;
  const serviceChargeFeeCents = sumServiceChargeDraftFeeCents(serviceCharges);
  const grandTotalCents = totals.itemsGrandTotalCents + deliveryFeeCents + serviceChargeFeeCents;

  async function handleSubmit(): Promise<void> {
    if (!branchId) {
      setSubmitError("Choose a storefront first — your account has no branch assigned.");
      return;
    }
    if (cart.length === 0) {
      setSubmitError("Add at least one item first.");
      return;
    }
    if (!validUntil) {
      setSubmitError("Choose a valid-until date.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const body = {
        customerId: customerId ?? undefined,
        validUntil,
        notes: notes.trim() || undefined,
        includeTaxBreakdown,
        includeBusinessInfo,
        items: cart.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          discountAmountCents: line.discountAmountCents,
          unitPriceCents: line.priceOverride.trim() ? Math.round(Number(line.priceOverride) * 100) : undefined,
          isLocallySourced: line.isLocallySourced,
          // line.localCost is what the user typed as the PER-UNIT cost — localCostCents itself is
          // still stored/reported as the line's total (see money.ts's own doc comment), so multiply
          // here rather than changing anything downstream.
          localCostCents: line.isLocallySourced && line.localCost.trim() ? unitCostToTotalCents(line.localCost, line.quantity) : undefined,
          localSupplierId: line.isLocallySourced ? (line.localSupplierId ?? undefined) : undefined,
        })),
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
      const result = editId ? await api.updateQuotation(editId, body) : await api.createQuotation(body);
      onCreated(result.id);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : `Failed to ${editId ? "save" : "create"} quotation — check your connection and try again.`);
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
            <p className="font-display text-lg text-navy">{editId ? "Edit Quotation" : "New Quotation"}</p>
            {branchName && <p className="text-xs text-navy/50">From {branchName}</p>}
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
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-navy">{customerLabel}</span>
            <ChevronRight className="size-4 flex-none text-navy/30" aria-hidden="true" />
          </button>

          <label className="mb-2 block">
            <span className="text-[11px] font-semibold text-navy/50">Valid Until</span>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1 h-9 w-full max-w-[160px] rounded-lg border border-navy/15 bg-white px-2.5 text-xs font-semibold text-navy focus:border-blue focus:outline-none"
            />
          </label>

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
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-navy/50">Add delivery for this quotation</span>
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
            locationId={branchId}
          />

          <label className="mt-3 block">
            <span className="text-[11px] font-semibold text-navy/50">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes for this quotation"
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
            description="Shows the Tax Breakdown section on this quotation's print, download, and share"
            checked={includeTaxBreakdown}
            onChange={setIncludeTaxBreakdown}
          />

          <CheckboxField
            label="Include storefront information"
            description="Shows the shop name, logo, address, contacts and header/footer text on this quotation"
            checked={includeBusinessInfo}
            onChange={setIncludeBusinessInfo}
          />

          {submitError && <p className="mt-3 rounded border border-red/30 bg-red/10 px-3 py-2 text-xs font-semibold text-red">{submitError}</p>}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-blue py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {submitting ? (editId ? "Saving…" : "Creating…") : editId ? "Save Changes" : "Create Quotation"}
          </button>
          </>
          )}
        </div>
      </motion.div>

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
          initialDraft={delivery ?? emptyDeliveryDraft(customerId ? customerLabel : "")}
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

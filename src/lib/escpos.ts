import { formatCents } from "./money";
import type { SharedDocument } from "./types";

/** Characters per line in the printer's default font — 58mm and 80mm are the two paper widths
 * thermal receipt printers come in. */
export const LINE_WIDTH: Record<58 | 80, number> = { 58: 32, 80: 48 };

const ESC = 0x1b;
const GS = 0x1d;

/** Every cheap thermal printer's default code page agrees on plain ASCII and almost nothing else —
 * so typographic punctuation and accents are folded to ASCII rather than printing as garbage. */
function toPrintable(text: string): string {
  return text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—−]/g, "-")
    .replace(/…/g, "...")
    .replace(/[  ]/g, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

/** Minimal ESC/POS writer — just the commands a receipt needs (init, align, bold, double size, feed,
 * cut), so nothing printer-model-specific creeps in. */
export class EscPosWriter {
  private bytes: number[] = [ESC, 0x40]; // ESC @ — reset the printer to a known state
  constructor(readonly width: number) {}

  private raw(...values: number[]): this {
    this.bytes.push(...values);
    return this;
  }

  align(where: "left" | "center" | "right"): this {
    return this.raw(ESC, 0x61, where === "left" ? 0 : where === "center" ? 1 : 2);
  }

  bold(on: boolean): this {
    return this.raw(ESC, 0x45, on ? 1 : 0);
  }

  /** Double width + height — for the shop name and the total. Halves the usable line width. */
  big(on: boolean): this {
    return this.raw(GS, 0x21, on ? 0x11 : 0x00);
  }

  text(line: string): this {
    for (const ch of toPrintable(line)) this.bytes.push(ch.charCodeAt(0));
    return this.raw(0x0a);
  }

  /** Word-wraps to the line width (long product names). */
  wrapped(line: string, width = this.width): this {
    const words = toPrintable(line).split(/\s+/).filter(Boolean);
    let current = "";
    for (const word of words) {
      if (!current) current = word.slice(0, width);
      else if (current.length + 1 + word.length <= width) current += ` ${word}`;
      else {
        this.text(current);
        current = word.slice(0, width);
      }
    }
    if (current) this.text(current);
    return this;
  }

  /** "Label ........ value" on one line; the label is cut short if both don't fit. */
  row(left: string, right: string): this {
    const r = toPrintable(right);
    const l = toPrintable(left).slice(0, Math.max(0, this.width - r.length - 1));
    return this.text(l + " ".repeat(Math.max(1, this.width - l.length - r.length)) + r);
  }

  divider(): this {
    return this.text("-".repeat(this.width));
  }

  feed(lines: number): this {
    return this.raw(ESC, 0x64, lines);
  }

  /** Partial cut — ignored by printers without a cutter. */
  cut(): this {
    return this.raw(GS, 0x56, 0x42, 0x00);
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.bytes);
  }
}

const KIND_LABEL: Record<SharedDocument["documentKind"], string> = { receipt: "RECEIPT", invoice: "INVOICE", quotation: "QUOTATION" };

/** Lays out a sale/invoice/quotation for a thermal printer — the same SharedDocument view-model
 * DocumentDetailModal renders and the PDF download uses, so the paper copy can't disagree with them. */
export function buildReceipt(doc: SharedDocument, paperWidth: 58 | 80): Uint8Array {
  const width = LINE_WIDTH[paperWidth];
  const money = (cents: number) => formatCents(cents, doc.currency);
  const w = new EscPosWriter(width);

  w.align("center").bold(true).big(true).wrapped(doc.businessName, Math.floor(width / 2)).big(false).bold(false);
  if (doc.physicalAddress) w.wrapped(doc.physicalAddress);
  if (doc.primaryPhone) w.text(`Tel: ${doc.primaryPhone}`);
  if (doc.receiptHeader) w.wrapped(doc.receiptHeader);

  w.align("left").divider();
  w.bold(true).text(`${KIND_LABEL[doc.documentKind]}${doc.documentNumber ? ` ${doc.documentNumber}` : ""}`).bold(false);
  w.text(doc.dateLabel);
  if (doc.branchName) w.text(doc.branchName);
  if (doc.employeeName) w.text(`Served by: ${doc.employeeName}`);
  if (doc.customerName) w.text(`Customer: ${doc.customerName}`);
  if (doc.approvedVoid) w.bold(true).text("*** VOIDED ***").bold(false);
  w.divider();

  for (const item of [...doc.items, ...doc.extraLines]) {
    w.wrapped(item.name);
    w.row(`  ${item.quantity} x ${money(item.unitPriceCents)}`, money(item.lineTotalCents));
    if (item.discountAmountCents > 0) w.row("  Discount", `-${money(item.discountAmountCents)}`);
  }
  w.divider();

  if (doc.discountAmountCents > 0) w.row("Total discount", `-${money(doc.discountAmountCents)}`);
  if (doc.addedTaxCents > 0) w.row("Tax", money(doc.addedTaxCents));
  else if (doc.taxAmountCents > 0 && doc.includeTaxBreakdown) w.row(`Incl. VAT ${doc.vatRatePercent}%`, money(doc.taxAmountCents));
  w.bold(true).row("TOTAL", money(doc.grandTotalCents)).bold(false);

  if (doc.documentKind === "receipt") {
    if (doc.payments.length > 1) {
      for (const p of doc.payments) w.row(p.paymentMethodName + (p.reference ? ` ${p.reference}` : ""), money(p.amountCents));
    } else if (doc.paymentMethodName) {
      w.row(doc.paymentMethodName + (doc.paymentReference ? ` ${doc.paymentReference}` : ""), money(doc.amountReceivedCents ?? doc.grandTotalCents));
    }
    if (doc.changeGivenCents && doc.changeGivenCents > 0) w.row("Change", money(doc.changeGivenCents));
  } else if (doc.documentKind === "invoice") {
    for (const p of doc.payments) w.row(`Paid (${p.paymentMethodName})`, money(p.amountCents));
    if (doc.balanceDueCents !== null) w.bold(true).row("BALANCE DUE", money(doc.balanceDueCents)).bold(false);
    if (doc.dueDate) w.text(`Due: ${doc.dueDate}`);
  } else if (doc.validUntil) {
    w.text(`Valid until: ${doc.validUntil}`);
  }

  if (doc.notes) {
    w.divider();
    w.wrapped(doc.notes);
  }

  w.divider().align("center");
  if (doc.receiptFooter) w.wrapped(doc.receiptFooter);
  else w.text("Thank you!");
  return w.feed(4).cut().toBytes();
}

/** The receipt's text with the ESC/POS commands stripped — for the browser print sheet (iPhone
 * Safari has no Bluetooth access), so that copy is laid out by exactly the same code as the
 * thermal one. Knows only the commands EscPosWriter emits. */
export function escposToText(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]!;
    if (b === ESC) {
      const cmd = bytes[i + 1];
      if (cmd === 0x40) i += 1; // ESC @ reset
      else if (cmd === 0x64) {
        out += "\n".repeat(bytes[i + 2] ?? 0); // ESC d n feed
        i += 2;
      } else i += 2; // ESC a n align, ESC E n bold
    } else if (b === GS) {
      i += bytes[i + 1] === 0x56 ? 3 : 2; // GS V B n cut, GS ! n size
    } else {
      out += String.fromCharCode(b);
    }
  }
  return out.replace(/\n+$/, "\n");
}

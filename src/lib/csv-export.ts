/** Builds a CSV (Excel opens it directly) and hands it to the phone's share sheet — WhatsApp, email,
 * Drive — falling back to a plain download where sharing files isn't supported. */
export async function exportCsv(filename: string, header: string[], rows: Array<Array<string | number>>): Promise<void> {
  const escape = (value: string | number) => {
    const text = String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  // BOM so Excel reads UTF-8 names correctly.
  const csv = "﻿" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
  const file = new File([csv], filename, { type: "text/csv" });

  if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // share sheet dismissed
    }
  }
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Cents → "1250.00" for spreadsheets (no currency symbol, so the column stays numeric). */
export function centsForCsv(cents: number): string {
  return (cents / 100).toFixed(2);
}

import type { SharedLineItem } from "@/lib/types";

export type ItemSectionGroup = {
  label: string | null;
  items: SharedLineItem[];
  subtotalCents: number;
};

/** Ported from SERVER's src/lib/document-sections.ts (groupItemsBySections) — groups a flat item
 * array by sectionLabel in order of each label's first appearance, so the Owner App's document
 * view groups identically to DESKTOP's own print/PDF. */
export function groupItemsBySections(items: SharedLineItem[]): ItemSectionGroup[] {
  const order: Array<string | null> = [];
  const byLabel = new Map<string | null, SharedLineItem[]>();
  for (const item of items) {
    const label = item.sectionLabel;
    if (!byLabel.has(label)) {
      order.push(label);
      byLabel.set(label, []);
    }
    byLabel.get(label)!.push(item);
  }
  return order.map((label) => {
    const groupItems = byLabel.get(label)!;
    return {
      label,
      items: groupItems,
      subtotalCents: groupItems.reduce((sum, item) => sum + item.lineTotalCents, 0),
    };
  });
}

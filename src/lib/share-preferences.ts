/** Remembers the user's last "Include WhatsApp preview" checkbox choice across shares, so they
 * don't have to re-toggle the same preference every single time — ports DESKTOP's own
 * share-preferences.ts (same reasoning: a device-local UI preference, not sensitive data, plain
 * localStorage is the right tool). Scoped down to just this one flag — mobile's share flow has no
 * "include delivery note" or "WhatsApp desktop installed" concepts DESKTOP's own version also
 * tracks (mobile always shares through the OS's native share sheet, not a WhatsApp deep link). */
const STORAGE_KEY = "blueledger.share.preferences";

const DEFAULT_INCLUDE_WHATSAPP_PREVIEW = false;

export function getIncludeWhatsappPreview(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INCLUDE_WHATSAPP_PREVIEW;
    const parsed = JSON.parse(raw) as { includeWhatsappPreview?: boolean };
    return parsed.includeWhatsappPreview ?? DEFAULT_INCLUDE_WHATSAPP_PREVIEW;
  } catch {
    return DEFAULT_INCLUDE_WHATSAPP_PREVIEW;
  }
}

export function setIncludeWhatsappPreview(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ includeWhatsappPreview: value }));
  } catch {
    // Losing a remembered UI preference isn't worth crashing the share flow over.
  }
}

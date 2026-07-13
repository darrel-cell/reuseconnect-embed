import { getUnderlyingAssetCategoryNameForJml } from "@/lib/jml-assets";

export type JmlDeviceDetailRow = { make?: string; model?: string; deviceType?: string };

/**
 * Parse JML "Device details:" JSON from booking status history into a lookup map.
 * Keys: lowercased UI category (e.g. "phone"), lowercased DB name ("smart phones"), and raw category string.
 */
export function buildJmlDeviceDetailsMapFromBooking(booking: {
  jmlSubType?: string;
  statusHistory?: Array<{ notes?: string }>;
}): Map<string, JmlDeviceDetailRow> {
  const map = new Map<string, JmlDeviceDetailRow>();
  const statusHistory = booking.statusHistory;
  if (!statusHistory?.length) return map;

  const isBreakfix = booking.jmlSubType === "breakfix";
  const creationHistory = statusHistory.find(
    (h) =>
      h.notes &&
      (isBreakfix ? h.notes.includes("Replacement Device details:") : h.notes.includes("Device details:"))
  );
  if (!creationHistory?.notes) return map;

  try {
    const notes = creationHistory.notes;
    const deviceDetailsMatch =
      notes.match(/Device details:\s*(\[[\s\S]*?\])(?=\s*\.?\s*Replacement Device details:|$)/i) ||
      notes.match(/Device details:\s*(\[[\s\S]*?\])/i);
    if (!deviceDetailsMatch) return map;

    const deviceDetails = JSON.parse(deviceDetailsMatch[1]) as unknown[];
    if (!Array.isArray(deviceDetails)) return map;

    deviceDetails.forEach((device: any) => {
      if (!device?.category) return;

      const rawCategory = String(device.category).trim();
      const normalizedKey = rawCategory.toLowerCase();

      const row: JmlDeviceDetailRow = {
        make: device.make,
        model: device.model,
        deviceType: device.deviceType,
      };

      map.set(normalizedKey, row);
      map.set(rawCategory, row);

      const underlying = getUnderlyingAssetCategoryNameForJml(rawCategory);
      if (underlying) {
        map.set(underlying.toLowerCase(), row);
        map.set(underlying, row);
      }
    });
  } catch {
    // ignore
  }

  return map;
}

/** Resolve make/model row for a booking asset category name (e.g. Smart Phones). */
export function lookupJmlDeviceDetails(
  map: Map<string, JmlDeviceDetailRow>,
  assetCategory: string
): JmlDeviceDetailRow {
  const cat = (assetCategory || "").trim();
  if (!cat) return {};
  const lower = cat.toLowerCase();
  return map.get(cat) || map.get(lower) || {};
}

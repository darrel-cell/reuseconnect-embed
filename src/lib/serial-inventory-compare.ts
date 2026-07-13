import { getUnderlyingAssetCategoryNameForJml } from "@/lib/jml-assets";
import type { InventoryLookupResult } from "@/services/inventory.service";

export type IdentityMismatch = {
  field: string;
  entered: string;
  database: string;
};

function norm(s: string | null | undefined): string {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/** True when two category labels refer to the same asset class (e.g. Phone vs Smart Phones). */
export function categoriesEquivalent(a: string, b: string): boolean {
  if (!a.trim() || !b.trim()) return false;
  const ua = getUnderlyingAssetCategoryNameForJml(a) || a;
  const ub = getUnderlyingAssetCategoryNameForJml(b) || b;
  if (norm(ua) === norm(ub)) return true;
  return norm(a) === norm(b);
}

export function compareInventoryIdentity(
  entered: {
    category: string;
    make: string;
    model: string;
    deviceType: string | null | undefined;
    imei?: string;
    conditionCode?: string;
  },
  db: {
    category: string;
    make: string;
    model: string;
    deviceType: string | null;
    imei: string | null;
    conditionCode: string;
  }
): IdentityMismatch[] {
  const mismatches: IdentityMismatch[] = [];

  if (!categoriesEquivalent(entered.category, db.category)) {
    mismatches.push({
      field: "Category",
      entered: entered.category || "—",
      database: db.category,
    });
  }
  if (norm(entered.make) !== norm(db.make)) {
    mismatches.push({ field: "Make", entered: entered.make || "—", database: db.make });
  }
  if (norm(entered.model) !== norm(db.model)) {
    mismatches.push({ field: "Model", entered: entered.model || "—", database: db.model });
  }
  const et = entered.deviceType === undefined || entered.deviceType === null ? "" : String(entered.deviceType);
  const dt = db.deviceType === null || db.deviceType === undefined ? "" : String(db.deviceType);
  if (norm(et) !== norm(dt)) {
    mismatches.push({ field: "Device type", entered: et || "—", database: dt || "—" });
  }
  const ei = norm(entered.imei || "");
  const di = norm(db.imei || "");
  if (ei && di && ei !== di) {
    mismatches.push({ field: "IMEI", entered: entered.imei || "—", database: db.imei || "—" });
  }
  if (entered.conditionCode !== undefined && norm(entered.conditionCode) !== norm(db.conditionCode)) {
    mismatches.push({
      field: "Condition code (ERP)",
      entered: entered.conditionCode || "—",
      database: db.conditionCode,
    });
  }

  return mismatches;
}

/** Grading page compares booking/JML expected identity to inventory by serial. */
export function compareGradingSerialVsInventory(
  expected: {
    category: string;
    make?: string;
    model?: string;
    deviceType?: string;
    imei?: string;
    isAccessory?: boolean;
  },
  lookup: InventoryLookupResult | null
): IdentityMismatch[] {
  if (!lookup || !lookup.found) return [];
  const inv = lookup.inventory;
  const mismatches: IdentityMismatch[] = [];
  if (!categoriesEquivalent(expected.category, inv.category)) {
    mismatches.push({
      field: "Category",
      entered: expected.category || "—",
      database: inv.category,
    });
  }
  if (!expected.isAccessory) {
    if (expected.make && norm(expected.make) !== norm(inv.make)) {
      mismatches.push({
        field: "Make",
        entered: expected.make || "—",
        database: inv.make,
      });
    }
    if (expected.model && norm(expected.model) !== norm(inv.model)) {
      mismatches.push({
        field: "Model",
        entered: expected.model || "—",
        database: inv.model,
      });
    }
    if (expected.deviceType && norm(expected.deviceType) !== norm(inv.deviceType || "")) {
      mismatches.push({
        field: "Device type",
        entered: expected.deviceType || "—",
        database: inv.deviceType || "—",
      });
    }
    const ei = norm(expected.imei || "");
    const di = norm(inv.imei || "");
    if (ei && di && ei !== di) {
      mismatches.push({
        field: "IMEI",
        entered: expected.imei || "—",
        database: inv.imei || "—",
      });
    }
  }
  return mismatches;
}
